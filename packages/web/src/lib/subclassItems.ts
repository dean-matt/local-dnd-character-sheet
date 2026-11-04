import {
  HOMEBREW_SOURCE,
  type SubclassRecord,
  subclassLevelSchema,
  type subclassListItemSchema,
} from "@dnd/catalog";
import { type ContentRef, type EntryRef, entryKey } from "@dnd/character";
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

/**
 * The class a subclass list is read under: a catalog class as it is, a homebrew one by its
 * name and `HB` once its row loads, as the subclass list route names it.
 */
export const subclassParent = (
  cls: EntryRef,
  homebrew: { name: string } | undefined,
): ContentRef | undefined =>
  "name" in cls ? cls : homebrew && { name: homebrew.name, source: HOMEBREW_SOURCE };

/**
 * The level a class gains its subclass at, off the catalog row or the homebrew one, whichever
 * loaded.
 */
export const subclassLevelOf = (
  catalogJson: unknown,
  homebrew: { json: { subclassLevel?: number } } | undefined,
): number | undefined =>
  catalogJson ? subclassLevelSchema.parse(catalogJson) : homebrew?.json.subclassLevel;
