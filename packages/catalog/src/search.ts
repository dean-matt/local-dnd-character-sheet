/**
 * A hit from `/search`: one row from `content.db`'s Tier A tables, one from its Tier C
 * `entities`, or one from `homebrew.db`. A homebrew hit carries `id` and no `source` — the
 * structural difference `item.ts` and `spell.ts` already use so a caller tells the two
 * apart without reading a field's value.
 */
import { EDITIONS } from "@dnd/rules";
import { z } from "zod";
import { itemHitFactsSchema } from "./item-kind.ts";

/**
 * The Tier A types this endpoint searches, each addressed by `(name, source)` alone.
 * Subclasses and subraces carry a compound key beyond that — the class or race that owns
 * them — so a search narrows within a chosen parent instead, and a future search reaching
 * them widens this list.
 */
const CATALOG_SEARCH_TYPES = [
  "spell",
  "item",
  "race",
  "background",
  "feat",
  "class",
  "optfeature",
] as const;

export type CatalogSearchType = (typeof CATALOG_SEARCH_TYPES)[number];

/** A catalog hit, Tier A or Tier C, addressed by `(name, source)`. */
export const catalogSearchHitSchema = z.strictObject({
  type: z.string().min(1),
  name: z.string().min(1),
  source: z.string().min(1),
  edition: z.enum(EDITIONS).nullable(),
  /** Present on an item hit alone. */
  item: itemHitFactsSchema.optional(),
});

/** The two homebrew tables a search reads — `homebrew.db` carries no others. */
const HOMEBREW_SEARCH_TYPES = ["item", "spell"] as const;

/** A homebrew hit, addressed by `id` rather than `(name, source)`. */
export const homebrewSearchHitSchema = z.strictObject({
  type: z.enum(HOMEBREW_SEARCH_TYPES),
  id: z.string(),
  name: z.string().min(1),
  edition: z.enum(EDITIONS),
  /** Present on an item hit alone. */
  item: itemHitFactsSchema.optional(),
});

export const searchHitSchema = z.union([catalogSearchHitSchema, homebrewSearchHitSchema]);

export type SearchHit = z.infer<typeof searchHitSchema>;

/** One page of `/search`, bounded by `limit` and `offset`; `total` counts every match. */
export const searchResponseSchema = z.object({
  items: z.array(searchHitSchema),
  total: z.int(),
  limit: z.int(),
  offset: z.int(),
});

/**
 * How closely a hit's name matches the term: the whole name, then a name starting with it,
 * then a name holding it, then a hit that matched only on its text. Lower ranks first.
 */
function nameMatchRank(name: string, term: string): number {
  const lower = name.toLowerCase();
  if (lower === term) return 0;
  if (lower.startsWith(term)) return 1;
  if (lower.includes(term)) return 2;
  return 3;
}

/**
 * Orders `/search` hits for `term`: by how closely the name matches, then the shorter name,
 * since a name with less beyond the term is the nearer match, then alphabetically. A blank
 * term, which lists rows rather than searching them, sorts alphabetically alone.
 */
export function compareSearchHits(term: string): (a: SearchHit, b: SearchHit) => number {
  const needle = term.trim().toLowerCase();
  if (needle === "") return (a, b) => a.name.localeCompare(b.name);
  return (a, b) =>
    nameMatchRank(a.name, needle) - nameMatchRank(b.name, needle) ||
    a.name.length - b.name.length ||
    a.name.localeCompare(b.name);
}
