/**
 * Schema for `homebrew.db` — your custom items and spells.
 *
 * Kept apart from `content.db` so the catalog stays disposable: rebuilding the
 * official content can never touch your homebrew. Rows carry source "HB" and are
 * merged with catalog rows at query time.
 *
 * `json` holds the 5etools entry shape `@dnd/catalog` defines, not a shape of our own —
 * see `docs/data-model.md` for why.
 */
import type { HomebrewItem, HomebrewSpell } from "@dnd/catalog";
import { EDITIONS } from "@dnd/rules";
import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const HOMEBREW_SOURCE = "HB";

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
  (t) => [index("homebrew_items_by_name").on(t.name)],
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
    json: text("json", { mode: "json" }).$type<HomebrewSpell>().notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  },
  (t) => [index("homebrew_spells_by_name").on(t.name)],
);
