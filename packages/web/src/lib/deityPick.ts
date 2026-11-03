/**
 * A deity picked from search, stored with its pantheon: two gods can share the rest of
 * their key, so a hit naming no pantheon cannot be picked. A homebrew deity is stored as
 * `(name, "HB", pantheon)`, the key its table holds unique.
 */
import { HOMEBREW_SOURCE, type SearchHit } from "@dnd/catalog";
import type { DeityRef } from "@dnd/character";

/** Why `hit` cannot be picked as a deity, or `undefined` where it can. */
export const deityUnavailable = (hit: SearchHit): string | undefined =>
  hit.qualifier ? undefined : "names no pantheon";

/** The deity `hit` names, or `undefined` where it names no pantheon. */
export const deityOf = (hit: SearchHit): DeityRef | undefined =>
  hit.qualifier
    ? {
        name: hit.name,
        source: "source" in hit ? hit.source : HOMEBREW_SOURCE,
        pantheon: hit.qualifier,
      }
    : undefined;
