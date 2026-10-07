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
  /** Each slot's pick, by `slotKey`. */
  slots: Record<string, EntryRef>;
  /** The gold pieces rolled for the gold alternative, taken in place of every group. */
  gold?: number;
};

/**
 * The picks, which the definition cannot store, and the inventory entries they last
 * landed, so a changed pick takes back exactly what the last one put there and leaves
 * what the player added by hand.
 */
export type EquipmentMemory = {
  picks: Partial<Record<EquipmentSource["by"], SourcePicks>>;
  landed: InventoryEntry[];
  /** The name of each item picked through a picker, by `entryKey`, since a homebrew reference carries none. */
  names: Record<string, string>;
};

export const slotKey = (group: number, option: string, item: number) =>
  `${group}:${option}:${item}`;

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
    const ref = item.kind === "item" ? item.ref : picks.slots[slotKey(index, option.key, at)];
    return ref ? [entry(ref, item.quantity)] : [];
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
  const inventory: InventoryEntry[] = [];
  let copper = 0;
  for (const source of sources) {
    const picks = picksFor(memory, source);
    if (picks.gold !== undefined && source.goldAlternative) {
      copper += picks.gold * 100;
      continue;
    }
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

/**
 * Picks read back off an inventory, for a flow that lost them to a reload: each group's
 * first option whose items are all held. An option of coins alone, a slot's pick and the
 * gold alternative leave nothing to read, so they come back unpicked. What the picks
 * would land counts as landed only where the inventory holds it.
 */
export function inferMemory(
  sources: readonly EquipmentSource[],
  inventory: readonly InventoryEntry[],
): EquipmentMemory {
  const held = new Set(inventory.map((each) => itemKey(each)));
  const picks: EquipmentMemory["picks"] = {};
  for (const source of sources) {
    const options: Record<number, string> = {};
    source.groups.forEach((group, index) => {
      if (group.length < 2) return;
      const found = group.find((option) => {
        const refs = option.items.flatMap((item) =>
          item.kind === "item" && item.ref ? [item.ref] : [],
        );
        return refs.length > 0 && refs.every((ref) => held.has(itemKey({ ref })));
      });
      if (found) options[index] = found.key;
    });
    picks[source.by] = { row: source.row, options, slots: {} };
  }
  const target = landing(sources, { picks, landed: [], names: {} }).inventory;
  const missing = withoutLanded(target, inventory);
  return { picks, landed: withoutLanded(target, missing), names: {} };
}

/** Whether every source's choices are made: the gold alternative, or every group picked and every slot filled. */
export function isComplete(sources: readonly EquipmentSource[], memory: EquipmentMemory): boolean {
  return sources.every((source) => {
    const picks = picksFor(memory, source);
    if (picks.gold !== undefined && source.goldAlternative) return true;
    return source.groups.every((group, index) => {
      const option = chosenOption(group, index, picks);
      return (
        option?.items.every(
          (item, at) => item.kind !== "type" || picks.slots[slotKey(index, option.key, at)],
        ) === true
      );
    });
  });
}
