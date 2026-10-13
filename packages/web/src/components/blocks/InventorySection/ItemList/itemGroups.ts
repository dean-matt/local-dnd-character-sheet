import { ITEM_KINDS, type SheetItem } from "@dnd/catalog";

export const GROUPS = ["Weapons", "Armor", "Gear"] as const;

export type Group = (typeof GROUPS)[number];

const GROUP_OF_TYPE: Record<string, Group> = {
  M: "Weapons",
  R: "Weapons",
  LA: "Armor",
  MA: "Armor",
  HA: "Armor",
  S: "Armor",
};

/** An item nothing resolves has no type to sort by, so it lands in Gear. */
export const groupOf = (item: SheetItem): Group =>
  (item.resolved && item.type && GROUP_OF_TYPE[item.type.abbreviation]) || "Gear";

const ARMS = ["melee", "ranged", "light", "medium", "heavy", "shield"];

/**
 * The `/search` kinds that find each group's items. A search matches an item holding any
 * kind named, so Gear's also finds a weapon that is a staff or a wondrous item too, such as
 * a Staff of Power; narrowing it exactly needs `/search` to exclude a kind.
 */
export const GROUP_KINDS: Record<Group, string> = {
  Weapons: "melee,ranged",
  Armor: "light,medium,heavy,shield",
  Gear: ITEM_KINDS.filter((kind) => !ARMS.includes(kind)).join(","),
};
