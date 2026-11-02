/**
 * Schema for `homebrew.db` — your custom items, spells, backgrounds, feats, races,
 * classes, subclasses, subraces and skills.
 *
 * Kept apart from `content.db` so the catalog stays disposable: rebuilding the
 * official content can never touch your homebrew. Rows carry source "HB" and are
 * merged with catalog rows at query time.
 *
 * `json` holds the 5etools entry shape `@dnd/catalog` defines, not a shape of our own —
 * see `docs/data-model.md` for why.
 */
import type {
  CharacterOptionEntry,
  Entries,
  HomebrewClass,
  HomebrewItem,
  HomebrewSkillEntry,
  HomebrewSubclass,
  RaceEntry,
  SpellEntry,
} from "@dnd/catalog";
import { EDITIONS } from "@dnd/rules";
import { sql } from "drizzle-orm";
import { integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const homebrewBackgrounds = sqliteTable(
  "homebrew_backgrounds",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    edition: text("edition", { enum: EDITIONS }).notNull(),
    json: text("json", { mode: "json" }).$type<CharacterOptionEntry>().notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (t) => [uniqueIndex("homebrew_backgrounds_by_name").on(sql`${t.name} COLLATE NOCASE`, t.edition)],
);

export const homebrewClasses = sqliteTable(
  "homebrew_classes",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    edition: text("edition", { enum: EDITIONS }).notNull(),
    hitDie: integer("hit_die").notNull(),
    json: text("json", { mode: "json" }).$type<HomebrewClass>().notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (t) => [uniqueIndex("homebrew_classes_by_name").on(sql`${t.name} COLLATE NOCASE`, t.edition)],
);

export const homebrewClassFeatures = sqliteTable(
  "homebrew_class_features",
  {
    classId: text("class_id")
      .notNull()
      .references(() => homebrewClasses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    level: integer("level").notNull(),
    entries: text("entries", { mode: "json" }).$type<Entries>().notNull(),
  },
  (t) => [primaryKey({ columns: [t.classId, t.level, t.name] })],
);

export const homebrewSubclasses = sqliteTable(
  "homebrew_subclasses",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    edition: text("edition", { enum: EDITIONS }).notNull(),
    classId: text("class_id").references(() => homebrewClasses.id, { onDelete: "restrict" }),
    className: text("class_name"),
    classSource: text("class_source"),
    json: text("json", { mode: "json" }).$type<HomebrewSubclass>().notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (t) => [
    uniqueIndex("homebrew_subclasses_by_homebrew_class")
      .on(t.classId, sql`${t.name} COLLATE NOCASE`)
      .where(sql`${t.classId} IS NOT NULL`),
    uniqueIndex("homebrew_subclasses_by_catalog_class")
      .on(t.className, t.classSource, sql`${t.name} COLLATE NOCASE`, t.edition)
      .where(sql`${t.classId} IS NULL`),
  ],
);

export const homebrewFeats = sqliteTable(
  "homebrew_feats",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    edition: text("edition", { enum: EDITIONS }).notNull(),
    json: text("json", { mode: "json" }).$type<CharacterOptionEntry>().notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (t) => [uniqueIndex("homebrew_feats_by_name").on(sql`${t.name} COLLATE NOCASE`, t.edition)],
);

export const homebrewItems = sqliteTable(
  "homebrew_items",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    edition: text("edition", { enum: EDITIONS }).notNull(),
    type: text("type"),
    rarity: text("rarity"),
    requiresAttunement: integer("requires_attunement", { mode: "boolean" })
      .notNull()
      .default(false),
    json: text("json", { mode: "json" }).$type<HomebrewItem>().notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (t) => [uniqueIndex("homebrew_items_by_name").on(sql`${t.name} COLLATE NOCASE`, t.edition)],
);

export const homebrewRaces = sqliteTable(
  "homebrew_races",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    edition: text("edition", { enum: EDITIONS }).notNull(),
    json: text("json", { mode: "json" }).$type<RaceEntry>().notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (t) => [uniqueIndex("homebrew_races_by_name").on(sql`${t.name} COLLATE NOCASE`, t.edition)],
);

export const homebrewSubraces = sqliteTable(
  "homebrew_subraces",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    edition: text("edition", { enum: EDITIONS }).notNull(),
    raceId: text("race_id").references(() => homebrewRaces.id, { onDelete: "restrict" }),
    raceName: text("race_name"),
    raceSource: text("race_source"),
    json: text("json", { mode: "json" }).$type<RaceEntry>().notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (t) => [
    uniqueIndex("homebrew_subraces_by_homebrew_race")
      .on(t.raceId, sql`${t.name} COLLATE NOCASE`)
      .where(sql`${t.raceId} IS NOT NULL`),
    uniqueIndex("homebrew_subraces_by_catalog_race")
      .on(t.raceName, t.raceSource, sql`${t.name} COLLATE NOCASE`, t.edition)
      .where(sql`${t.raceId} IS NULL`),
  ],
);

export const homebrewSpells = sqliteTable(
  "homebrew_spells",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    edition: text("edition", { enum: EDITIONS }).notNull(),
    level: integer("level").notNull(),
    school: text("school").notNull(),
    concentration: integer("concentration", { mode: "boolean" }).notNull().default(false),
    ritual: integer("ritual", { mode: "boolean" }).notNull().default(false),
    json: text("json", { mode: "json" }).$type<SpellEntry>().notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (t) => [uniqueIndex("homebrew_spells_by_name").on(sql`${t.name} COLLATE NOCASE`, t.edition)],
);

export const homebrewSkills = sqliteTable(
  "homebrew_skills",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    edition: text("edition", { enum: EDITIONS }).notNull(),
    json: text("json", { mode: "json" }).$type<HomebrewSkillEntry>().notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (t) => [uniqueIndex("homebrew_skills_by_name").on(sql`${t.name} COLLATE NOCASE`, t.edition)],
);
