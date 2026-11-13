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

const ATTACK_CONDITIONS = [
  { name: "Blinded", mode: "disadvantage" },
  { name: "Invisible", mode: "advantage" },
  { name: "Poisoned", mode: "disadvantage" },
  { name: "Prone", mode: "disadvantage" },
  { name: "Restrained", mode: "disadvantage" },
  {
    name: "Frightened",
    mode: "disadvantage",
    condition: "while the source of fear is in line of sight",
  },
] as const;

/**
 * The advantage and disadvantage the sheet's own conditions put on its attack rolls, in the
 * shape a held item's effect takes. Exhaustion counts only in the classic ruleset, from level 3; the one ruleset's
 * penalty is a flat number.
 */
export function conditionAttackEffects(
  state: { conditions: readonly { name: string }[]; exhaustion: number },
  edition: "classic" | "one",
): RollEffectEntry[] {
  const held = new Set(state.conditions.map(({ name }) => name));
  const effects: RollEffectEntry[] = ATTACK_CONDITIONS.filter(({ name }) => held.has(name)).map(
    (entry) => ({
      source: entry.name,
      mode: entry.mode,
      roll: "attack",
      ...("condition" in entry && { condition: entry.condition }),
    }),
  );
  if (edition === "classic" && state.exhaustion >= 3) {
    effects.push({ source: "Exhaustion", mode: "disadvantage", roll: "attack" });
  }
  return effects;
}
