import type { SubclassRecord, subclassListItemSchema } from "@dnd/catalog";
import { type EntryRef, entryKey } from "@dnd/character";
import type { z } from "zod";

/** One subclass a class offers: a catalog row, or a homebrew one carrying its id. */
export type SubclassItem = z.infer<typeof subclassListItemSchema>;

/** The subclass as a character's level holds it. */
export const subclassRef = (item: SubclassItem): EntryRef =>
  "source" in item ? { name: item.name, source: item.source } : { homebrewId: item.id };

/** The subclass's name as a pick offers it, a homebrew one marked so. */
export const subclassLabel = (item: SubclassItem): string =>
  "source" in item ? item.name : `${item.name} (homebrew)`;

/** The catalog row `ref` names among `items`; a homebrew subclass has none. */
export const catalogSubclassRow = (
  items: readonly SubclassItem[] | undefined,
  ref: EntryRef | undefined,
): SubclassRecord | undefined =>
  ref === undefined || "homebrewId" in ref
    ? undefined
    : items?.find(
        (item): item is SubclassRecord =>
          "source" in item && entryKey(subclassRef(item)) === entryKey(ref),
      );
