import { type EntryRef, entryKey } from "@dnd/character";

/** A catalog row keyed `(name, source)` or a homebrew row keyed by `id`, as a search hit or a record. */
type KeyedRow = { id: string } | { name: string; source: string };

/** The reference to the row a search hit or record names, catalog or homebrew. */
export const searchHitRef = (row: KeyedRow): EntryRef =>
  "id" in row ? { homebrewId: row.id } : { name: row.name, source: row.source };

/** The `entryKey` of the row a search hit or record names. */
export const searchHitKey = (row: KeyedRow) => entryKey(searchHitRef(row));
