import type { SheetItem } from "@dnd/catalog";

type ResolvedItem = Extract<SheetItem, { resolved: true }>;

/** Upstream prices in copper; a price prints in the largest coin that divides it evenly. */
function coin(copper: number): string {
  const [name, per] = (
    [
      ["gp", 100],
      ["sp", 10],
    ] as const
  ).find(([, size]) => copper % size === 0) ?? ["cp", 1];
  return `${(copper / per).toLocaleString("en-US")} ${name}`;
}

const gold = (copper: number) =>
  (copper / 100).toLocaleString("en-US", { maximumFractionDigits: 2 });

/**
 * The cost chip's text for the whole stack, and `note` where the price is a rarity
 * table's estimate and not the item's own. A range keeps its bounds in gold, since
 * halving a consumable's range lands between coins.
 */
export function itemPrice(item: ResolvedItem): { text: string; note?: string } | undefined {
  const { value, estimate, quantity } = item;
  if (value !== null) return { text: coin(value * quantity) };
  if (!estimate) return undefined;
  const note = `Estimated from the ${estimate.table} table`;
  switch (estimate.kind) {
    case "amount":
      return { text: `~${coin(estimate.copper * quantity)}`, note };
    case "range": {
      const min = gold(estimate.min * quantity);
      const text =
        estimate.max === null ? `${min}+ gp` : `${min}–${gold(estimate.max * quantity)} gp`;
      return { text: `~${text}`, note };
    }
    case "priceless":
      return { text: "Priceless", note };
  }
}
