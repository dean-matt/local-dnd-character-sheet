import type { Edition } from "./edition.ts";
import { type HitDie, hitDiceRecovered } from "./hitpoints.ts";

/**
 * What a resource recovers on. The vocabulary is a rule rather than a storage
 * detail, so it lives here and the character schema validates against it.
 */
export const RESET_TRIGGERS = ["short", "long", "dawn", "manual"] as const;

type ResetTrigger = (typeof RESET_TRIGGERS)[number];

/**
 * Upstream `recharge` values that map onto a trigger the sheet tracks. `dusk`,
 * `midnight` and `special` do not, so they degrade to `manual` rather than widen
 * the four triggers above.
 */
const RECHARGE_TRIGGERS = new Map<string, ResetTrigger>([
  ["restShort", "short"],
  ["restLong", "long"],
  ["dawn", "dawn"],
]);

export function resetsOn(recharge: string | null | undefined): ResetTrigger {
  if (!recharge) {
    return "manual";
  }
  return RECHARGE_TRIGGERS.get(recharge) ?? "manual";
}

type RestLength = "short" | "long";

type Pool = { die: HitDie; total: number; remaining: number };

type Slot = { level: number; total: number; expended: number };

type Resource = { current: number; maximum: number; resetsOn: ResetTrigger };

/** The fields a rest touches. Anything else the state carries passes through untouched. */
type RestState = {
  hitPoints: { current: number | null; temporary: number };
  hitDice: readonly Pool[];
  spellSlots: readonly Slot[];
  pactSlots: Slot | null;
  resources: readonly Resource[];
  exhaustion: number;
};

type RestOptions = {
  length: RestLength;
  edition: Edition;
  /** True: a classic long rest returns every spent die, as a 2024 one does. */
  everyHitDie: boolean;
  /**
   * The die sizes the player chose to recover, one entry per die. Read only where a classic
   * long rest returns fewer dice than were spent.
   */
  picked?: readonly HitDie[];
};

function resets(trigger: ResetTrigger, length: RestLength): boolean {
  if (trigger === "short") return true;
  return length === "long" && (trigger === "long" || trigger === "dawn");
}

function recovered(pools: readonly Pool[], { edition, everyHitDie, picked }: RestOptions): Pool[] {
  const spent = new Map<number, number>();
  for (const pool of pools) {
    if (!Number.isInteger(pool.remaining) || pool.remaining < 0 || pool.remaining > pool.total) {
      throw new RangeError(`A d${pool.die} pool has ${pool.remaining} of ${pool.total} remaining`);
    }
    if (spent.has(pool.die)) {
      throw new RangeError(`Two pools hold d${pool.die} hit dice`);
    }
    spent.set(pool.die, (spent.get(pool.die) ?? 0) + pool.total - pool.remaining);
  }
  const allowed = hitDiceRecovered(
    pools.map((pool) => pool.total),
    everyHitDie ? "one" : edition,
  );
  const spentTotal = [...spent.values()].reduce((sum, dice) => sum + dice, 0);
  if (spentTotal <= allowed) {
    return pools.map((pool) => ({ ...pool, remaining: pool.total }));
  }
  if (picked === undefined) {
    throw new RangeError(`${spentTotal} hit dice were spent and ${allowed} return: pick which`);
  }
  if (picked.length > allowed) {
    throw new RangeError(`${picked.length} hit dice were picked and at most ${allowed} return`);
  }
  const unpicked = new Map(spent);
  for (const die of picked) {
    const left = unpicked.get(die) ?? 0;
    if (left === 0) {
      throw new RangeError(`More d${die} hit dice were picked than were spent`);
    }
    unpicked.set(die, left - 1);
  }
  return pools.map((pool) => {
    const back = (spent.get(pool.die) ?? 0) - (unpicked.get(pool.die) ?? 0);
    return { ...pool, remaining: pool.remaining + back };
  });
}

/**
 * The state after a rest. A short rest resets pact slots and short-rest resources and
 * returns no hit dice, since spending them is a choice made apart from the rest. A long
 * rest restores everything a short one does, writes hit points back as null so they read
 * as the maximum, clears temporary hit points and expended slots, lowers exhaustion by 1
 * and returns hit dice by `hitDiceRecovered`.
 *
 * Throws a RangeError, returning nothing, when `picked` is missing where it is needed, picks
 * more dice than return, or names a size more times than dice of it were spent, and when a
 * pool's remaining dice fall outside 0 to its total or two pools share a die size.
 */
export function rest<S extends RestState>(state: S, options: RestOptions): S {
  const resources = state.resources.map((resource) =>
    resets(resource.resetsOn, options.length)
      ? { ...resource, current: resource.maximum }
      : resource,
  );
  const pactSlots = state.pactSlots && { ...state.pactSlots, expended: 0 };
  if (options.length === "short") {
    return { ...state, pactSlots, resources };
  }
  return {
    ...state,
    hitPoints: { current: null, temporary: 0 },
    hitDice: recovered(state.hitDice, options),
    spellSlots: state.spellSlots.map((slot) => ({ ...slot, expended: 0 })),
    pactSlots,
    resources,
    exhaustion: Math.max(0, state.exhaustion - 1),
  };
}
