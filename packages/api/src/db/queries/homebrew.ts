/**
 * List, read, create, update and delete for `homebrew.db`'s `homebrew_items` and
 * `homebrew_spells` tables. `source` never arrives as an argument — every write stamps
 * `HOMEBREW_SOURCE` into `json` here, the one place that builds it, and `id` is chosen by
 * the caller once at creation and never reassigned, so a rename keeps the id a character
 * already references.
 */
import type { HomebrewItemInput, HomebrewSpellInput } from "@dnd/catalog";
import { homebrewItemSchema, homebrewSpellSchema } from "@dnd/catalog";
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type * as homebrewSchema from "../homebrew.ts";
import { HOMEBREW_SOURCE, homebrewItems, homebrewSpells } from "../homebrew.ts";

export type HomebrewDb = BetterSQLite3Database<typeof homebrewSchema>;

export function listHomebrewItems(db: HomebrewDb) {
  return db.select().from(homebrewItems).all();
}

export function getHomebrewItem(db: HomebrewDb, id: string) {
  return db.select().from(homebrewItems).where(eq(homebrewItems.id, id)).get();
}

function itemJson(input: HomebrewItemInput) {
  const { edition: _edition, ...entry } = input;
  return homebrewItemSchema.parse({ ...entry, source: HOMEBREW_SOURCE });
}

export function insertHomebrewItem(db: HomebrewDb, id: string, input: HomebrewItemInput) {
  const json = itemJson(input);
  return db
    .insert(homebrewItems)
    .values({
      id,
      name: json.name,
      edition: input.edition,
      type: json.type ?? null,
      rarity: json.rarity ?? null,
      requiresAttunement: Boolean(json.reqAttune),
      json,
    })
    .returning()
    .get();
}

/** `undefined` where `id` names no row, the way `getHomebrewItem` reads a miss. */
export function updateHomebrewItem(db: HomebrewDb, id: string, input: HomebrewItemInput) {
  const json = itemJson(input);
  return db
    .update(homebrewItems)
    .set({
      name: json.name,
      edition: input.edition,
      type: json.type ?? null,
      rarity: json.rarity ?? null,
      requiresAttunement: Boolean(json.reqAttune),
      json,
    })
    .where(eq(homebrewItems.id, id))
    .returning()
    .get();
}

export function deleteHomebrewItem(db: HomebrewDb, id: string): boolean {
  return db.delete(homebrewItems).where(eq(homebrewItems.id, id)).run().changes > 0;
}

export function listHomebrewSpells(db: HomebrewDb) {
  return db.select().from(homebrewSpells).all();
}

export function getHomebrewSpell(db: HomebrewDb, id: string) {
  return db.select().from(homebrewSpells).where(eq(homebrewSpells.id, id)).get();
}

function spellJson(input: HomebrewSpellInput) {
  const { edition: _edition, ...entry } = input;
  return homebrewSpellSchema.parse({ ...entry, source: HOMEBREW_SOURCE });
}

function spellColumns(json: ReturnType<typeof spellJson>) {
  return {
    name: json.name,
    level: json.level,
    school: json.school,
    concentration: json.duration.some((span) => span.concentration === true),
    ritual: json.meta?.ritual === true,
    json,
  };
}

export function insertHomebrewSpell(db: HomebrewDb, id: string, input: HomebrewSpellInput) {
  const json = spellJson(input);
  return db
    .insert(homebrewSpells)
    .values({ id, edition: input.edition, ...spellColumns(json) })
    .returning()
    .get();
}

/** `undefined` where `id` names no row, the way `getHomebrewSpell` reads a miss. */
export function updateHomebrewSpell(db: HomebrewDb, id: string, input: HomebrewSpellInput) {
  const json = spellJson(input);
  return db
    .update(homebrewSpells)
    .set({ edition: input.edition, ...spellColumns(json) })
    .where(eq(homebrewSpells.id, id))
    .returning()
    .get();
}

export function deleteHomebrewSpell(db: HomebrewDb, id: string): boolean {
  return db.delete(homebrewSpells).where(eq(homebrewSpells.id, id)).run().changes > 0;
}
