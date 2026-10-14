/** Which advantage and disadvantage marks a given roll on the sheet. */
import type { AdvantageMode } from "@dnd/rules";
import type { RollEffectEntry } from "./characterDerived.ts";
import type { Ability } from "./refs.ts";

/**
 * The roll a sheet row stands for: a saving throw, a skill (checked with its ability, or
 * with none where a flat value stands in for it), or an attack with the ability it uses.
 */
type RollTarget =
  | { roll: "save"; ability: Ability }
  | { roll: "skill"; skill: string; ability: Ability | null }
  | { roll: "attack"; ability: Ability };

/**
 * The effects that mark `target`. A `check` effect marks every skill that uses its ability,
 * or every skill when it names none, flat skills included; a `skill` effect marks the skill
 * it names. A `save` or `attack` effect marks the rolls of its ability, or all of them.
 */
export function effectsOnRoll(
  effects: readonly RollEffectEntry[],
  target: RollTarget,
): RollEffectEntry[] {
  return effects.filter((effect) => {
    if (target.roll === "attack" || target.roll === "save") {
      return (
        effect.roll === target.roll &&
        (effect.target === undefined || effect.target === target.ability)
      );
    }
    if (effect.roll === "skill") return effect.target === target.skill;
    return (
      effect.roll === "check" && (effect.target === undefined || effect.target === target.ability)
    );
  });
}

/**
 * What the effects on one roll come to, as if every condition holds: advantage and
 * disadvantage together cancel however many of each apply. `conditional` says some effect
 * carries a condition the sheet cannot judge. Undefined where no effect applies.
 */
export function netRollEffect(
  effects: readonly RollEffectEntry[],
): { mode: AdvantageMode | "cancel"; conditional: boolean } | undefined {
  const [first] = effects;
  if (!first) return undefined;
  return {
    mode: effects.every((effect) => effect.mode === first.mode) ? first.mode : "cancel",
    conditional: effects.some((effect) => effect.condition !== undefined),
  };
}
