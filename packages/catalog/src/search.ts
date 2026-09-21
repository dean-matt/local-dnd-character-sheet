/**
 * A hit from `/search`: one row from `content.db`'s Tier A tables, one from its Tier C
 * `entities`, or one from `homebrew.db`. A homebrew hit carries `id` and no `source` — the
 * structural difference `item.ts` and `spell.ts` already use so a caller tells the two
 * apart without reading a field's value.
 */
import { EDITIONS } from "@dnd/rules";
import { z } from "zod";

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
});

/** The two homebrew tables a search reads — `homebrew.db` carries no others. */
const HOMEBREW_SEARCH_TYPES = ["item", "spell"] as const;

/** A homebrew hit, addressed by `id` rather than `(name, source)`. */
export const homebrewSearchHitSchema = z.strictObject({
  type: z.enum(HOMEBREW_SEARCH_TYPES),
  id: z.string(),
  name: z.string().min(1),
  edition: z.enum(EDITIONS),
});

export const searchHitSchema = z.union([catalogSearchHitSchema, homebrewSearchHitSchema]);

export type SearchHit = z.infer<typeof searchHitSchema>;
