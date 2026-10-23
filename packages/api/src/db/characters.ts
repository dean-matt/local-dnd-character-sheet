/**
 * Schema for `characters.db` — your data. Backed up, migrated, never regenerated.
 *
 * `characters` holds who the character is; `character_state` holds what is true right
 * now. A long rest touches state only, so it can never corrupt the sheet. Derived values
 * are computed on read, and the ones a user has edited live in the definition.
 *
 * Cascading deletes need `PRAGMA foreign_keys = ON`, which SQLite leaves off by
 * default. Open these databases through `./client.ts`, never directly.
 */
import { EDITIONS } from "@dnd/rules";
import { sql } from "drizzle-orm";
import {
  blob,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const characters = sqliteTable("characters", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  edition: text("edition", { enum: EDITIONS }).notNull(),
  level: integer("level").notNull(),
  raceSummary: text("race_summary").notNull(),
  classSummary: text("class_summary").notNull(),
  definition: text("definition", { mode: "json" }).notNull(),
  /**
   * When `character_portraits` last changed for this character, null with no portrait. A
   * client keys the image URL on it; a portrait write leaves `updatedAt`, which
   * `If-Unmodified-Since` reads, alone.
   */
  portraitUpdatedAt: integer("portrait_updated_at", { mode: "timestamp_ms" }),
  /** Whether `character_portraits_previous` holds an image to restore. */
  hasPreviousPortrait: integer("has_previous_portrait", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

export const characterState = sqliteTable("character_state", {
  characterId: text("character_id")
    .primaryKey()
    .references(() => characters.id, { onDelete: "cascade" }),
  state: text("state", { mode: "json" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

/** The uploaded image behind a character's avatar, kept apart so a list read never loads it. */
export const characterPortraits = sqliteTable("character_portraits", {
  characterId: text("character_id")
    .primaryKey()
    .references(() => characters.id, { onDelete: "cascade" }),
  mediaType: text("media_type").notNull(),
  image: blob("image", { mode: "buffer" }).notNull(),
});

/** The one portrait the last upload or removal displaced, kept so the user can restore it. */
export const characterPortraitsPrevious = sqliteTable("character_portraits_previous", {
  characterId: text("character_id")
    .primaryKey()
    .references(() => characters.id, { onDelete: "cascade" }),
  mediaType: text("media_type").notNull(),
  image: blob("image", { mode: "buffer" }).notNull(),
});

/**
 * A character's pages, in `position` order. `slug` is the key a URL carries. `preset`
 * caches whether `PRESET_PAGES` seeds the slug: every write sets it from the slug, and
 * restoring the defaults reads the slug rather than the flag.
 */
export const characterPages = sqliteTable(
  "character_pages",
  {
    characterId: text("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    position: integer("position").notNull(),
    hidden: integer("hidden", { mode: "boolean" }).notNull().default(false),
    preset: integer("preset", { mode: "boolean" }).notNull().default(false),
    blocks: text("blocks", { mode: "json" }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.characterId, t.slug] }),
    uniqueIndex("character_pages_by_position").on(t.characterId, t.position),
  ],
);

/** Bounded: the newest 200 rows per character are kept, older ones pruned on insert. */
export const rollLog = sqliteTable(
  "roll_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    characterId: text("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    notation: text("notation").notNull(),
    result: integer("result").notNull(),
    detail: text("detail", { mode: "json" }).notNull(),
    rolledAt: integer("rolled_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (t) => [index("roll_log_by_character").on(t.characterId, t.id)],
);

/** Bounded by `UNDO_LOG_LIMIT` from `@dnd/character`, pruned on insert. Session affordance, not an audit trail. */
export const undoLog = sqliteTable(
  "undo_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    characterId: text("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    /** The whole definition the write replaced, not `character_state`, which undo never reaches. */
    previousState: text("previous_state", { mode: "json" }).notNull(),
    describedAs: text("described_as").notNull(),
    changedAt: integer("changed_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    /** Set where its write asked to be its own entry, so no later write merges into it. */
    sealed: integer("sealed", { mode: "boolean" }).notNull().default(false),
  },
  (t) => [index("undo_log_by_character").on(t.characterId, t.id)],
);

export const ROLL_LOG_LIMIT = 200;
