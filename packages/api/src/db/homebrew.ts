/**
 * Schema for `homebrew.db` — your custom items, spells, backgrounds, feats, races,
 * classes, subclasses, subraces, skills, deities, optional features and monsters.
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
  HomebrewDeity,
  HomebrewItem,
  HomebrewMonster,
  HomebrewOptionalFeature,
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

export const homebrewDeities = sqliteTable(
  "homebrew_deities",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    pantheon: text("pantheon").notNull(),
    json: text("json", { mode: "json" }).$type<HomebrewDeity>().notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (t) => [
    uniqueIndex("homebrew_deities_by_name").on(
      sql`${t.name} COLLATE NOCASE`,
      sql`${t.pantheon} COLLATE NOCASE`,
    ),
  ],
);

export const homebrewOptionalFeatures = sqliteTable("homebrew_optional_features", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  edition: text("edition", { enum: EDITIONS }).notNull(),
  json: text("json", { mode: "json" }).$type<HomebrewOptionalFeature>().notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

/**
 * A feature's types beside it, as `optional_feature_types` does in content.db. `name` and
 * `edition` repeat the feature's so one unique index can state that a name is unique within
 * a type and an edition; the writes in `queries/homebrew.ts` keep them in step.
 */
export const homebrewOptionalFeatureTypes = sqliteTable(
  "homebrew_optional_feature_types",
  {
    featureId: text("feature_id")
      .notNull()
      .references(() => homebrewOptionalFeatures.id, { onDelete: "cascade" }),
    featureType: text("feature_type").notNull(),
    name: text("name").notNull(),
    edition: text("edition", { enum: EDITIONS }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.featureId, t.featureType] }),
    uniqueIndex("homebrew_optional_feature_types_by_name").on(
      t.featureType,
      t.edition,
      sql`${t.name} COLLATE NOCASE`,
    ),
  ],
);

export const homebrewMonsters = sqliteTable(
  "homebrew_monsters",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    edition: text("edition", { enum: EDITIONS }).notNull(),
    json: text("json", { mode: "json" }).$type<HomebrewMonster>().notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (t) => [uniqueIndex("homebrew_monsters_by_name").on(sql`${t.name} COLLATE NOCASE`, t.edition)],
);
