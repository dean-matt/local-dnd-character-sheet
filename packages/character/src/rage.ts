import type { CharacterDerived } from "./characterDerived.ts";
import { withClassResource } from "./classResources.ts";
import type { CharacterState } from "./state.ts";

/** The `resource_key` of the Rages pool a class table prints. */
export const RAGES = "rages";

/** The name a rage goes by in the state's `activeEffects`. */
const RAGE = "Rage";

type Pool = CharacterState["classResources"][number];

export const isRaging = (state: Pick<CharacterState, "activeEffects">) =>
  state.activeEffects.some((effect) => effect.name === RAGE);

/** Why a rage cannot start from this pool, or null where it can. A 2014 rage only loses its benefits in heavy armor, but entering one there gains nothing, so both editions refuse. */
export function rageBlockedBy(derived: Pick<CharacterDerived, "heavyArmorWorn">, pool: Pool) {
  if (derived.heavyArmorWorn) return "Heavy armor is worn.";
  if (pool.maximum !== null && pool.expended >= pool.maximum) return "No Rage use left.";
  return null;
}

/** The state with a use of the pool spent, which an `Unlimited` pool skips, and the rage begun. */
export function rageStarted(state: CharacterState, pool: Pool): CharacterState {
  const spent =
    pool.maximum === null
      ? state
      : withClassResource(state, {
          ...pool,
          expended: pool.expended + 1,
        });
  return { ...spent, activeEffects: [...spent.activeEffects, { name: RAGE }] };
}

/** The state with the rage ended and no use restored. */
export const rageEnded = (state: CharacterState): CharacterState => ({
  ...state,
  activeEffects: state.activeEffects.filter((effect) => effect.name !== RAGE),
});
