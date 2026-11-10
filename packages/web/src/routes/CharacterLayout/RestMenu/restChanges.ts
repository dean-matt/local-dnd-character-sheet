import type { CharacterFeatures, LimitedUses } from "@dnd/catalog";
import {
  type CharacterDefinition,
  type CharacterDerived,
  type CharacterState,
  derivedValue,
  type HitDie,
  hitDieSpentState,
  type RestLength,
  type RollRecord,
  restedState,
  sheetState,
} from "@dnd/character";
import { levelLabel, ORDINAL } from "../../../lib/spellLevel.ts";

/** `key` tells rows apart where two resources share a name. */
export type RestChange = { key: string; label: string; before: string; after: string };

type Slot = NonNullable<CharacterState["pactSlots"]>;

const left = (slot: Slot) => `${slot.total - slot.expended}/${slot.total}`;

/** A feature's limited uses, with the name a rest's list shows it by. */
export type FeatureUse = LimitedUses & { name: string };

/** Each feature with limited uses, once per key. */
export function featureUses(features: CharacterFeatures): FeatureUse[] {
  const byKey = new Map<string, FeatureUse>();
  for (const feature of features.groups.flatMap((group) => group.features)) {
    if (feature.resolved && feature.uses) {
      byKey.set(feature.uses.key, { name: feature.name, ...feature.uses });
    }
  }
  return [...byKey.values()];
}

/** Uses left against the count, a spent count past it reading as none left. */
function usesLeft(state: CharacterState, feature: FeatureUse): string {
  const held = state.featureUses.find((use) => use.key === feature.key)?.expended ?? 0;
  return `${feature.count - Math.min(held, feature.count)}/${feature.count}`;
}

/**
 * Each field a rest changes, before and after, in the order the sheet reads them. Both states
 * are measured against the sheet by `sheetState`, so their pools and slots line up one to one;
 * a null current reads as `maximum`. A field the rest leaves alone is omitted.
 */
function restChanges(
  before: CharacterState,
  after: CharacterState,
  maximum: number,
  features: readonly FeatureUse[],
): RestChange[] {
  const rows: RestChange[] = [
    {
      key: "hitPoints",
      label: "Hit points",
      before: `${before.hitPoints.current ?? maximum}/${maximum}`,
      after: `${after.hitPoints.current ?? maximum}/${maximum}`,
    },
    {
      key: "temporary",
      label: "Temporary hit points",
      before: String(before.hitPoints.temporary),
      after: String(after.hitPoints.temporary),
    },
    ...before.hitDice.map((pool, index) => ({
      key: `d${pool.die}`,
      label: `d${pool.die} Hit Dice`,
      before: `${pool.remaining}/${pool.total}`,
      after: `${after.hitDice[index]?.remaining}/${pool.total}`,
    })),
    ...before.spellSlots.map((slot, index) => ({
      key: `slot${slot.level}`,
      label: `${levelLabel(slot.level)} slots`,
      before: left(slot),
      after: left(after.spellSlots[index] ?? slot),
    })),
    ...(before.pactSlots && after.pactSlots
      ? [
          {
            key: "pact",
            label: `Pact Magic ${ORDINAL[before.pactSlots.level]} Level slots`,
            before: left(before.pactSlots),
            after: left(after.pactSlots),
          },
        ]
      : []),
    ...before.resources.map((resource, index) => ({
      key: `resource${index}`,
      label: resource.name,
      before: `${resource.current}/${resource.maximum}`,
      after: `${after.resources[index]?.current}/${resource.maximum}`,
    })),
    ...features.map((feature) => ({
      key: `feature:${feature.key}`,
      label: feature.name,
      before: usesLeft(before, feature),
      after: usesLeft(after, feature),
    })),
    {
      key: "exhaustion",
      label: "Exhaustion",
      before: String(before.exhaustion),
      after: String(after.exhaustion),
    },
  ];
  return rows.filter((row) => row.before !== row.after);
}

type HitDieSpend = { die: HitDie; face: number };

/** A tentative spend in the Short rest dialog: the face it rolled and the roll it logs once the rest is taken. */
export type DialogSpend = HitDieSpend & { roll: RollRecord };

/** A spend `spentState` applied, with what it healed and the Constitution modifier it added. */
export type AppliedSpend<Spend extends HitDieSpend> = Spend & {
  amount: number;
  regained: number;
  modifier: number;
};

/**
 * The state after `spends`, each by `hitDieSpentState` in order, written nowhere, and the
 * spends it applied. A spend the state no longer allows, such as one from a pool since
 * emptied, is left out, and each `amount` is measured against the state it was applied to.
 */
export function spentState<Spend extends HitDieSpend>(
  definition: CharacterDefinition,
  derived: CharacterDerived,
  state: CharacterState,
  spends: readonly Spend[],
): { state: CharacterState; applied: AppliedSpend<Spend>[] } {
  const maximum = derivedValue(derived.hitPointMaximum);
  const applied: AppliedSpend<Spend>[] = [];
  let held = state;
  for (const spend of spends) {
    const result = hitDieSpentState(definition, derived, held, spend.die, spend.face);
    if (!result) continue;
    const amount =
      (result.state.hitPoints.current ?? maximum) - (held.hitPoints.current ?? maximum);
    applied.push({ ...spend, amount, regained: result.regained, modifier: result.modifier });
    held = result.state;
  }
  return { state: held, applied };
}

/**
 * The state a rest leaves and what it changes on the sheet, so the menu's summary and the
 * dialog's list describe the one rest the dialog writes. The hit dice in `spends` are spent
 * before the rest, so the list and the write carry them with its own recovery. Each of
 * `features` whose reset the rest meets has its uses restored.
 */
export function restPreview(
  definition: CharacterDefinition,
  derived: CharacterDerived,
  state: CharacterState,
  features: readonly FeatureUse[],
  length: RestLength,
  picked?: HitDie[],
  spends: readonly HitDieSpend[] = [],
): { after: CharacterState; changes: RestChange[] } {
  const during = spentState(definition, derived, state, spends).state;
  const after = restedState(definition, derived, during, length, picked, features);
  const changes = restChanges(
    sheetState(derived, state),
    after,
    derivedValue(derived.hitPointMaximum),
    features,
  );
  return { after, changes };
}
