import type { CharacterCatalog, WeaponTrait } from "./catalog.ts";
import type { CharacterDerived } from "./characterDerived.ts";
import { withClassResource } from "./classResources.ts";
import type { CharacterDefinition } from "./definition.ts";
import { entryKey } from "./keys.ts";
import type { Ability } from "./refs.ts";
import type { CharacterState } from "./state.ts";
import { classLevels } from "./summaries.ts";

/** The `resource_key` of the Rages pool a class table prints. */
export const RAGES = "rages";

/** The name a rage goes by in the state's `activeEffects`. */
export const RAGE = "Rage";

type Pool = CharacterState["classResources"][number];

export const isRaging = (state: Pick<CharacterState, "activeEffects">) =>
  state.activeEffects.some((effect) => effect.name === RAGE);

/** Why a rage cannot start from this pool, or null where it can. Both editions refuse in heavy armor, where a 2014 rage gains nothing. */
export function rageBlockedBy(derived: Pick<CharacterDerived, "heavyArmorWorn">, pool: Pool) {
  if (derived.heavyArmorWorn) return "Heavy armor is worn.";
  if (pool.maximum !== null && pool.expended >= pool.maximum) return "No Rage use left.";
  return null;
}

/** The state with a use of the pool spent, which an `Unlimited` pool skips, and the rage begun; a raging state is unchanged. */
export function rageStarted(state: CharacterState, pool: Pool): CharacterState {
  if (isRaging(state)) return state;
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

/** Damage types a rage resists, in both editions. */
export const RAGE_RESISTANCES = ["bludgeoning", "piercing", "slashing"] as const;

/**
 * What a rage adds to the derived block, or null while the character is not raging or wears
 * heavy armor, which switches a rage's benefits off. `damage` is the class table's Rage
 * Damage cell at the character's level, 0 where no class table prints one.
 */
export function rageBenefits(
  definition: CharacterDefinition,
  catalog: Pick<CharacterCatalog, "classResources">,
  state: Pick<CharacterState, "activeEffects">,
  heavyArmorWorn: boolean,
) {
  if (!isRaging(state) || heavyArmorWorn) return null;
  const cell = classLevels(definition)
    .flatMap((group) => catalog.classResources.get(entryKey(group.class)) ?? [])
    .find(({ key, homebrew }) => key === "rage_damage" && !homebrew);
  const damage = cell ? Number(cell.value) : 0;
  if (!Number.isInteger(damage)) throw new RangeError(`Rage Damage prints ${cell?.value}`);
  return { damage };
}

/** The Rage term of a weapon attack's damage: a Strength weapon attack in 2024, a melee one in 2014. */
export const rageDamageTerms = (
  rage: ReturnType<typeof rageBenefits>,
  edition: CharacterDefinition["edition"],
  weaponKind: WeaponTrait["kind"],
  ability: Ability,
) =>
  rage && rage.damage > 0 && ability === "str" && (edition === "one" || weaponKind === "melee")
    ? [{ label: "Rage", value: rage.damage }]
    : [];
