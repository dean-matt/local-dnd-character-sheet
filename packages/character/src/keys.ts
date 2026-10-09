import type { ContentRef, DeityRef, EntryRef, FeatureKey } from "./refs.ts";

/**
 * The identity of a catalog row, flattened so a Map or a Set can hold it. A deity reference
 * fails to compile here, since its pair alone names two gods; `deityKey` takes it instead.
 */
export const refKey = (ref: ContentRef & { pantheon?: never }): string =>
  `${ref.name}|${ref.source}`;

/** A deity's identity, its pantheon included: `Oghma|PHB` is both the Celtic and the Faerûnian god. */
export const deityKey = (ref: DeityRef): string => `${ref.name}|${ref.source}|${ref.pantheon}`;

/** A feature's whole key, flattened: one name and source recurs across classes and levels. */
export const featureKey = (key: FeatureKey): string =>
  [
    key.name,
    key.source,
    key.className,
    key.classSource,
    key.subclass?.shortName ?? "",
    key.subclass?.source ?? "",
    key.level,
  ].join("|");

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
