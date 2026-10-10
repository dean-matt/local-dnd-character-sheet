/**
 * What equipped items do to a character beyond a flat bonus: they change speeds, raise
 * the proficiency bonus and mark rolls with advantage or disadvantage. Each function takes the items that already passed the
 * equipped and attuned test.
 */
import { type ProficiencyLevel, proficiencyContribution, type Term } from "@dnd/rules";
import type { ItemBonusTrait, SpeedMode, SpeedModifier } from "./catalog.ts";
import type { RollEffectEntry, Speed } from "./characterDerived.ts";
import type { TermReference } from "./derivedField.ts";
import type { Ability } from "./refs.ts";

/** The part of an item that raises the proficiency bonus. */
export type ProficiencyItem = Pick<ItemBonusTrait, "name" | "proficiencyBonus">;

/**
 * The proficiency bonus an item adds, as one term per item that moves the number. A skill
 * with expertise doubles the bonus and a half proficiency halves it, so each term is the
 * difference the item makes to what the proficiency was already worth.
 */
export function proficiencyItemTerms(
  level: number,
  proficiency: ProficiencyLevel,
  items: readonly ProficiencyItem[],
): Term<TermReference>[] {
  let before = proficiencyContribution(level, proficiency);
  let bonus = 0;
  const terms: Term<TermReference>[] = [];
  for (const item of items) {
    bonus += item.proficiencyBonus;
    const after = proficiencyContribution(level, proficiency, bonus);
    if (after !== before) terms.push({ label: item.name, value: after - before });
    before = after;
  }
  return terms;
}

type Move = (mode: SpeedMode, value: number, lowers: boolean) => void;

const entriesOf = <V>(record: Partial<Record<SpeedMode | "*", V>> | undefined) =>
  Object.entries(record ?? {}) as [SpeedMode | "*", V][];

/** One item's change in its fixed order: `static`, `equal`, `multiply`, then `bonus`. */
function applyChange(change: SpeedModifier, speed: Speed, move: Move): void {
  for (const [mode, value] of entriesOf(change.static)) move(mode as SpeedMode, value, false);
  for (const [mode, from] of entriesOf(change.equal)) {
    move(mode as SpeedMode, speed[from] ?? 0, false);
  }
  for (const [mode, factor] of entriesOf(change.multiply)) {
    const before = speed[mode as SpeedMode];
    if (before !== undefined) move(mode as SpeedMode, before * factor, true);
  }
  for (const [key, feet] of entriesOf(change.bonus)) {
    const modes = key === "*" ? (Object.keys(speed) as SpeedMode[]) : [key];
    for (const mode of modes) {
      const before = speed[mode];
      if (before !== undefined) move(mode, before + feet, true);
    }
  }
}

/**
 * The speeds after each item in turn, and a term for every mode an item moved. A `static`
 * or `equal` speed never lowers a mode: each printed item grants a speed the character may
 * already beat, such as Boots of Striding and Springing for one already walking faster.
 * Items apply in inventory order, so a multiplier and a bonus from two items give a result
 * that depends on which is listed first.
 */
export function speedWithItems(
  base: Speed,
  items: readonly ItemBonusTrait[],
): { speed: Speed; terms: Term<TermReference>[] } {
  const speed: Speed = { ...base };
  const terms: Term<TermReference>[] = [];
  for (const { name, speed: change } of items) {
    if (!change) continue;
    applyChange(change, speed, (mode, value, lowers) => {
      const before = speed[mode] ?? 0;
      const after = Math.floor(lowers ? value : Math.max(before, value));
      if (after === before) return;
      speed[mode] = after;
      terms.push({ label: `${name}: ${mode} ${before} to ${after}`, value: after - before });
    });
  }
  return { speed, terms };
}

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
