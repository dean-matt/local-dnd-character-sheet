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

const PRESET_SLUGS = new Set(PRESET_PAGES.map((page) => page.slug));

/**
 * `pages` as rows, in that order. A page under a preset's slug is that preset, whoever
 * wrote the list, so an undo that puts back a deleted preset puts back a preset.
 */
function toRows(characterId: string, pages: readonly CharacterPage[]): PageRow[] {
  return pages.map((page, position) => ({
    ...page,
    characterId,
    position,
    preset: PRESET_SLUGS.has(page.slug),
  }));
}

export function presetPageRows(characterId: string): PageRow[] {
  return toRows(characterId, PRESET_PAGES);
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

/**
 * Replaces every page `characterId` holds with `pages`, in that order. Deletes then
 * inserts, so a reorder never passes through two rows at one position.
 */
export function writePages(db: Db, characterId: string, pages: readonly CharacterPage[]) {
  db.delete(characterPages).where(eq(characterPages.characterId, characterId)).run();
  if (pages.length > 0) db.insert(characterPages).values(toRows(characterId, pages)).run();
}

export function listCharacterPages(db: CharactersDb, characterId: string) {
  return exists(db, characterId) ? pageRows(db, characterId) : undefined;
}

/** Replaces a character's pages with `pages`, in that order, deleting any it leaves out. */
export function replaceCharacterPages(
  db: CharactersDb,
  characterId: string,
  pages: CharacterPage[],
): PageRecordRow[] | undefined {
  return db.transaction((tx) => {
    if (!exists(tx, characterId)) return undefined;
    writePages(tx, characterId, pages);
    return pageRows(tx, characterId);
  });
}

/**
 * Resets each preset's title, visibility and blocks to the seeded page, and puts the
 * presets back in seeded order across the positions presets already hold. Every page the
 * user wrote keeps its place among them, so one placed ahead of or between presets stays
 * there. A preset the user deleted comes back just after the preset seeded before it, or
 * ahead of every other preset where it is seeded first.
 */
export function restoreDefaultPages(db: CharactersDb, characterId: string) {
  return db.transaction((tx) => {
    if (!exists(tx, characterId)) return undefined;

    const rows = pageRows(tx, characterId);
    const held = new Set(rows.map((row) => row.slug).filter((slug) => PRESET_SLUGS.has(slug)));
    const presets = PRESET_PAGES.filter((page) => held.has(page.slug));
    let next = 0;
    const restored = rows.map(({ slug, title, hidden, blocks }) =>
      held.has(slug)
        ? (presets[next++] as CharacterPage)
        : ({ slug, title, hidden, blocks } as CharacterPage),
    );
    for (const [order, page] of PRESET_PAGES.entries()) {
      if (held.has(page.slug)) continue;
      const before = PRESET_PAGES[order - 1]?.slug;
      const after = restored.findIndex((row) => row.slug === before);
      const first = restored.findIndex((row) => PRESET_SLUGS.has(row.slug));
      const at = after !== -1 ? after + 1 : first !== -1 ? first : 0;
      restored.splice(at, 0, page);
    }
    writePages(tx, characterId, restored);
    return pageRows(tx, characterId);
  });
}
