import { type EntryRef, entryKey } from "@dnd/character";

type KeyedRow = { id: string } | { name: string; source: string };

export const searchHitRef = (row: KeyedRow): EntryRef =>
  "id" in row ? { homebrewId: row.id } : { name: row.name, source: row.source };

export const searchHitKey = (row: KeyedRow) => entryKey(searchHitRef(row));
