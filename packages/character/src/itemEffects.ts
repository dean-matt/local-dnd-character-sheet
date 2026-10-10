/**
 * What equipped items do to a character beyond a flat bonus: they change speeds and
 * raise the proficiency bonus. Each function takes the items that already passed the
 * equipped and attuned test.
 */
import { type ProficiencyLevel, proficiencyContribution, type Term } from "@dnd/rules";
import type { ArmorBurdenTrait, ItemBonusTrait, SpeedMode, SpeedModifier } from "./catalog.ts";
import type { Speed } from "./characterDerived.ts";
import type { TermReference } from "./derivedField.ts";

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

/** Feet of walking speed that armor beyond the wearer's Strength takes off, in both editions. */
const HEAVY_ARMOR_SLOWING = 10;

/**
 * The speed after each armor whose Strength requirement exceeds `strength`, with one term
 * per armor. Only walking slows, as the rule words it; it applies after the items that
 * set or scale a speed, so Boots of Speed double the walk the armor then cuts. A walk of
 * under 10 feet falls to 0 rather than below it.
 */
export function speedUnderArmor(
  speed: Speed,
  armor: readonly ArmorBurdenTrait[],
  strength: number,
): { speed: Speed; terms: Term<TermReference>[] } {
  const terms: Term<TermReference>[] = [];
  let walk = speed.walk;
  for (const { name, strength: required } of armor) {
    if (required === undefined || strength >= required || walk === undefined || walk === 0) {
      continue;
    }
    const cut = Math.min(HEAVY_ARMOR_SLOWING, walk);
    walk -= cut;
    terms.push({ label: `${name}: Strength ${required} required`, value: -cut });
  }
  return { speed: walk === undefined ? speed : { ...speed, walk }, terms };
}
