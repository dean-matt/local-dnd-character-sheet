/**
 * What held features do to saving throws, checks, initiative and death saves, read from their
 * recorded `roll` mechanics: advantage as roll effects, a bonus that always holds as a term on
 * the roll, and a bonus that holds only `against` something as an option the roll offers.
 */
import type { Term } from "@dnd/rules";
import type { RollEffectEntry, RollOption } from "./characterDerived.ts";
import type { TermReference } from "./derivedField.ts";
import { type Mechanic, mechanicsOfKind } from "./featureMechanics.ts";
import { type Held, type HoldsFeatures, heldFeatures } from "./heldFeatures.ts";
import type { Ability } from "./refs.ts";

type RollMechanic = Extract<Mechanic, { kind: "roll" }>;

/** A bonus that always holds, on the saves of `target` or every save, or on the skill `target` names. */
export type FeatureRollBonus = {
  roll: "save" | "skill";
  target?: string;
  term: Term<TermReference>;
};

/** Each roll a mechanic marks: one per ability or skill it names, or one for every such roll. */
function targetsOf({ roll, abilities, skills }: RollMechanic) {
  if (roll === "check" && skills)
    return skills.map((target) => ({ roll: "skill" as const, target }));
  return (abilities ?? [undefined]).map((target) => ({ roll, ...(target && { target }) }));
}

type FeatureRolls = {
  effects: RollEffectEntry[];
  bonuses: FeatureRollBonus[];
  options: RollOption[];
};

const bonusValue = (
  bonus: NonNullable<RollMechanic["bonus"]>,
  levels: number,
  modifier: (ability: Ability) => number,
) => {
  if (bonus === "level") return levels;
  return typeof bonus === "number" ? bonus : Math.max(1, modifier(bonus));
};

/** Adds what one mechanic of the held feature `held` gives to `into`. */
function addMechanic(
  into: FeatureRolls,
  { ref, levels }: Held,
  mechanic: RollMechanic,
  modifier: (ability: Ability) => number,
) {
  const condition = mechanic.against && { condition: mechanic.against };
  const { bonus } = mechanic;
  for (const { roll, target } of targetsOf(mechanic)) {
    const on = { roll, ...(target && { target }) };
    if (bonus === undefined) {
      into.effects.push({ source: ref.name, mode: "advantage", ...on, ...condition });
    } else if (roll === "save" || roll === "skill") {
      const value = bonusValue(bonus, levels, modifier);
      const at = { roll, ...(target && { target }) };
      if (condition) into.options.push({ source: ref.name, value, ...at, ...condition });
      else into.bonuses.push({ ...at, term: { label: ref.name, value, reference: ref } });
    }
  }
}

export function featureRolls(
  definition: HoldsFeatures,
  modifier: (ability: Ability) => number,
  raging: boolean,
): FeatureRolls {
  const rolls: FeatureRolls = { effects: [], bonuses: [], options: [] };
  for (const held of heldFeatures(definition))
    for (const mechanic of mechanicsOfKind(held.entry, "roll"))
      if (!mechanic.while || raging) addMechanic(rolls, held, mechanic, modifier);
  return rolls;
}

/** The terms of the bonuses that always hold on one save or one skill. */
export function rollBonusTerms(
  bonuses: readonly FeatureRollBonus[],
  on: { roll: "save"; ability: Ability } | { roll: "skill"; skill: string },
): Term<TermReference>[] {
  return bonuses
    .filter(({ roll, target }) =>
      on.roll === "save"
        ? roll === "save" && (target === undefined || target === on.ability)
        : roll === "skill" && target?.toLowerCase() === on.skill.toLowerCase(),
    )
    .map(({ term }) => term);
}
