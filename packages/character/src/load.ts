import {
  type Breakdown,
  breakdown,
  encumbranceAt,
  POUNDS_PER_COIN,
  reducedSpeed,
  type Term,
} from "@dnd/rules";
import type { ContainerTrait } from "./catalog.ts";
import type { CharacterDerived, Speed } from "./characterDerived.ts";
import type { CharacterDefinition } from "./definition.ts";
import type { TermReference } from "./derivedField.ts";
import { itemKey, refKey } from "./keys.ts";
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
  containers: ReadonlyMap<string, ContainerTrait>,
): number {
  const holders = holdersOf(definition);
  let total = 0;
  for (const [index, entry] of definition.inventory.entries()) {
    if (!entry.carried) continue;
    const holder = holders.get(index);
    if (holder && (!holder.carried || containers.get(itemKey(holder))?.weightless)) continue;
    const key = itemKey(entry);
    const weight = weights.get(key);
    if (weight === undefined) throw new RangeError(`No item row for ${key}`);
    total += scaled(weight ?? 0) * entry.quantity;
  }
  const coins = Object.values(definition.money).reduce((sum, count) => sum + count, 0);
  return (total + scaled(POUNDS_PER_COIN) * coins) / WEIGHT_SCALE;
}

type InventoryEntry = CharacterDefinition["inventory"][number];

/** The entry each placed entry sits in, by index; the schema guarantees the holder exists. */
function holdersOf(definition: CharacterDefinition): Map<number, InventoryEntry> {
  const byId = new Map(
    definition.inventory.flatMap((entry) => (entry.id ? [[entry.id, entry]] : [])),
  );
  return new Map(
    definition.inventory.flatMap((entry, index) => {
      const holder = entry.inside === undefined ? undefined : byId.get(entry.inside);
      return holder ? [[index, holder]] : [];
    }),
  );
}

/** A container holding more than its capacity states: `unit` is `lb` or the lowercased `name|source` it counts. */
type ContainerOverflow = { entry: number; name: string; excess: number; unit: string };

/**
 * Each container whose contents pass what its row says it takes, in inventory order. The
 * warning only reports: nothing refuses a full bag. A stacked container (`quantity` above 1)
 * counts as one, so its capacity is not multiplied. Pounds are checked against the sum of
 * a container's compartments, and a counted thing against the sum of its compartments'
 * limits, so a Quiver of Ehlonna's separate compartments pass as one pool. Weight is read
 * from `weights` and a thing the row names that the contents lack counts as none.
 */
export function containerOverflows(
  definition: CharacterDefinition,
  weights: ReadonlyMap<string, number | null>,
  containers: ReadonlyMap<string, ContainerTrait>,
): ContainerOverflow[] {
  const holders = holdersOf(definition);
  return definition.inventory.flatMap((container, entry) => {
    const trait = containers.get(itemKey(container));
    if (!trait) return [];
    const contents = definition.inventory.filter((_, index) => holders.get(index) === container);
    const overflow: ContainerOverflow[] = [];
    if (trait.weight !== undefined) {
      const held = contents.reduce(
        (sum, item) => sum + scaled(weights.get(itemKey(item)) ?? 0) * item.quantity,
        0,
      );
      const excess = (held - scaled(trait.weight)) / WEIGHT_SCALE;
      if (excess > 0) overflow.push({ entry, name: trait.name, excess, unit: "lb" });
    }
    for (const [unit, limit] of Object.entries(trait.items)) {
      const held = contents
        .filter((item) => !("homebrewId" in item.ref) && refKey(item.ref).toLowerCase() === unit)
        .reduce((sum, item) => sum + item.quantity, 0);
      if (held > limit) overflow.push({ entry, name: trait.name, excess: held - limit, unit });
    }
    return overflow;
  });
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
