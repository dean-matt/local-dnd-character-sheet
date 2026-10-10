/** Which of the equipped items' advantage and disadvantage marks a given roll on the sheet. */
import type { RollEffectEntry } from "./characterDerived.ts";
import type { Ability } from "./refs.ts";

/** The roll a sheet row stands for: a saving throw, a skill (checked with its ability), or an attack. */
type RollTarget =
  | { roll: "save"; ability: Ability }
  | { roll: "skill"; skill: string; ability: Ability }
  | { roll: "attack" };

/**
 * The effects that mark `target`. A `check` effect marks every skill that uses its ability,
 * or every skill when it names none; a `skill` effect marks the skill it names.
 */
export function effectsOnRoll(
  effects: readonly RollEffectEntry[],
  target: RollTarget,
): RollEffectEntry[] {
  return effects.filter((effect) => {
    if (target.roll === "attack") return effect.roll === "attack";
    if (target.roll === "save") {
      return (
        effect.roll === "save" && (effect.target === undefined || effect.target === target.ability)
      );
    }
    if (effect.roll === "skill") return effect.target === target.skill;
    return (
      effect.roll === "check" && (effect.target === undefined || effect.target === target.ability)
    );
  });
}
