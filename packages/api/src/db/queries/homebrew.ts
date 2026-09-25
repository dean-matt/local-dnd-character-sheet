/**
 * List, search, read, create, update and delete for `homebrew.db`'s `homebrew_items`,
 * `homebrew_spells`, `homebrew_backgrounds`, `homebrew_feats`, `homebrew_races` and
 * `homebrew_classes` tables. `source` never arrives as an argument — every write stamps
 * `HOMEBREW_SOURCE` into `json` here, the one place that builds it, and `id` is chosen by
 * the caller once at creation and never reassigned, so a rename keeps the id a character
 * already references.
 */
import type {
  HomebrewBackgroundInput,
  HomebrewClassInput,
  HomebrewFeatInput,
  HomebrewItem,
  HomebrewItemInput,
  HomebrewRaceInput,
  HomebrewSpellInput,
} from "@dnd/catalog";
import {
  characterOptionEntrySchema,
  homebrewClassSchema,
  homebrewItemSchema,
  raceEntrySchema,
  spellEntrySchema,
} from "@dnd/catalog";
import type { Edition } from "@dnd/rules";
import { and, eq, type SQL, sql } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type * as homebrewSchema from "../homebrew.ts";
import {
  HOMEBREW_SOURCE,
  homebrewBackgrounds,
  homebrewClasses,
  homebrewFeats,
  homebrewItems,
  homebrewRaces,
  homebrewSpells,
} from "../homebrew.ts";
import { escapeLikeTerm } from "./content.ts";

export type HomebrewDb = BetterSQLite3Database<typeof homebrewSchema>;

export function listHomebrewItems(db: HomebrewDb) {
  return db.select().from(homebrewItems).all();
}

/** Homebrew items of one edition whose name holds `term`, for `/search`. */
export function searchHomebrewItems(db: HomebrewDb, edition: Edition, term: string) {
  return db
    .select()
    .from(homebrewItems)
    .where(
      and(
        eq(homebrewItems.edition, edition),
        sql`${homebrewItems.name} LIKE ${`%${escapeLikeTerm(term)}%`} ESCAPE '!'`,
      ),
    )
    .all();
}

/** Classic before the 2024 edition, stated rather than left to how the two values sort. */
const classicFirst = (column: typeof homebrewItems.edition | typeof homebrewSpells.edition) =>
  sql`CASE ${column} WHEN 'classic' THEN 0 ELSE 1 END`;

/** `name` compared as the unique index compares it, ignoring case: one match per edition at most. */
function namedIn(
  column: typeof homebrewItems.name | typeof homebrewSpells.name,
  name: string,
): SQL {
  return sql`${column} = ${name} COLLATE NOCASE`;
}

/** The homebrew item named `name`, in `edition`, or with none the classic row before the 2024 one. */
export function homebrewItemNamed(db: HomebrewDb, name: string, edition?: Edition) {
  return db
    .select()
    .from(homebrewItems)
    .where(
      and(
        namedIn(homebrewItems.name, name),
        edition === undefined ? undefined : eq(homebrewItems.edition, edition),
      ),
    )
    .orderBy(classicFirst(homebrewItems.edition))
    .get();
}

export function getHomebrewItem(db: HomebrewDb, id: string) {
  return db.select().from(homebrewItems).where(eq(homebrewItems.id, id)).get();
}

function itemJson(input: HomebrewItemInput) {
  const { edition: _edition, ...entry } = input;
  return homebrewItemSchema.parse({ ...entry, source: HOMEBREW_SOURCE });
}

/** `"optional"` means attunable, not required — the same reading `packages/content/src/load/items.ts`'s `requiresAttunement` gives it. */
function requiresAttunement(reqAttune: HomebrewItem["reqAttune"]): boolean {
  return reqAttune === true || (typeof reqAttune === "string" && reqAttune !== "optional");
}

function itemColumns(json: ReturnType<typeof itemJson>) {
  return {
    name: json.name,
    type: json.type ?? null,
    rarity: json.rarity ?? null,
    requiresAttunement: requiresAttunement(json.reqAttune),
    json,
  };
}

export function insertHomebrewItem(db: HomebrewDb, id: string, input: HomebrewItemInput) {
  const json = itemJson(input);
  return db
    .insert(homebrewItems)
    .values({ id, edition: input.edition, ...itemColumns(json) })
    .returning()
    .get();
}

/** `undefined` where `id` names no row, the way `getHomebrewItem` reads a miss. */
export function updateHomebrewItem(db: HomebrewDb, id: string, input: HomebrewItemInput) {
  const json = itemJson(input);
  return db
    .update(homebrewItems)
    .set({ edition: input.edition, ...itemColumns(json) })
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

/** Homebrew spells of one edition whose name holds `term`, for `/search`. */
export function searchHomebrewSpells(db: HomebrewDb, edition: Edition, term: string) {
  return db
    .select()
    .from(homebrewSpells)
    .where(
      and(
        eq(homebrewSpells.edition, edition),
        sql`${homebrewSpells.name} LIKE ${`%${escapeLikeTerm(term)}%`} ESCAPE '!'`,
      ),
    )
    .all();
}

/** The homebrew spell named `name`, in `edition`, or with none the classic row before the 2024 one. */
export function homebrewSpellNamed(db: HomebrewDb, name: string, edition?: Edition) {
  return db
    .select()
    .from(homebrewSpells)
    .where(
      and(
        namedIn(homebrewSpells.name, name),
        edition === undefined ? undefined : eq(homebrewSpells.edition, edition),
      ),
    )
    .orderBy(classicFirst(homebrewSpells.edition))
    .get();
}

export function getHomebrewSpell(db: HomebrewDb, id: string) {
  return db.select().from(homebrewSpells).where(eq(homebrewSpells.id, id)).get();
}

function spellJson(input: HomebrewSpellInput) {
  const { edition: _edition, ...entry } = input;
  return spellEntrySchema.parse({ ...entry, source: HOMEBREW_SOURCE });
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

export function listHomebrewBackgrounds(db: HomebrewDb) {
  return db.select().from(homebrewBackgrounds).all();
}

export function getHomebrewBackground(db: HomebrewDb, id: string) {
  return db.select().from(homebrewBackgrounds).where(eq(homebrewBackgrounds.id, id)).get();
}

function backgroundJson(input: HomebrewBackgroundInput) {
  const { edition: _edition, ...entry } = input;
  return characterOptionEntrySchema.parse({ ...entry, source: HOMEBREW_SOURCE });
}

export function insertHomebrewBackground(
  db: HomebrewDb,
  id: string,
  input: HomebrewBackgroundInput,
) {
  const json = backgroundJson(input);
  return db
    .insert(homebrewBackgrounds)
    .values({ id, edition: input.edition, name: json.name, json })
    .returning()
    .get();
}

/** `undefined` where `id` names no row, the way `getHomebrewBackground` reads a miss. */
export function updateHomebrewBackground(
  db: HomebrewDb,
  id: string,
  input: HomebrewBackgroundInput,
) {
  const json = backgroundJson(input);
  return db
    .update(homebrewBackgrounds)
    .set({ edition: input.edition, name: json.name, json })
    .where(eq(homebrewBackgrounds.id, id))
    .returning()
    .get();
}

export function deleteHomebrewBackground(db: HomebrewDb, id: string): boolean {
  return db.delete(homebrewBackgrounds).where(eq(homebrewBackgrounds.id, id)).run().changes > 0;
}

export function listHomebrewFeats(db: HomebrewDb) {
  return db.select().from(homebrewFeats).all();
}

export function getHomebrewFeat(db: HomebrewDb, id: string) {
  return db.select().from(homebrewFeats).where(eq(homebrewFeats.id, id)).get();
}

function featJson(input: HomebrewFeatInput) {
  const { edition: _edition, ...entry } = input;
  return characterOptionEntrySchema.parse({ ...entry, source: HOMEBREW_SOURCE });
}

export function insertHomebrewFeat(db: HomebrewDb, id: string, input: HomebrewFeatInput) {
  const json = featJson(input);
  return db
    .insert(homebrewFeats)
    .values({ id, edition: input.edition, name: json.name, json })
    .returning()
    .get();
}

/** `undefined` where `id` names no row, the way `getHomebrewFeat` reads a miss. */
export function updateHomebrewFeat(db: HomebrewDb, id: string, input: HomebrewFeatInput) {
  const json = featJson(input);
  return db
    .update(homebrewFeats)
    .set({ edition: input.edition, name: json.name, json })
    .where(eq(homebrewFeats.id, id))
    .returning()
    .get();
}

export function deleteHomebrewFeat(db: HomebrewDb, id: string): boolean {
  return db.delete(homebrewFeats).where(eq(homebrewFeats.id, id)).run().changes > 0;
}

export function listHomebrewRaces(db: HomebrewDb) {
  return db.select().from(homebrewRaces).all();
}

export function getHomebrewRace(db: HomebrewDb, id: string) {
  return db.select().from(homebrewRaces).where(eq(homebrewRaces.id, id)).get();
}

function raceJson(input: HomebrewRaceInput) {
  const { edition: _edition, ...entry } = input;
  return raceEntrySchema.parse({ ...entry, source: HOMEBREW_SOURCE });
}

export function insertHomebrewRace(db: HomebrewDb, id: string, input: HomebrewRaceInput) {
  const json = raceJson(input);
  return db
    .insert(homebrewRaces)
    .values({ id, edition: input.edition, name: json.name, json })
    .returning()
    .get();
}

/** `undefined` where `id` names no row, the way `getHomebrewRace` reads a miss. */
export function updateHomebrewRace(db: HomebrewDb, id: string, input: HomebrewRaceInput) {
  const json = raceJson(input);
  return db
    .update(homebrewRaces)
    .set({ edition: input.edition, name: json.name, json })
    .where(eq(homebrewRaces.id, id))
    .returning()
    .get();
}

export function deleteHomebrewRace(db: HomebrewDb, id: string): boolean {
  return db.delete(homebrewRaces).where(eq(homebrewRaces.id, id)).run().changes > 0;
}

export function listHomebrewClasses(db: HomebrewDb) {
  return db.select().from(homebrewClasses).all();
}

export function getHomebrewClass(db: HomebrewDb, id: string) {
  return db.select().from(homebrewClasses).where(eq(homebrewClasses.id, id)).get();
}

function classJson(input: HomebrewClassInput) {
  const { edition: _edition, ...entry } = input;
  return homebrewClassSchema.parse({ ...entry, source: HOMEBREW_SOURCE });
}

function classColumns(json: ReturnType<typeof classJson>) {
  return { name: json.name, hitDie: json.hd.faces, json };
}

export function insertHomebrewClass(db: HomebrewDb, id: string, input: HomebrewClassInput) {
  const json = classJson(input);
  return db
    .insert(homebrewClasses)
    .values({ id, edition: input.edition, ...classColumns(json) })
    .returning()
    .get();
}

/** `undefined` where `id` names no row, the way `getHomebrewClass` reads a miss. */
export function updateHomebrewClass(db: HomebrewDb, id: string, input: HomebrewClassInput) {
  const json = classJson(input);
  return db
    .update(homebrewClasses)
    .set({ edition: input.edition, ...classColumns(json) })
    .where(eq(homebrewClasses.id, id))
    .returning()
    .get();
}

export function deleteHomebrewClass(db: HomebrewDb, id: string): boolean {
  return db.delete(homebrewClasses).where(eq(homebrewClasses.id, id)).run().changes > 0;
}
