import type { SheetSpell } from "@dnd/catalog";
import { spellBeams, spellDamageDice } from "@dnd/character";
import { Tag } from "../../../../Tag.tsx";

/**
 * A cantrip shows the dice and beams for `characterLevel`. The die and the type share a chip
 * only where the spell deals one type: the die is the first roll the text prints, so beside
 * two types it would claim both.
 */
export function SpellDamageChips({
  spell,
  characterLevel,
}: {
  spell: Extract<SheetSpell, { resolved: true }>;
  characterLevel: number;
}) {
  const { damageTypes: types = [] } = spell;
  const dice = spellDamageDice(spell, spell.level, characterLevel);
  const beams = spellBeams(spell, characterLevel);
  return (
    <>
      {dice && types.length === 1 ? (
        <Tag>{`${dice} ${types[0]}`}</Tag>
      ) : (
        <>
          {dice && <Tag>{dice}</Tag>}
          {types.length > 0 && <Tag>{types.join(", ")}</Tag>}
        </>
      )}
      {beams && <Tag>{`${beams} beams`}</Tag>}
    </>
  );
}
