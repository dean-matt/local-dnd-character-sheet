import type { FeatureGroup, LimitedUses } from "@dnd/catalog";
import {
  type CharacterDerived,
  type CharacterState,
  entryKey,
  type FeatureCost,
  featureCost,
  featureUsesSpent,
  isRaging,
  poolReset,
  RAGES,
  rageBlockedBy,
  rageStarted,
  sheetState,
  withClassResource,
  withFeatureUse,
} from "@dnd/character";

const REST: Record<string, string> = {
  short: "Short rest",
  long: "Long rest",
  dawn: "Dawn",
  manual: "Manual reset",
};

/**
 * What a Use of a feature spends: the count left against `total`, the rest that restores it,
 * the least (`min`) and most (`max`) one use can spend, and the state after spending an amount,
 * `min` where none is given. A cost that does not vary has equal `min` and `max`.
 */
export type FeatureResource = {
  left: number | null;
  total: number | null;
  rest: string | undefined;
  blocked: string | null;
  min: number;
  max: number;
  spend: (state: CharacterState, amount?: number) => CharacterState;
};

type Price = Pick<FeatureCost, "min" | "max">;

type Pool = CharacterDerived["classResources"][number];

/** The most a use can spend: the cost's own top where it has one, never more than is left. */
const mostSpent = (cost: Price, left: number | null) => {
  const top = cost.max === undefined ? cost.min : cost.max;
  return Math.max(cost.min, Math.min(top ?? Number.POSITIVE_INFINITY, left ?? cost.min));
};

const shortBy = (min: number, left: number | null) =>
  left !== null && left < min ? (min === 1 ? "No use left." : `Needs ${min}; ${left} left.`) : null;

function poolResource(
  derived: CharacterDerived,
  stored: CharacterState,
  edition: "classic" | "one",
  pool: Pool,
  cost: FeatureCost,
): FeatureResource | null {
  const held = sheetState(derived, stored).classResources[derived.classResources.indexOf(pool)];
  if (!held) return null;
  const trigger = pool.resets === undefined ? poolReset(pool.key, edition) : pool.resets;
  const total = held.maximum;
  const rest = trigger ? REST[trigger] : undefined;
  const left = total === null ? null : total - held.expended;
  const range = { min: cost.min, max: mostSpent(cost, left) };
  if (pool.key === RAGES && pool.resets === undefined) {
    const blocked = isRaging(stored) ? "Already raging." : rageBlockedBy(derived, held);
    return { left, total, rest, blocked, ...range, spend: (state) => rageStarted(state, held) };
  }
  return {
    left,
    total,
    rest,
    blocked: shortBy(cost.min, left),
    ...range,
    spend: (state, amount = cost.min) =>
      total === null
        ? state
        : withClassResource(state, { ...held, expended: held.expended + amount }),
  };
}

function usesResource(stored: CharacterState, uses: LimitedUses, cost: Price): FeatureResource {
  const expended = featureUsesSpent(stored, uses.key, uses.count);
  const left = uses.count - expended;
  return {
    left,
    total: uses.count,
    rest: REST[uses.reset],
    blocked: shortBy(cost.min, left),
    min: cost.min,
    max: mostSpent(cost, left),
    spend: (state, amount = cost.min) => withFeatureUse(state, uses.key, expended + amount),
  };
}

const ONE_USE: Price = { min: 1 };

/**
 * The resource a held feature spends, or null where it spends none. A feature the curated table
 * prices from a class pool spends that pool, preferring the pool of the class the feature came
 * from, and one priced from another feature's uses spends those, which `usesOf` reads from the
 * feature's group; otherwise it spends the limited uses the catalog states. A Rages use starts
 * the rage.
 */
export function featureResource(
  derived: CharacterDerived,
  stored: CharacterState,
  edition: "classic" | "one",
  feature: { name: string; source: string; uses: LimitedUses | undefined },
  group: Pick<FeatureGroup, "class">,
  usesOf: (name: string) => LimitedUses | undefined = () => undefined,
): FeatureResource | null {
  const cost = featureCost(feature);
  if (cost?.feature !== undefined) {
    const uses = usesOf(cost.feature);
    return uses ? usesResource(stored, uses, cost) : null;
  }
  const candidates = derived.classResources.filter((pool) => pool.key === cost?.pool);
  const pool =
    candidates.find((pool) => group.class && entryKey(pool.class) === entryKey(group.class)) ??
    candidates[0];
  if (pool && cost) return poolResource(derived, stored, edition, pool, cost);
  return feature.uses ? usesResource(stored, feature.uses, ONE_USE) : null;
}

/** The amount a use spends: the one chosen, held between the least and most the resource allows. */
export function amountSpent(resource: FeatureResource | null, chosen: number | null) {
  if (!resource) return 1;
  const whole = chosen !== null && Number.isFinite(chosen) ? Math.round(chosen) : resource.min;
  return Math.min(Math.max(whole, resource.min), resource.max);
}
