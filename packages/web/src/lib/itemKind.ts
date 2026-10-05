import { ITEM_KINDS, type ItemHitFacts, type ItemKind } from "@dnd/catalog";

const LABELS: Record<ItemKind, string> = {
  melee: "Melee weapon",
  ranged: "Ranged weapon",
  ammunition: "Ammunition",
  light: "Light armor",
  medium: "Medium armor",
  heavy: "Heavy armor",
  shield: "Shield",
  potion: "Potion",
  scroll: "Scroll",
  ring: "Ring",
  wand: "Wand",
  rod: "Rod",
  staff: "Staff",
  wondrous: "Wondrous item",
  focus: "Spellcasting focus",
  gear: "Adventuring gear",
  tool: "Tool or instrument",
  treasure: "Treasure or trade good",
  other: "Other",
};

/** Each kind of item `/search` narrows to, in the order a filter offers them, beside its label. */
export const ITEM_KIND_OPTIONS = ITEM_KINDS.map((value) => ({ value, label: LABELS[value] }));

/** The kinds the Mechanics menu's Weapons and Armor entries narrow items to. */
export const WEAPON_KINDS: readonly ItemKind[] = ["melee", "ranged"];
export const ARMOR_KINDS: readonly ItemKind[] = ["light", "medium", "heavy", "shield"];

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * The line under an item hit's name: its kind, then its rarity, as `Martial ranged weapon •
 * Uncommon`. An item of two kinds leads with the kind its type code gives, ahead of a
 * `staff` or `wondrous` flag, so Staff of Power reads as a melee weapon and Instrument of the
 * Bards as a tool; a mundane item's rarity of `none` is left off.
 */
export function itemMeta({ kinds, rarity, category }: ItemHitFacts): string {
  const [kind = "other"] = kinds;
  const weapon = kind === "melee" || kind === "ranged";
  const lead =
    weapon && category ? `${capitalize(category)} ${LABELS[kind].toLowerCase()}` : LABELS[kind];
  return rarity && rarity !== "none" ? `${lead} • ${capitalize(rarity)}` : lead;
}
