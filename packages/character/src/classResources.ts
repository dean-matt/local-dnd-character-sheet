import type { CharacterCatalog } from "./catalog.ts";
import type { CharacterDerived } from "./characterDerived.ts";
import type { CharacterDefinition } from "./definition.ts";
import { entryKey } from "./keys.ts";
import { classLevels } from "./summaries.ts";

/**
 * The `resource_key`s whose column counts uses a character spends. The rest of a class
 * table describes rather than counts: a die size, a bonus, how many spells or options are
 * known. `infused_items` and `magic_items` count what is held at once, not uses.
 */
const POOL_KEYS: ReadonlySet<string> = new Set([
  "rages",
  "ki_points",
  "focus_points",
  "sorcery_points",
  "channel_divinity",
  "second_wind",
  "wild_shape",
  "psi_points",
  "favored_enemy",
  "energy_die_number",
]);

const UNLIMITED = "Unlimited";

/** A class table's `resource_key` as words: `ki_points` as `Ki points`. */
export const resourceLabel = (key: string) => {
  const words = key.replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const computed = (value: number) => ({ computed: value, manual: null, terms: [] });

/**
 * Each pool a class table prints at the character's level in that class. A class the
 * catalog holds no cells for, a homebrew class among them, prints none. Throws a RangeError
 * on a pool cell that is neither a count nor `Unlimited`, rather than guess a maximum.
 */
export function classResourcePools(
  definition: CharacterDefinition,
  catalog: Pick<CharacterCatalog, "classResources">,
): CharacterDerived["classResources"] {
  return classLevels(definition).flatMap((group) =>
    (catalog.classResources.get(entryKey(group.class)) ?? [])
      .filter((cell) => POOL_KEYS.has(cell.key))
      .map((cell) => {
        if (cell.value === UNLIMITED) return { class: group.class, key: cell.key, maximum: null };
        const maximum = Number(cell.value);
        if (!Number.isInteger(maximum) || maximum < 1) {
          throw new RangeError(`${entryKey(group.class)} ${cell.key} prints ${cell.value}`);
        }
        return { class: group.class, key: cell.key, maximum: computed(maximum) };
      }),
  );
}
