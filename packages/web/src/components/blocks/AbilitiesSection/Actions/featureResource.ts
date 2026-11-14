import type { FeatureGroup, LimitedUses } from "@dnd/catalog";
import {
  type CharacterDerived,
  type CharacterState,
  entryKey,
  featurePoolKey,
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

/** What a Use of a feature spends: the count left against `total`, the rest that restores it, and the state after one use. */
export type FeatureResource = {
  left: number | null;
  total: number | null;
  rest: string | undefined;
  blocked: string | null;
  spend: (state: CharacterState) => CharacterState;
};

type Pool = CharacterDerived["classResources"][number];

function poolResource(
  derived: CharacterDerived,
  stored: CharacterState,
  edition: "classic" | "one",
  pool: Pool,
): FeatureResource | null {
  const held = sheetState(derived, stored).classResources[derived.classResources.indexOf(pool)];
  if (!held) return null;
  const trigger = pool.resets === undefined ? poolReset(pool.key, edition) : pool.resets;
  const total = held.maximum;
  const rest = trigger ? REST[trigger] : undefined;
  const left = total === null ? null : total - held.expended;
  if (pool.key === RAGES && pool.resets === undefined) {
    const blocked = isRaging(stored) ? "Already raging." : rageBlockedBy(derived, held);
    return { left, total, rest, blocked, spend: (state) => rageStarted(state, held) };
  }
  return {
    left,
    total,
    rest,
    blocked: left !== null && left < 1 ? "No use left." : null,
    spend: (state) =>
      total === null ? state : withClassResource(state, { ...held, expended: held.expended + 1 }),
  };
}

function usesResource(stored: CharacterState, uses: LimitedUses): FeatureResource {
  const expended = featureUsesSpent(stored, uses.key, uses.count);
  return {
    left: uses.count - expended,
    total: uses.count,
    rest: REST[uses.reset],
    blocked: expended >= uses.count ? "No use left." : null,
    spend: (state) => withFeatureUse(state, uses.key, expended + 1),
  };
}

/**
 * The resource a held feature spends, or null where it spends none. A feature the curated table
 * ties to a class pool spends that pool, preferring the pool of the class the feature came from;
 * otherwise it spends the limited uses the catalog states. A Rages use starts the rage.
 */
export function featureResource(
  derived: CharacterDerived,
  stored: CharacterState,
  edition: "classic" | "one",
  feature: { name: string; source: string; uses: LimitedUses | undefined },
  group: Pick<FeatureGroup, "class">,
): FeatureResource | null {
  const poolKey = featurePoolKey(feature);
  const candidates = derived.classResources.filter((pool) => pool.key === poolKey);
  const pool =
    candidates.find((pool) => group.class && entryKey(pool.class) === entryKey(group.class)) ??
    candidates[0];
  if (pool) return poolResource(derived, stored, edition, pool);
  return feature.uses ? usesResource(stored, feature.uses) : null;
}
