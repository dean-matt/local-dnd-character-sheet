import type { SearchHit } from "@dnd/catalog";
import { type EntryRef, entryKey } from "@dnd/character";

/** The reference to the row a search hit names, catalog or homebrew. */
export const searchHitRef = (hit: SearchHit): EntryRef =>
  "id" in hit ? { homebrewId: hit.id } : { name: hit.name, source: hit.source };

/** The `entryKey` of the row a search hit names. */
export const searchHitKey = (hit: SearchHit) => entryKey(searchHitRef(hit));
