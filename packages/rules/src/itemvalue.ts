/**
 * What a magic item is worth when its entry states no price, which is nearly all of them.
 * Prices are copper pieces, the unit the catalog stores.
 *
 * The rulesets price by rarity differently: the 2024 Dungeon Master's Guide gives one
 * figure per rarity, the 2014 one a range. Both halve a consumable. A 2024 Spell Scroll
 * is the exception, worth double its scribing cost.
 */
import type { Edition } from "./edition.ts";

const COPPER_PER_GOLD = 100;

export type MagicItemValue =
  | { kind: "amount"; table: string; copper: number }
  | { kind: "range"; table: string; min: number; max: number | null }
  | { kind: "priceless"; table: string };

const TABLE_2024 = "Magic Item Rarities and Values";
const TABLE_2014 = "Magic Item Rarity";
const SCROLL_TABLE = "Spell Scroll Costs";

const GOLD_2024: Record<string, number> = {
  common: 100,
  uncommon: 400,
  rare: 4000,
  "very rare": 40000,
  legendary: 200000,
};

/** Inclusive gp bounds; Legendary is "50,001+", so it has no upper bound. */
const GOLD_2014: Record<string, readonly [number, number | null]> = {
  common: [50, 100],
  uncommon: [101, 500],
  rare: [501, 5000],
  "very rare": [5001, 50000],
  legendary: [50001, null],
};

/** Scribing a Spell Scroll, by spell level from a cantrip (0) to 9, in gp. */
const SCRIBING_COST_2024 = [15, 25, 100, 150, 1000, 1500, 10000, 12500, 15000, 50000] as const;

/**
 * `null` for a rarity no table prices — `none`, `unknown`, `unknown (magic)` and
 * `varies`. An artifact is priceless in both editions, though only the 2024 table says so.
 */
export function magicItemValue(
  rarity: string,
  edition: Edition,
  consumable: boolean,
): MagicItemValue | null {
  const table = edition === "one" ? TABLE_2024 : TABLE_2014;
  if (rarity === "artifact") return { kind: "priceless", table };
  const half = consumable ? 0.5 : 1;
  if (edition === "one") {
    const gold = GOLD_2024[rarity];
    if (gold === undefined) return null;
    return { kind: "amount", table, copper: gold * COPPER_PER_GOLD * half };
  }
  const bounds = GOLD_2014[rarity];
  if (!bounds) return null;
  const [min, max] = bounds;
  return {
    kind: "range",
    table,
    min: min * COPPER_PER_GOLD * half,
    max: max === null ? null : max * COPPER_PER_GOLD * half,
  };
}

/** `null` where `spellLevel` is not a level from 0 to 9. */
export function spellScrollValue(spellLevel: number): MagicItemValue | null {
  const cost = SCRIBING_COST_2024[spellLevel];
  return cost === undefined
    ? null
    : { kind: "amount", table: SCROLL_TABLE, copper: cost * COPPER_PER_GOLD * 2 };
}
