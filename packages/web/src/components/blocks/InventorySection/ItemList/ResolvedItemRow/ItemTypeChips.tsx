import type { SheetItem } from "@dnd/catalog";
import { Tag } from "../../../../Tag.tsx";
import { capitalize } from "../../../capitalize.ts";

type ResolvedItem = Extract<SheetItem, { resolved: true }>;

/**
 * The facts a row's type prints: a weapon's category and die, an armor's category and AC.
 * A weapon with an attack leaves its die to the damage chip.
 */
export function ItemTypeChips({ item, attacks }: { item: ResolvedItem; attacks: boolean }) {
  if (item.weapon) {
    const { category, damage } = item.weapon;
    return (
      <>
        {category && <Tag>{capitalize(category)}</Tag>}
        {damage && !attacks && <Tag>{damage.dice}</Tag>}
        {damage?.type && <Tag>{damage.type}</Tag>}
      </>
    );
  }
  if (item.armor) {
    const { category, armorClass } = item.armor;
    return (
      <>
        <Tag>{capitalize(category)}</Tag>
        <Tag>AC {category === "shield" ? `+${armorClass}` : armorClass}</Tag>
      </>
    );
  }
  return item.type?.name ? <Tag>{item.type.name}</Tag> : null;
}
