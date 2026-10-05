import type { SearchHit } from "@dnd/catalog";
import type { CharacterRecord } from "@dnd/character";

/** One row of the global search: a character, or a catalog or homebrew hit. */
export type SearchResult = { key: string } & (
  | { character: CharacterRecord }
  | { hit: SearchHit; address: string }
);
