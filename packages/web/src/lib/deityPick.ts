/**
 * A deity picked from search, stored with its pantheon: two gods can share the rest of
 * their key, so a hit naming no pantheon cannot be picked.
 */
import type { SearchHit } from "@dnd/catalog";
import type { DeityRef, EntryRef } from "@dnd/character";

/** Why `hit` cannot be picked as a deity, or `undefined` where it can. */
export const deityUnavailable = (hit: SearchHit): string | undefined =>
  "qualifier" in hit && hit.qualifier ? undefined : "names no pantheon";

/** The deity `ref` and `hit` name, or `undefined` where the hit names no pantheon. */
export const deityOf = (ref: EntryRef, hit: SearchHit): DeityRef | undefined =>
  "name" in ref && "qualifier" in hit && hit.qualifier
    ? { ...ref, pantheon: hit.qualifier }
    : undefined;
