import type { SheetSpell } from "@dnd/catalog";
import { type CharacterDerived, derivedValue, displayName, entryKey } from "@dnd/character";

type Caster = CharacterDerived["spellcasting"][number];

/**
 * The casting class a spell belongs to: the class its `origin` names, or for a pick with
 * none, the first class that casts, which a spell picked at creation was picked for. A
 * granted spell with no origin, such as a race's, belongs to none.
 */
export function spellCaster(
  spell: Pick<SheetSpell, "origin" | "granted">,
  casters: readonly Caster[],
): Caster | undefined {
  const { origin } = spell;
  if (origin) return casters.find((caster) => entryKey(caster.class) === entryKey(origin));
  return spell.granted ? undefined : casters[0];
}

export type PreparedTally = { name: string; prepared: number; limit: number };

/**
 * Each class that prepares, with how many leveled spells it has prepared against how many
 * it may. A granted spell is always prepared and counts against no limit.
 */
export function preparedTallies(
  spells: readonly SheetSpell[],
  casters: readonly Caster[],
): PreparedTally[] {
  return casters.flatMap((caster) => {
    if (!caster.preparedSpells) return [];
    const prepared = spells.filter(
      (spell) =>
        spell.resolved &&
        spell.level > 0 &&
        spell.prepared &&
        !spell.granted &&
        spellCaster(spell, casters) === caster,
    ).length;
    return [
      { name: displayName(caster.class), prepared, limit: derivedValue(caster.preparedSpells) },
    ];
  });
}
