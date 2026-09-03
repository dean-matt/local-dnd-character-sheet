/**
 * Schema for `characters.db` — your data. Backed up, migrated, never regenerated.
 *
 * Two deliberate splits:
 *
 *   definition vs state   `characters` holds who the character is; `character_state`
 *                         holds what is true right now. A long rest touches state
 *                         only, so it can never corrupt the sheet.
 *   computed vs manual    derived numbers are computed on read; `field_overrides`
 *                         holds only the values a user has edited. An absent row
 *                         means "use the computed value", so a level-up recomputes
 *                         without stomping an edit.
 *
 * Cascading deletes need `PRAGMA foreign_keys = ON`, which SQLite leaves off by
 * default. Open these databases through `./client.ts`, never directly.
 */
import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const characters = sqliteTable("characters", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  edition: text("edition", { enum: ["classic", "one"] }).notNull(),
  level: integer("level").notNull(),
  definition: text("definition", { mode: "json" }).notNull(),
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

/** Derived fields the user has overridden. Absent row means "use the computed value". */
export const fieldOverrides = sqliteTable(
  "field_overrides",
  {
    characterId: text("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    field: text("field").notNull(),
    value: text("value").notNull(),
  },
  (t) => [primaryKey({ columns: [t.characterId, t.field] })],
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

/** Bounded: the newest 50 rows per character are kept. Session affordance, not an audit trail. */
export const undoLog = sqliteTable(
  "undo_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    characterId: text("character_id")
      .notNull()
      .references(() => characters.id, { onDelete: "cascade" }),
    previousState: text("previous_state", { mode: "json" }).notNull(),
    describedAs: text("described_as").notNull(),
    changedAt: integer("changed_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (t) => [index("undo_log_by_character").on(t.characterId, t.id)],
);

export const ROLL_LOG_LIMIT = 200;
export const UNDO_LOG_LIMIT = 50;
