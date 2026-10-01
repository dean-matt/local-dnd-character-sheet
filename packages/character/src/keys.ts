import type { ContentRef, EntryRef } from "./refs.ts";

/** The identity of a catalog row, flattened so a Map or a Set can hold it. */
export const refKey = (ref: ContentRef): string => `${ref.name}|${ref.source}`;

/** Rejects a list naming the same thing twice, where a duplicate would double-count. */
export const isUnique = <T>(items: T[], key: (item: T) => string): boolean =>
  new Set(items.map(key)).size === items.length;

/**
 * A reference flattened for comparison, tagged so a homebrew id cannot spell a catalog
 * pair. Exported because a caller building a catalog lookup keys it the same way.
 */
export const entryKey = (ref: EntryRef): string =>
  "homebrewId" in ref ? `homebrew|${ref.homebrewId}` : `catalog|${refKey(ref)}`;

/**
 * An inventory entry's item, which is its `ref` expanded by any `variant`: `Barding`
 * weighs twice the armor it expands, so a base item alone cannot key a weight.
 */
export const itemKey = (entry: { ref: EntryRef; variant?: ContentRef | undefined }): string =>
  entry.variant ? `${entryKey(entry.ref)}|variant|${refKey(entry.variant)}` : entryKey(entry.ref);
