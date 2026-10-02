import type { SearchHit } from "@dnd/catalog";
import type { CharacterRecord } from "@dnd/character";

/**
 * One row of the global search: a character, or a catalog or homebrew hit. `path` is
 * `undefined` for a hit the web has no detail route for.
 */
export type SearchResult = { key: string; path: string | undefined } & (
  | { character: CharacterRecord }
  | { hit: SearchHit }
);
