import type { CharacterDefinition, ContentRef, EntryRef } from "@dnd/character";
import { itemKey } from "@dnd/character";

type InventoryEntry = CharacterDefinition["inventory"][number];

/**
 * One thing an option hands over, its item resolved against the catalog: `ref` is
 * `undefined` where no row answers, such as a quill, and such a thing lands nowhere.
 * `type` asks the player for any one item of a kind, picked into a slot.
 */
export type OfferedItem =
  | { kind: "item"; ref: ContentRef | undefined; label: string; quantity: number }
  | { kind: "type"; types: string[]; quantity: number }
  | { kind: "money"; copper: number };

export type OfferedOption = { key: string; items: OfferedItem[] };

/** A class's or a background's starting equipment, a group of one option given outright. */
export type EquipmentSource = {
  by: "Class" | "Background";
  /** The row's key, so a pick made under one class is never read under another. */
  row: string;
  name: string;
  groups: OfferedOption[][];
  goldAlternative?: { dice: string; multiplier: number };
};

/** What the player picked from one source. */
export type SourcePicks = {
  row: string;
  /** Each group's chosen option key, by the group's index. */
  options: Record<number, string>;
  /** Each slot's pick, by one of `slotKeys`. */
  slots: Record<string, EntryRef>;
};

/**
 * The picks, which the definition cannot store, and the inventory entries they last
 * landed, so a changed pick takes back exactly what the last one put there and leaves
 * what the player added by hand.
 */
export type EquipmentMemory = {
  picks: Partial<Record<EquipmentSource["by"], SourcePicks>>;
  /**
   * The gold pieces rolled for a classic class's gold alternative, under the class's row,
   * taken in place of the class's and the background's equipment alike.
   */
  gold?: { row: string; gp: number };
  landed: InventoryEntry[];
  /** The name of each item picked through a picker, by `entryKey`, since a homebrew reference carries none. */
  names: Record<string, string>;
};

/**
 * The slots a `type` item opens, one per copy, so two martial weapons can be a longsword
 * and a battleaxe.
 */
export const slotKeys = (group: number, option: string, item: number, quantity: number) =>
  Array.from({ length: quantity }, (_, copy) => `${group}:${option}:${item}:${copy}`);

/** Where `departures` notes the items added past what the lists offer. */
export const INVENTORY_FIELD = "inventory";

export const NO_EQUIPMENT: EquipmentMemory = { picks: {}, landed: [], names: {} };

/** The gold `memory` takes in place of all the equipment, or `undefined` where the class offers no such gold or it is not taken. */
export function goldTaken(sources: readonly EquipmentSource[], memory: EquipmentMemory) {
  const cls = sources.find((source) => source.by === "Class");
  return cls?.goldAlternative && memory.gold?.row === cls.row ? memory.gold.gp : undefined;
}

/** The picks `memory` holds for `source`, or none where they were made under another row. */
export function picksFor(memory: EquipmentMemory, source: EquipmentSource): SourcePicks {
  const held = memory.picks[source.by];
  return held?.row === source.row ? held : { row: source.row, options: {}, slots: {} };
}

/** The option `picks` takes from a group: its only one, or the one the player chose. */
export function chosenOption(group: OfferedOption[], index: number, picks: SourcePicks) {
  return group.length === 1
    ? group[0]
    : group.find((option) => option.key === picks.options[index]);
}

const entry = (ref: EntryRef, quantity: number): InventoryEntry => ({
  ref,
  quantity,
  carried: true,
  equipped: false,
  attuned: false,
});

/** What one chosen option hands over, `index` its group's place in the list. */
function optionLanding(option: OfferedOption, index: number, picks: SourcePicks) {
  const inventory = option.items.flatMap((item, at) => {
    if (item.kind === "money") return [];
    if (item.kind === "item") return item.ref ? [entry(item.ref, item.quantity)] : [];
    return slotKeys(index, option.key, at, item.quantity).flatMap((key) => {
      const slot = picks.slots[key];
      return slot ? [entry(slot, 1)] : [];
    });
  });
  const copper = option.items.reduce(
    (sum, item) => sum + (item.kind === "money" ? item.copper : 0),
    0,
  );
  return { inventory, copper };
}

/** What the picks hand over: inventory entries, in the order the lists give them, and coins in copper. */
export function landing(
  sources: readonly EquipmentSource[],
  memory: EquipmentMemory,
): { inventory: InventoryEntry[]; copper: number } {
  const gold = goldTaken(sources, memory);
  if (gold !== undefined) return { inventory: [], copper: gold * 100 };
  const inventory: InventoryEntry[] = [];
  let copper = 0;
  for (const source of sources) {
    const picks = picksFor(memory, source);
    source.groups.forEach((group, index) => {
      const option = chosenOption(group, index, picks);
      if (option === undefined) return;
      const landed = optionLanding(option, index, picks);
      inventory.push(...landed.inventory);
      copper += landed.copper;
    });
  }
  return { inventory, copper };
}

/** Copper as the coins a purse holds, the fewest coins below platinum. */
export const coins = (copper: number): CharacterDefinition["money"] => ({
  copper: copper % 10,
  silver: Math.floor((copper % 100) / 10),
  electrum: 0,
  gold: Math.floor(copper / 100),
  platinum: 0,
});

const same = (a: InventoryEntry, b: InventoryEntry) =>
  itemKey(a) === itemKey(b) && a.quantity === b.quantity;

/** `inventory` with one entry taken out for each of `landed`, which leaves what the player added. */
export function withoutLanded(
  inventory: readonly InventoryEntry[],
  landed: readonly InventoryEntry[],
): InventoryEntry[] {
  const rest = [...inventory];
  for (const each of landed) {
    const at = rest.findIndex((held) => same(held, each));
    if (at !== -1) rest.splice(at, 1);
  }
  return rest;
}

/** Whether every source's choices are made: the gold alternative, or every group picked and every slot filled. */
export function isComplete(sources: readonly EquipmentSource[], memory: EquipmentMemory): boolean {
  if (goldTaken(sources, memory) !== undefined) return true;
  return sources.every((source) => {
    const picks = picksFor(memory, source);
    return source.groups.every((group, index) => {
      const option = chosenOption(group, index, picks);
      return (
        option?.items.every(
          (item, at) =>
            item.kind !== "type" ||
            slotKeys(index, option.key, at, item.quantity).every((key) => picks.slots[key]),
        ) === true
      );
    });
  });
}
