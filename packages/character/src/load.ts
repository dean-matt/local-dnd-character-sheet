import {
  type Breakdown,
  breakdown,
  encumbranceAt,
  POUNDS_PER_COIN,
  reducedSpeed,
  type Term,
} from "@dnd/rules";
import type { CharacterDerived, Speed } from "./characterDerived.ts";
import type { CharacterDefinition } from "./definition.ts";
import type { TermReference } from "./derivedField.ts";
import { itemKey } from "./keys.ts";
import { derivedValue, houseRule } from "./resolve.ts";

/**
 * Ten-thousandths of a pound, the grid the sum counts on. Upstream prints nothing finer
 * — `Bead of Force` (DMG) at 0.0625 and `Energy Cell` (DMG) at 0.3125 hold the four
 * decimals — so the scale costs no accuracy and buys an exact total across rows of
 * different weights, where adding five kinds of ammunition and a purse of coins as
 * floats lands beside the answer rather than on it. A finer weight rounds to the grid,
 * and the way out is a larger scale, bounded by the 2^53 the integer sum stays inside.
 */
const WEIGHT_SCALE = 10_000;

const scaled = (pounds: number): number => Math.round(pounds * WEIGHT_SCALE);

/**
 * The pounds a character is carrying: every inventory entry flagged `carried`, times its
 * quantity, plus the coins.
 *
 * `weights` maps `itemKey` to an item's weight in pounds, from the catalog and from
 * homebrew, which the caller merges into one map and expands a magic variant into first.
 * A `null` is a row that states no weight and adds nothing; a reference the map does not
 * name is refused, because a silent zero would hide it. The API names every entry and
 * gives an unresolved one `null`, so there the refusal guards a caller that forgot one,
 * and the sheet's Carrying card discloses the zero instead.
 *
 * Coins count regardless of `carried`, because `money` is a purse the definition has
 * nowhere to put down: a character who banked 1,000 gp in town carries 20 pounds they
 * left there, and `encumbranceAt` reads this total straight. The way out is a flag on
 * `money`, or an inventory entry per denomination.
 */
export function carriedWeight(
  definition: CharacterDefinition,
  weights: ReadonlyMap<string, number | null>,
): number {
  let total = 0;
  for (const entry of definition.inventory) {
    if (!entry.carried) continue;
    const key = itemKey(entry);
    const weight = weights.get(key);
    if (weight === undefined) throw new RangeError(`No item row for ${key}`);
    total += scaled(weight ?? 0) * entry.quantity;
  }
  const coins = Object.values(definition.money).reduce((sum, count) => sum + count, 0);
  return (total + scaled(POUNDS_PER_COIN) * coins) / WEIGHT_SCALE;
}

/**
 * The modes a character actually has. A key written as `undefined` survives the parse, so
 * dropping it here keeps it out of the arithmetic and out of every reader downstream.
 *
 * A caller casts the rebuilt object back to `Speed`, which holds only while `walk` is
 * required: an optional one would let this return nothing and the cast stay quiet.
 */
function presentModes(speed: Speed): [string, number][] {
  return Object.entries(speed).filter((entry): entry is [string, number] => entry[1] !== undefined);
}

/**
 * What a load costs a character: the speeds they move at now, and the disadvantage heavy
 * encumbrance imposes.
 *
 * Nothing is stored, so turning the option on mid-campaign changes the answer and leaves
 * no stale derived value behind.
 *
 * The variant reads "your speed drops by 10 feet" and names no movement mode, so the
 * reduction comes off every mode the character has rather than walking alone.
 *
 * `weight` is the caller's, from `carriedWeight`. This applies encumbrance alone, and
 * `speedReduction` is how a caller composes another reduction with it.
 */
export function encumberedSpeed(
  definition: CharacterDefinition,
  derived: CharacterDerived,
  weight: number,
): EncumberedSpeed {
  const modes = presentModes(derivedValue(derived.speed));
  if (!houseRule(definition, "encumbrance")) {
    return {
      speed: Object.fromEntries(modes) as Speed,
      speedReduction: 0,
      disadvantage: false,
      reductionBreakdown: breakdown([]),
    };
  }
  const { speedReduction, disadvantage } = encumbranceAt(
    derived.abilityScores.str.computed,
    derivedValue(derived.size),
    weight,
  );
  const reduced = Object.fromEntries(
    modes.map(([mode, base]) => [mode, reducedSpeed({ base, reduction: speedReduction })]),
  ) as Speed;
  const reductionTerms: Term<TermReference>[] =
    speedReduction === 0
      ? []
      : [
          {
            label: "Encumbrance",
            value: speedReduction,
            reference: { houseRuleOption: "encumbrance" },
          },
        ];
  return {
    speed: reduced,
    speedReduction,
    disadvantage,
    reductionBreakdown: breakdown(reductionTerms),
  };
}

/** A character's speeds under the encumbrance variant, and what else the load costs. */
export type EncumberedSpeed = {
  speed: Speed;
  /**
   * The feet `speed` already lost, handed back unapplied so a caller composes another
   * reduction against the derived speeds rather than reducing `speed` twice: sum this
   * into `reducedSpeed`'s `reduction`. 2014 exhaustion states `halved` and `zeroed`
   * instead of feet, so those go to `reducedSpeed` in the same call. Zero where the
   * table never opted in.
   */
  speedReduction: number;
  /** From `encumbranceAt`, which names the rolls the rule covers. */
  disadvantage: boolean;
  /** Why `speedReduction` is what it is — the encumbrance house rule, or no term at all. */
  reductionBreakdown: Breakdown<TermReference>;
};
