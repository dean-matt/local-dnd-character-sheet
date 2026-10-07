import { type EntryRef, entryKey } from "@dnd/character";
import type { OfferedItem, OfferedOption } from "./equipmentPicks.ts";
import { typeLabel } from "./equipmentTypes.ts";

/** Coins as the largest denomination that counts them whole: `5 gp`, `15 sp`. */
function copperLabel(copper: number): string {
  if (copper % 100 === 0) return `${copper / 100} gp`;
  return copper % 10 === 0 ? `${copper / 10} sp` : `${copper} cp`;
}

/** One thing an option hands over, as the list prints it, marked where no row answers it. */
function itemLabel(item: OfferedItem): string {
  if (item.kind === "money") return copperLabel(item.copper);
  const name =
    item.kind === "type"
      ? typeLabel(item.types)
      : `${item.label}${item.ref ? "" : " (not in the catalog)"}`;
  return item.quantity > 1 ? `${item.quantity} × ${name}` : name;
}

/** Everything an option hands over, as one line. */
export const optionLabel = (option: OfferedOption): string =>
  option.items.map(itemLabel).join(", ") || "nothing";

/** An item picked through a picker, by the name it was picked under where the flow still holds it. */
export const pickedName = (ref: EntryRef, names: Record<string, string>): string =>
  names[entryKey(ref)] ?? ("name" in ref ? ref.name : "a homebrew item");
