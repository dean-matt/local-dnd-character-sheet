import { type AdvantageMode, exhaustionEffects } from "@dnd/rules";
import type { RollEffectEntry } from "./characterDerived.ts";
import type { CharacterDefinition } from "./definition.ts";
import type { Ability } from "./refs.ts";
import { exhaustionRuleset } from "./resolve.ts";

/**
 * The roll a sheet row stands for: a saving throw, an ability check, a skill (checked with its
 * ability, or with none where a flat value stands in for it), an attack with the ability it
 * uses, initiative, or a death save.
 */
type RollTarget =
  | { roll: "save"; ability: Ability }
  | { roll: "check"; ability: Ability }
  | { roll: "skill"; skill: string; ability: Ability | null }
  | { roll: "attack"; ability: Ability }
  | { roll: "initiative" }
  | { roll: "deathSave" };

/**
 * The entries that mark `target`, effects or options alike. A `check` entry marks every check
 * of its ability, or every check when it names none, flat skills included; initiative is a
 * Dexterity check. A `skill` entry marks the skill it names, in any case. A `save` or `attack`
 * entry marks the rolls of its ability, or all of them.
 */
export function effectsOnRoll<T extends { roll: string; target?: string }>(
  effects: readonly T[],
  target: RollTarget,
): T[] {
  return effects.filter((effect) => marks(effect, target));
}

const checkOf = (effect: { roll: string; target?: string }, ability: Ability | null) =>
  effect.roll === "check" && (effect.target === undefined || effect.target === ability);

function marks(effect: { roll: string; target?: string }, target: RollTarget): boolean {
  switch (target.roll) {
    case "deathSave":
      return effect.roll === "deathSave";
    case "initiative":
      return effect.roll === "initiative" || checkOf(effect, "dex");
    case "attack":
    case "save":
      return (
        effect.roll === target.roll &&
        (effect.target === undefined || effect.target === target.ability)
      );
    case "skill":
      if (effect.roll === "skill")
        return effect.target?.toLowerCase() === target.skill.toLowerCase();
      return checkOf(effect, target.ability);
    case "check":
      return checkOf(effect, target.ability);
  }
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

const FEAR_IN_SIGHT = "while the source of fear is in line of sight";

type ConditionRule = {
  name: string;
  mode: AdvantageMode;
  roll: "check" | "save" | "attack" | "initiative";
  target?: Ability;
  condition?: string;
  edition?: "classic" | "one";
};

const CONDITION_RULES: readonly ConditionRule[] = [
  { name: "Blinded", mode: "disadvantage", roll: "attack" },
  { name: "Invisible", mode: "advantage", roll: "attack" },
  { name: "Invisible", mode: "advantage", roll: "initiative", edition: "one" },
  { name: "Poisoned", mode: "disadvantage", roll: "attack" },
  { name: "Poisoned", mode: "disadvantage", roll: "check" },
  { name: "Prone", mode: "disadvantage", roll: "attack" },
  { name: "Restrained", mode: "disadvantage", roll: "attack" },
  { name: "Restrained", mode: "disadvantage", roll: "save", target: "dex" },
  { name: "Frightened", mode: "disadvantage", roll: "attack", condition: FEAR_IN_SIGHT },
  { name: "Frightened", mode: "disadvantage", roll: "check", condition: FEAR_IN_SIGHT },
];

/**
 * Classic exhaustion's disadvantage on one kind of roll, named with its level: ability checks
 * from level 1, attack rolls and saving throws from level 3. The one ruleset's penalty is a
 * flat number, so it has none.
 */
export function exhaustionRollEffects(
  level: number,
  edition: "classic" | "one",
  roll: "check" | "save" | "attack",
): RollEffectEntry[] {
  if (edition !== "classic" || level === 0) return [];
  const effects = exhaustionEffects(level, edition);
  if (effects.edition !== "classic") return [];
  const holds =
    roll === "check" ? effects.abilityCheckDisadvantage : effects.attackAndSaveDisadvantage;
  return holds ? [{ source: `Exhaustion ${level}`, mode: "disadvantage", roll }] : [];
}

/**
 * The advantage and disadvantage the sheet's own conditions put on one kind of roll, in the
 * shape a held item's effect takes, with exhaustion's from `exhaustionRollEffects`. An
 * initiative roll is an ability check, so it takes the checks' effects too. Exhaustion
 * follows `exhaustionRuleset`, the table the character plays it by.
 */
export function conditionRollEffects(
  state: { conditions: readonly { name: string }[]; exhaustion: number },
  definition: Pick<CharacterDefinition, "edition" | "houseRules">,
  roll: "check" | "save" | "attack" | "initiative",
): RollEffectEntry[] {
  const held = new Set(state.conditions.map(({ name }) => name));
  const kinds = roll === "initiative" ? ["check", "initiative"] : [roll];
  const effects = CONDITION_RULES.filter(
    (rule) =>
      held.has(rule.name) &&
      kinds.includes(rule.roll) &&
      (rule.edition === undefined || rule.edition === definition.edition),
  ).map(({ name, mode, roll: kind, target, condition }) => ({
    source: name,
    mode,
    roll: kind === "initiative" ? ("check" as const) : kind,
    ...(target && { target }),
    ...(condition && { condition }),
  }));
  return [
    ...effects,
    ...exhaustionRollEffects(
      state.exhaustion,
      exhaustionRuleset(definition),
      roll === "initiative" ? "check" : roll,
    ),
  ];
}
