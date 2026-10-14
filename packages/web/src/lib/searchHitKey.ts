import type { SearchHit } from "@dnd/catalog";
import { entryKey } from "@dnd/character";

/** The `entryKey` of the row a search hit names, catalog or homebrew. */
export const searchHitKey = (hit: SearchHit) =>
  entryKey("id" in hit ? { homebrewId: hit.id } : { name: hit.name, source: hit.source });
