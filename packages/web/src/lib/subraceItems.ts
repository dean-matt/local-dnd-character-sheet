import type { subraceListItemSchema } from "@dnd/catalog";
import { type EntryRef, entryKey } from "@dnd/character";
import type { z } from "zod";

/** One subrace a race offers: a catalog row, or a homebrew one carrying its id. */
export type SubraceItem = z.infer<typeof subraceListItemSchema>;

/** The subrace as a character holds it. */
export const subraceRef = (item: SubraceItem): EntryRef =>
  "source" in item ? { name: item.name, source: item.source } : { homebrewId: item.id };

/** The item among `items` that `ref` names, `undefined` while either is. */
export const heldSubrace = (
  items: readonly SubraceItem[] | undefined,
  ref: EntryRef | undefined,
): SubraceItem | undefined =>
  ref && items?.find((item) => entryKey(subraceRef(item)) === entryKey(ref));

/** The subrace's name as a pick offers it, a homebrew one marked so. */
export const subraceLabel = (item: SubraceItem): string =>
  "source" in item ? item.name : `${item.name} (homebrew)`;

/**
 * Whether a race with these subraces may be taken without one: where the catalog offers
 * none or offers its unnamed base variant. A homebrew subrace is always optional.
 */
export const takenPlain = (items: readonly SubraceItem[]): boolean => {
  const catalog = items.filter((item) => "source" in item);
  return catalog.length === 0 || catalog.some((item) => item.name === "");
};
