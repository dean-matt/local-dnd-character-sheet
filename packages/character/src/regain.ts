/**
 * What a use of a held feature regains, read from its recorded `regain` mechanics, and the
 * state a regain leaves.
 */
import type { CharacterDerived } from "./characterDerived.ts";
import { withClassResource } from "./classResources.ts";
import { mechanicsOfKind } from "./featureMechanics.ts";
import { type HoldsFeatures, heldFeatures } from "./heldFeatures.ts";
import { entryKey } from "./keys.ts";
import { sheetState } from "./rest.ts";
import { type CharacterState, featureUsesSpent, withFeatureUse } from "./state.ts";

type Regain = CharacterDerived["regains"][number];

type Sheet = Pick<
  CharacterDerived,
  "hitDice" | "spellSlots" | "pactSlots" | "classResources" | "limitedUses"
>;

/** Each held class or subclass feature's regains, in the order the features are held. */
export function regains(definition: HoldsFeatures): Regain[] {
  return heldFeatures(definition).flatMap(({ entry, ref }) => {
    if (!("className" in entry.ref)) return [];
    const owner = { name: entry.ref.className, source: entry.ref.classSource };
    return mechanicsOfKind(entry, "regain").map(({ target, pool, count, of, on }) => ({
      feature: ref,
      class: owner,
      target,
      ...(pool && { pool }),
      ...(count && { count }),
      ...(of && { of }),
      ...(on && { on }),
    }));
  });
}

/** The main uses of the feature a regain of uses names: its own, or the one of its source `of` names. */
const mainUses = (derived: Pick<CharacterDerived, "limitedUses">, regain: Regain) =>
  derived.limitedUses.find(
    (uses) =>
      uses.part === undefined &&
      uses.feature.name === (regain.of ?? regain.feature.name) &&
      uses.feature.source === regain.feature.source,
  );

/**
 * The state after `regain` lands, or null where nothing it names is expended: the pool's
 * spent uses, the pact slots or the feature's main uses, lowered by its count or to none.
 */
export function regainedState(
  derived: Sheet,
  state: CharacterState,
  regain: Regain,
): CharacterState | null {
  const sheet = sheetState(derived, state);
  const count = regain.count ?? Infinity;
  if (regain.target === "pactSlots") {
    const { pactSlots } = sheet;
    return pactSlots && pactSlots.expended > 0
      ? { ...state, pactSlots: { ...pactSlots, expended: 0 } }
      : null;
  }
  if (regain.target === "pool") {
    const index = derived.classResources.findIndex(
      (pool) => pool.key === regain.pool && entryKey(pool.class) === entryKey(regain.class),
    );
    const held = sheet.classResources[index];
    return held && held.expended > 0
      ? withClassResource(state, { ...held, expended: Math.max(0, held.expended - count) })
      : null;
  }
  const main = mainUses(derived, regain);
  const spent = main ? featureUsesSpent(state, main.key, main.count) : 0;
  return main && spent > 0 ? withFeatureUse(state, main.key, Math.max(0, spent - count)) : null;
}

/**
 * The state after each regain made on rolling initiative lands where the pool or uses it names
 * hold none, and the features that regained.
 */
export function initiativeRegained(
  derived: Sheet & Pick<CharacterDerived, "regains">,
  state: CharacterState,
): { state: CharacterState; features: string[] } {
  return derived.regains
    .filter(({ on }) => on === "initiative")
    .reduce<{ state: CharacterState; features: string[] }>(
      (into, regain) => {
        const sheet = sheetState(derived, into.state);
        const held =
          regain.target === "pool"
            ? sheet.classResources[
                derived.classResources.findIndex(
                  (pool) =>
                    pool.key === regain.pool && entryKey(pool.class) === entryKey(regain.class),
                )
              ]
            : undefined;
        const main = mainUses(derived, regain);
        const none =
          regain.target === "pool"
            ? held !== undefined && held.maximum !== null && held.expended >= held.maximum
            : main !== undefined &&
              featureUsesSpent(into.state, main.key, main.count) >= main.count;
        const regained = none ? regainedState(derived, into.state, regain) : null;
        return regained
          ? { state: regained, features: [...into.features, regain.feature.name] }
          : into;
      },
      { state, features: [] },
    );
}
