/**
 * Reads and writes for `character_pages`. Each read and write answers `undefined` where
 * the character does not exist, the way `getCharacter` reads a miss.
 */
import { type CharacterPage, PRESET_PAGES } from "@dnd/character";
import { asc, eq } from "drizzle-orm";
import { characterPages, characters } from "../characters.ts";
import type { CharactersDb } from "./characters.ts";

type PageRow = typeof characterPages.$inferInsert;
type PageRecordRow = typeof characterPages.$inferSelect;

/** What a transaction and the database both offer, so a helper serves either. */
type Db = Pick<CharactersDb, "select" | "insert" | "delete">;

/** The preset rows for one character, at the head of its order. */
export function presetPageRows(characterId: string): PageRow[] {
  return PRESET_PAGES.map((page, position) => ({ ...page, characterId, position, preset: true }));
}

function exists(db: Db, characterId: string): boolean {
  return (
    db
      .select({ id: characters.id })
      .from(characters)
      .where(eq(characters.id, characterId))
      .get() !== undefined
  );
}

function pageRows(db: Db, characterId: string) {
  return db
    .select()
    .from(characterPages)
    .where(eq(characterPages.characterId, characterId))
    .orderBy(asc(characterPages.position))
    .all();
}

/** Deletes then inserts, so a reorder never passes through two rows at one position. */
function rewrite(db: Db, characterId: string, rows: PageRow[]) {
  db.delete(characterPages).where(eq(characterPages.characterId, characterId)).run();
  if (rows.length > 0) db.insert(characterPages).values(rows).run();
}

export function listCharacterPages(db: CharactersDb, characterId: string) {
  return exists(db, characterId) ? pageRows(db, characterId) : undefined;
}

/**
 * Replaces a character's pages with `pages`, in that order. A preset keeps its `preset`
 * flag through the write, and a page the list leaves out is deleted — unless it is a
 * preset, which refuses the whole write and names every preset it left out.
 */
export function replaceCharacterPages(
  db: CharactersDb,
  characterId: string,
  pages: CharacterPage[],
): { pages: PageRecordRow[] } | { missingPresets: string[] } | undefined {
  return db.transaction((tx) => {
    if (!exists(tx, characterId)) return undefined;

    const presets = new Set(
      pageRows(tx, characterId)
        .filter((row) => row.preset)
        .map((row) => row.slug),
    );
    const kept = new Set(pages.map((page) => page.slug));
    const missingPresets = [...presets].filter((slug) => !kept.has(slug));
    if (missingPresets.length > 0) return { missingPresets };

    rewrite(
      tx,
      characterId,
      pages.map((page, position) => ({
        ...page,
        characterId,
        position,
        preset: presets.has(page.slug),
      })),
    );
    return { pages: pageRows(tx, characterId) };
  });
}

/**
 * Puts every preset back as seeded, at the head of the order, and moves the pages the
 * user wrote after them untouched and in their existing order.
 */
export function restoreDefaultPages(db: CharactersDb, characterId: string) {
  return db.transaction((tx) => {
    if (!exists(tx, characterId)) return undefined;

    const presets = presetPageRows(characterId);
    const written = pageRows(tx, characterId)
      .filter((row) => !row.preset)
      .map((row, index) => ({ ...row, position: presets.length + index }));
    rewrite(tx, characterId, [...presets, ...written]);
    return pageRows(tx, characterId);
  });
}
