/**
 * Resolves the spells one definition lists, reading `content.db` for a catalog reference
 * and `homebrew.db` for a homebrew one. A reference nothing answers stays in the list,
 * marked unresolved, for the reason `features.ts` gives.
 */
import {
  type CharacterSpells,
  entriesSchema,
  type SheetSpell,
  spellCastingFactsSchema,
} from "@dnd/catalog";
import { type CharacterDefinition, displayName } from "@dnd/character";
import type { ZodType } from "zod";
import { getSpells } from "./content.ts";
import { getHomebrewSpell, type HomebrewDb } from "./homebrew.ts";

type SpellEntry = CharacterDefinition["spells"][number];

type SpellRowFacts = {
  level: number;
  school: string;
  concentration: boolean;
  ritual: boolean;
  json: Record<string, unknown>;
};

const pick = <T>(schema: ZodType<T>, value: unknown): T | undefined => {
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
};

/** Each fact parsed alone, so one malformed field leaves the others standing. */
function castingFacts(json: Record<string, unknown>) {
  const { shape } = spellCastingFactsSchema;
  return {
    time: pick(shape.time, json.time),
    range: pick(shape.range, json.range),
    components: pick(shape.components, json.components),
    duration: pick(shape.duration, json.duration),
  };
}

type SpellRow = SpellRowFacts & { name: string };

function homebrewFacts(homebrewDb: HomebrewDb, id: string): SpellRow | undefined {
  const row = getHomebrewSpell(homebrewDb, id);
  return row && { ...row, json: row.json as Record<string, unknown> };
}

/** Every catalog row read over one connection, since a caster can list dozens. */
function rowFacts(
  dataDir: string,
  homebrewDb: HomebrewDb,
  entries: readonly SpellEntry[],
): (SpellRow | undefined)[] {
  const catalogRefs = entries.flatMap(({ ref }) => ("homebrewId" in ref ? [] : [ref]));
  const catalogRows = getSpells(dataDir, catalogRefs).values();
  return entries.map(({ ref }) => {
    if ("homebrewId" in ref) return homebrewFacts(homebrewDb, ref.homebrewId);
    const row = catalogRows.next().value;
    return (
      row && {
        ...row,
        concentration: row.concentration === 1,
        ritual: row.ritual === 1,
        json: JSON.parse(row.json) as Record<string, unknown>,
      }
    );
  });
}

function sheetSpell(entry: SpellEntry, row: SpellRow | undefined) {
  const { ref, prepared, origin } = entry;
  const fields = {
    name: row?.name ?? displayName(ref),
    ...("homebrewId" in ref ? {} : { source: ref.source }),
    prepared,
    ...(origin && { origin }),
  };
  if (!row) return { resolved: false as const, ...fields };
  return {
    resolved: true as const,
    ...fields,
    level: row.level,
    school: row.school,
    concentration: row.concentration,
    ritual: row.ritual,
    ...castingFacts(row.json),
    // Upstream keeps the upcast rule apart, and dropping it makes the text read complete.
    entries: [
      ...(pick(entriesSchema, row.json.entries) ?? []),
      ...(pick(entriesSchema, row.json.entriesHigherLevel) ?? []),
    ],
  };
}

export function resolveCharacterSpells(
  dataDir: string,
  homebrewDb: HomebrewDb,
  definition: CharacterDefinition,
): CharacterSpells {
  const rows = rowFacts(dataDir, homebrewDb, definition.spells);
  const spells: SheetSpell[] = definition.spells.map((entry, index) =>
    sheetSpell(entry, rows[index]),
  );
  return { spells };
}
