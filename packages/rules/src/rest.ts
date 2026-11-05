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

function spentDice(pools: readonly Pool[]): Map<HitDie, number> {
  const spent = new Map<HitDie, number>();
  for (const pool of pools) {
    if (!Number.isInteger(pool.remaining) || pool.remaining < 0 || pool.remaining > pool.total) {
      throw new RangeError(`A d${pool.die} pool has ${pool.remaining} of ${pool.total} remaining`);
    }
    if (spent.has(pool.die)) {
      throw new RangeError(`Two pools hold d${pool.die} hit dice`);
    }
    spent.set(pool.die, pool.total - pool.remaining);
  }
  return spent;
}

type HitDicePick = { allowed: number; spent: { die: HitDie; count: number }[] };

/**
 * What a long rest asks the player to pick: how many hit dice return, and how many of each
 * size were spent, omitting a size with none spent. Null where every spent die returns, so
 * `rest` reads no `picked`. Throws as `rest` does on a malformed pool.
 */
export function hitDicePick(
  pools: readonly Pool[],
  { edition, everyHitDie }: Pick<RestOptions, "edition" | "everyHitDie">,
): HitDicePick | null {
  const spent = spentDice(pools);
  const allowed = hitDiceRecovered(
    pools.map((pool) => pool.total),
    everyHitDie ? "one" : edition,
  );
  const sizes = [...spent].filter(([, count]) => count > 0);
  const total = sizes.reduce((sum, [, count]) => sum + count, 0);
  if (total <= allowed) return null;
  return { allowed, spent: sizes.map(([die, count]) => ({ die, count })) };
}

function recovered(pools: readonly Pool[], options: RestOptions): Pool[] {
  const pick = hitDicePick(pools, options);
  if (!pick) {
    return pools.map((pool) => ({ ...pool, remaining: pool.total }));
  }
  const { allowed, spent } = pick;
  const { picked } = options;
  if (picked === undefined) {
    const total = spent.reduce((sum, size) => sum + size.count, 0);
    throw new RangeError(`${total} hit dice were spent and ${allowed} return: pick which`);
  }
  if (picked.length > allowed) {
    throw new RangeError(`${picked.length} hit dice were picked and at most ${allowed} return`);
  }
  const back = new Map<HitDie, number>();
  for (const die of picked) {
    const taken = back.get(die) ?? 0;
    if (taken === (spent.find((size) => size.die === die)?.count ?? 0)) {
      throw new RangeError(`More d${die} hit dice were picked than were spent`);
    }
    back.set(die, taken + 1);
  }
  return pools.map((pool) => ({ ...pool, remaining: pool.remaining + (back.get(pool.die) ?? 0) }));
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
