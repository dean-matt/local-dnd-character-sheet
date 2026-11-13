import type { Edition, ResetTrigger } from "@dnd/rules";
import type { CharacterCatalog, ItemBonusTrait } from "./catalog.ts";
import type { CharacterDerived } from "./characterDerived.ts";
import type { CharacterDefinition } from "./definition.ts";
import { classResourceKey, entryKey } from "./keys.ts";
import type { CharacterState } from "./state.ts";
import { classLevels } from "./summaries.ts";

/**
 * The `resource_key`s whose column counts uses a character spends, with the rest that
 * restores every use under each edition. The rest of a class table describes rather than
 * counts: a die size, a bonus, how many spells or options are known. `infused_items` and
 * `magic_items` count what is held at once, not uses. A 2024 pool that also returns one use
 * on a short rest lists its full recovery here.
 */
const POOL_RESETS: ReadonlyMap<string, Record<Edition, ResetTrigger>> = new Map([
  ["rages", { classic: "long", one: "long" }],
  ["ki_points", { classic: "short", one: "short" }],
  ["focus_points", { classic: "short", one: "short" }],
  ["sorcery_points", { classic: "long", one: "long" }],
  ["channel_divinity", { classic: "short", one: "long" }],
  ["second_wind", { classic: "short", one: "long" }],
  ["wild_shape", { classic: "short", one: "long" }],
  ["psi_points", { classic: "long", one: "long" }],
  ["favored_enemy", { classic: "long", one: "long" }],
  ["energy_die_number", { classic: "long", one: "long" }],
]);

/** The rest that restores every use of a class pool, or undefined for a key that is no pool. */
export const poolReset = (key: string, edition: Edition) => POOL_RESETS.get(key)?.[edition];

const SHORT_REST_USE: ReadonlySet<string> = new Set([
  "rages",
  "channel_divinity",
  "second_wind",
  "wild_shape",
]);

/** Whether a short rest returns one spent use of the pool, which only the 2024 rules grant. */
export const regainsOneOnShortRest = (key: string, edition: Edition) =>
  edition === "one" && SHORT_REST_USE.has(key);

const UNLIMITED = "Unlimited";

/** A class table's `resource_key` as words: `ki_points` as `Ki points`. */
export const resourceLabel = (key: string) => {
  const words = key.replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const words = (text: string) =>
  text
    .toLowerCase()
    .replaceAll(/[\s_]+/g, " ")
    .trim();

/** Whether an item's `resource` names a class table column: `Ki` and `Ki Points` both name `ki_points`. */
const namesPool = (resource: string, key: string) =>
  [words(key), words(key).replace(/ points$/, "")].includes(words(resource));

/**
 * Each pool a class table prints at the character's level in that class, and every cell
 * of a homebrew class, whose resource tables name their own pools. A class the catalog
 * holds no cells for prints none. Throws a RangeError
 * on a pool cell that is neither a count nor `Unlimited`, rather than guess a maximum. Each
 * of `bonuses` that names the pool for its class adds to the maximum, as a term.
 */
export function classResourcePools(
  definition: CharacterDefinition,
  catalog: Pick<CharacterCatalog, "classResources">,
  bonuses: readonly ItemBonusTrait[] = [],
): CharacterDerived["classResources"] {
  return classLevels(definition).flatMap((group) =>
    (catalog.classResources.get(entryKey(group.class)) ?? [])
      .filter((cell) => cell.homebrew || POOL_RESETS.has(cell.key))
      .map((cell) => {
        const terms = bonuses.flatMap(({ name, resourceBonus: bonus }) =>
          bonus &&
          "name" in group.class &&
          words(bonus.class) === words(group.class.name) &&
          namesPool(bonus.resource, cell.key)
            ? [{ label: name, value: bonus.amount }]
            : [],
        );
        if (cell.value === UNLIMITED) {
          return {
            class: group.class,
            key: cell.key,
            maximum: null,
            ...(cell.homebrew && { resets: cell.homebrew.resets }),
          };
        }
        const maximum = Number(cell.value);
        if (!Number.isInteger(maximum) || maximum < 1) {
          throw new RangeError(`${entryKey(group.class)} ${cell.key} prints ${cell.value}`);
        }
        return {
          class: group.class,
          key: cell.key,
          maximum: {
            computed: maximum + terms.reduce((sum, { value }) => sum + value, 0),
            manual: null,
            terms,
          },
          ...(cell.homebrew && { resets: cell.homebrew.resets }),
        };
      }),
  );
}

/** The state with one pool's entry replaced, or added where state holds none for it. */
export function withClassResource(
  state: CharacterState,
  pool: CharacterState["classResources"][number],
): CharacterState {
  const key = classResourceKey(pool);
  const held = state.classResources.some((candidate) => classResourceKey(candidate) === key);
  return {
    ...state,
    classResources: held
      ? state.classResources.map((candidate) =>
          classResourceKey(candidate) === key ? pool : candidate,
        )
      : [...state.classResources, pool],
  };
}
