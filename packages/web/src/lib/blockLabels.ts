import type {
  ListBlockSource,
  ListFilter,
  PageBlock,
  SheetSection,
  ValueBlockField,
} from "@dnd/character";
import { levelLabel } from "./spellLevel.ts";

export const SECTION_LABELS: Record<SheetSection, string> = {
  abilities: "Abilities",
  spells: "Spells",
  inventory: "Inventory",
  features: "Features",
  identity: "Identity",
  level: "Level",
  backstory: "Backstory",
  notes: "Notes",
};

export const VALUE_LABELS: Record<ValueBlockField, string> = {
  hitPointMaximum: "Hit Point Maximum",
  armorClass: "Armor Class",
  initiative: "Initiative",
  proficiencyBonus: "Proficiency Bonus",
};

export const SOURCE_LABELS: Record<ListBlockSource, string> = {
  spells: "Spells",
  inventory: "Inventory",
  features: "Features",
};

/** The filter in words, such as "prepared, 1st Level, matching “fire”", or "" for none. */
export function describeFilter(filter: ListFilter): string {
  return [
    filter.prepared && "prepared",
    filter.equipped && "equipped",
    ...(filter.levels ?? []).map(levelLabel),
    filter.search && `matching “${filter.search}”`,
  ]
    .filter(Boolean)
    .join(", ");
}

/** What a block shows, in the words its editor row and its announcements use. */
export function blockLabel(block: PageBlock): string {
  switch (block.kind) {
    case "section":
      return `${SECTION_LABELS[block.section]} section`;
    case "value":
      return VALUE_LABELS[block.field];
    case "list":
      return `${SOURCE_LABELS[block.source]} list`;
    case "text":
      return "Text";
    case "unknown":
      return "Unrecognized block";
  }
}
