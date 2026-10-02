import type { SheetSpell } from "@dnd/catalog";
import { Tag } from "../../../../Tag.tsx";

/**
 * The die and the type share a chip only where the spell deals one type: the die is the
 * first roll the text prints, so beside two types it would claim both.
 */
export function SpellDamageChips({ spell }: { spell: Extract<SheetSpell, { resolved: true }> }) {
  const { damageDice: dice, damageTypes: types = [] } = spell;
  if (dice && types.length === 1) return <Tag>{`${dice} ${types[0]}`}</Tag>;
  return (
    <>
      {dice && <Tag>{dice}</Tag>}
      {types.length > 0 && <Tag>{types.join(", ")}</Tag>}
    </>
  );
}
