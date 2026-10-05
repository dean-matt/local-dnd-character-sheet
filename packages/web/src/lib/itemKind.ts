import { ITEM_KINDS, type ItemKind } from "@dnd/catalog";

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
