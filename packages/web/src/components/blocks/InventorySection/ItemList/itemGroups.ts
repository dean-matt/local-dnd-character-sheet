import { ITEM_KINDS, type SheetItem } from "@dnd/catalog";
import { capitalize } from "../../../../lib/capitalize.ts";
import type { Facet } from "../../../Filter/facets.ts";

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

const WEAPONS = ["melee", "ranged"];
const ARMOR = ["light", "medium", "heavy", "shield"];

/**
 * The `/search` kinds that find each group's items. A search matches an item holding any
 * kind named, so Gear's also finds a weapon that is a staff or a wondrous item, such as a
 * Staff of Power; narrowing it exactly needs `/search` to exclude a kind.
 */
export const GROUP_KINDS: Record<Group, string> = {
  Weapons: WEAPONS.join(","),
  Armor: ARMOR.join(","),
  Gear: ITEM_KINDS.filter((kind) => !WEAPONS.includes(kind) && !ARMOR.includes(kind)).join(","),
};

/** The facets each card's Filter offers, each valued by what a row's item states. */
export const GROUP_FACETS: Record<Group, readonly Facet<SheetItem>[]> = {
  Weapons: [
    {
      key: "class",
      label: "Weapon class",
      valuesOf: (item) =>
        item.resolved && item.weapon?.category ? [capitalize(item.weapon.category)] : [],
    },
    {
      key: "damage",
      label: "Damage type",
      valuesOf: (item) =>
        item.resolved && item.weapon?.damage?.type ? [capitalize(item.weapon.damage.type)] : [],
    },
  ],
  Armor: [
    {
      key: "class",
      label: "Armor class",
      valuesOf: (item) => (item.resolved && item.armor ? [capitalize(item.armor.category)] : []),
    },
  ],
  Gear: [
    {
      key: "category",
      label: "Category",
      valuesOf: (item) => (item.resolved && item.type?.name ? [item.type.name] : []),
    },
  ],
};
