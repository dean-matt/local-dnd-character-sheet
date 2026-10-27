/**
 * Folds every stored `customSkills` into held homebrew skills when the API opens its databases.
 *
 * Runs after both migrations and only while some definition or undo snapshot still carries the
 * key, so a second start finds nothing and changes nothing. The catalog is read only when a
 * definition holds an entry, so a start with nothing but empty keys needs no `content.db`.
 * Both databases are written in one transaction on the characters connection with
 * `homebrew.db` attached, so a throw rolls both back. WAL mode commits each attached file
 * separately, so for the write both files leave it for rollback-journal mode, where SQLite
 * commits the pair atomically, and return to WAL after. The copies taken before the attempt
 * remain the way back from anything else.
 */
import { randomUUID } from "node:crypto";
import {
  type CharacterFile,
  carriesCustomSkills,
  characterDefinitionSchema,
  convertCustomSkills,
  type ExistingHomebrewSkill,
  type LegacyCharacterFile,
  type SkillConversion,
  type StoredCharacter,
} from "@dnd/character";
import type { Edition } from "@dnd/rules";
import type Database from "better-sqlite3";
import { sql } from "drizzle-orm";
import { backupDatabase, backupDirFor } from "./backup.ts";
import type { CharactersDb } from "./queries/characters.ts";
import { importCharacterRows } from "./queries/characters.ts";
import { catalogSkillNames } from "./queries/skills.ts";

type WithClient = CharactersDb & { $client: Database.Database };

type Handles = { charactersDb: WithClient; homebrew: Database.Database; dataDir: string };

type Tx = Parameters<Parameters<CharactersDb["transaction"]>[0]>[0];

/** Runs `write` in a characters transaction that can also write `homebrew.db`, attached as `hb`. */
function writeAcross<T>(
  { charactersDb, homebrew }: Pick<Handles, "charactersDb" | "homebrew">,
  write: (tx: Tx) => T,
): T {
  const files = [charactersDb.$client, homebrew];
  try {
    for (const file of files) {
      if (file.pragma("journal_mode = DELETE", { simple: true }) !== "delete") {
        throw new Error("could not leave WAL mode, so the two files could not commit together");
      }
    }
    charactersDb.$client.prepare("ATTACH DATABASE ? AS hb").run(homebrew.name);
    try {
      return charactersDb.transaction(write);
    } finally {
      charactersDb.$client.exec("DETACH DATABASE hb");
    }
  } finally {
    // Each file on its own, so one that will not restore neither hides the failure above
    // nor leaves the other in rollback-journal mode; the next open sets WAL again.
    for (const file of files) {
      try {
        file.pragma("journal_mode = WAL");
      } catch {}
    }
  }
}

/** Adds the rows a conversion asks for to the attached `homebrew.db`. */
function insertHomebrewSkills(tx: Tx, rows: SkillConversion["homebrewToAdd"]) {
  for (const row of rows) {
    const json = JSON.stringify({ name: row.name, source: "HB", ability: row.ability });
    tx.run(
      sql`INSERT INTO hb.homebrew_skills (id, name, edition, json) VALUES (${randomUUID()}, ${row.name}, ${row.edition}, ${json})`,
    );
  }
}

function existingHomebrewSkills(homebrew: Database.Database): ExistingHomebrewSkill[] {
  return homebrew
    .prepare(
      "SELECT name, edition, json_extract(json, '$.ability') AS ability FROM homebrew_skills",
    )
    .all() as ExistingHomebrewSkill[];
}

function readStored({ charactersDb }: Handles): StoredCharacter[] {
  const sqlite = charactersDb.$client;
  const characters = sqlite
    .prepare("SELECT id, definition FROM characters ORDER BY created_at, rowid")
    .all() as { id: string; definition: string }[];
  const snapshots = sqlite
    .prepare("SELECT id, character_id, previous_state FROM undo_log ORDER BY id")
    .all() as { id: number; character_id: string; previous_state: string }[];
  return characters.map(({ id, definition }) => ({
    id,
    definition: JSON.parse(definition),
    snapshots: snapshots
      .filter((row) => row.character_id === id)
      .map((row) => ({ id: row.id, previousState: JSON.parse(row.previous_state) })),
  }));
}

const needsConversion = (stored: readonly StoredCharacter[]) =>
  stored.some(
    ({ definition, snapshots }) =>
      carriesCustomSkills(definition) ||
      snapshots.some(({ previousState }) => carriesCustomSkills(previousState)),
  );

function apply(handles: Handles, stored: StoredCharacter[]) {
  const conversion = convertCustomSkills(
    stored,
    existingHomebrewSkills(handles.homebrew),
    (edition: Edition) => catalogSkillNames(handles.dataDir, edition),
  );
  writeAcross(handles, (tx) => {
    insertHomebrewSkills(tx, conversion.homebrewToAdd);
    for (const { id, definition } of conversion.characters) {
      tx.run(
        sql`UPDATE characters SET definition = ${JSON.stringify(definition)} WHERE id = ${id}`,
      );
    }
    for (const row of conversion.snapshots) {
      if (row.keep) {
        tx.run(
          sql`UPDATE undo_log SET previous_state = ${JSON.stringify(row.keep.previousState)} WHERE id = ${row.id}`,
        );
      } else tx.run(sql`DELETE FROM undo_log WHERE id = ${row.id}`);
    }
  });
}

/** The error's message and, where Drizzle wrapped a SQLite failure, the cause that names it. */
function describe(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  return error.cause instanceof Error ? `${error.message} (${error.cause.message})` : error.message;
}

/**
 * Converts what `characters.db` still holds. A failure rethrows with both backup paths, so the
 * start stops and says where the databases were before the attempt.
 */
export function convertStoredCustomSkills(handles: Handles) {
  const stored = readStored(handles);
  if (!needsConversion(stored)) return;

  const backupDir = backupDirFor(handles.dataDir);
  const characters = backupDatabase(handles.charactersDb.$client, backupDir, "characters");
  const homebrew = backupDatabase(handles.homebrew, backupDir, "homebrew");
  try {
    apply(handles, stored);
  } catch (error) {
    const reason = describe(error);
    throw new Error(
      `Converting custom skills failed, and nothing was changed: ${reason}. ` +
        `Copies from before the attempt: ${characters} and ${homebrew}`,
      { cause: error },
    );
  }
  console.log(`Converted custom skills. Copies from before: ${characters} and ${homebrew}`);
}

/**
 * Imports a file exported while `customSkills` existed: its custom skills become homebrew
 * skills under the same rules as the startup conversion, and the new homebrew rows and the
 * character are written together or not at all. A definition that fails the schema once
 * converted throws a `ZodError` before anything is written.
 */
export function importWithCustomSkills(handles: Handles, id: string, file: LegacyCharacterFile) {
  const conversion = convertCustomSkills(
    [{ id, definition: file.definition, snapshots: [] }],
    existingHomebrewSkills(handles.homebrew),
    (edition: Edition) => catalogSkillNames(handles.dataDir, edition),
  );
  const converted: CharacterFile = {
    ...file,
    definition: characterDefinitionSchema.parse(conversion.characters[0]?.definition),
  };
  return writeAcross(handles, (tx) => {
    insertHomebrewSkills(tx, conversion.homebrewToAdd);
    return importCharacterRows(tx, id, converted);
  });
}
