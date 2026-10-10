/**
 * Resolves the items one definition's inventory lists, reading `content.db` for a catalog
 * reference, expanding a magic variant against its base item, and reading `homebrew.db`
 * for a homebrew one. A reference nothing answers stays in the list, marked unresolved,
 * for the reason `features.ts` gives.
 */
import {
  armorTraitSchema,
  type CharacterInventory,
  entriesSchema,
  type SheetItem,
  weaponTraitSchema,
} from "@dnd/catalog";
import { type CharacterDefinition, displayName, itemKey } from "@dnd/character";
import { type Edition, type MagicItemValue, magicItemValue, spellScrollValue } from "@dnd/rules";
import { getHomebrewItem, type HomebrewDb } from "./homebrew.ts";
import { getExpandedItem } from "./item-variant.ts";
import { getItems, getItemTypeNames } from "./items.ts";

type InventoryEntry = CharacterDefinition["inventory"][number];

export type ItemFacts = {
  name: string;
  edition: Edition;
  rarity: string | null;
  requiresAttunement: boolean;
  json: Record<string, unknown>;
};

/** One row per entry, in order, `undefined` where nothing answers the reference. */
export function resolveItemRows(
  dataDir: string,
  homebrewDb: HomebrewDb,
  inventory: readonly InventoryEntry[],
): (ItemFacts | undefined)[] {
  const plain = inventory.flatMap(({ ref, variant }) =>
    "homebrewId" in ref || variant ? [] : [ref],
  );
  const plainRows = getItems(dataDir, plain).values();
  return inventory.map(({ ref, variant, variantOverride }) => {
    if ("homebrewId" in ref) {
      const row = getHomebrewItem(homebrewDb, ref.homebrewId);
      return (
        row && {
          name: row.name,
          edition: row.edition,
          rarity: row.rarity,
          requiresAttunement: row.requiresAttunement,
          json: row.json as Record<string, unknown>,
        }
      );
    }
    // A variant its base item refuses is null, and the sheet lists it as not found.
    const row =
      (variant
        ? getExpandedItem(dataDir, ref, variant, variantOverride !== undefined)
        : plainRows.next().value) ?? undefined;
    return (
      row && {
        name: row.name,
        edition: row.edition,
        rarity: row.rarity,
        requiresAttunement: row.requires_attunement === 1,
        json: JSON.parse(row.json) as Record<string, unknown>,
      }
    );
  });
}

const weightOf = (row: ItemFacts): number | null => {
  const { weight } = row.json;
  return typeof weight === "number" && weight >= 0 ? weight : null;
};

/**
 * `carriedWeight`'s map. An unresolved entry weighs nothing rather than being left out
 * for `carriedWeight` to refuse: the inventory read lists it as not found, so the zero
 * shows on the sheet instead of hiding in the sum.
 */
export function itemWeights(
  inventory: readonly InventoryEntry[],
  rows: readonly (ItemFacts | undefined)[],
): Map<string, number | null> {
  return new Map(
    inventory.map((entry, index) => {
      const row = rows[index];
      return [itemKey(entry), row ? weightOf(row) : null];
    }),
  );
}

const typeOf = (row: ItemFacts): string | undefined => {
  const { type } = row.json;
  return typeof type === "string" && type ? type : undefined;
};

const priceOf = (row: ItemFacts): number | null => {
  const { value } = row.json;
  return typeof value === "number" && value >= 0 ? value : null;
};

/** A 2024 scroll names its spell level `(Cantrip)` or `(Level 3)`. */
const SCROLL_LEVEL = /^Spell Scroll \((?:(Cantrip)|Level (\d))\)$/;

/**
 * The rarity table's price for an item that prints none. A potion or a scroll is a
 * consumable, except a 2024 Spell Scroll, which prices by its spell level instead.
 */
function estimateOf(row: ItemFacts): MagicItemValue | null {
  if (priceOf(row) !== null || !row.rarity) return null;
  const abbreviation = typeOf(row)?.split("|")[0];
  const scroll = SCROLL_LEVEL.exec(row.name);
  if (row.edition === "one" && scroll) return spellScrollValue(scroll[1] ? 0 : Number(scroll[2]));
  return magicItemValue(row.rarity, row.edition, abbreviation === "P" || abbreviation === "SC");
}

/** The category and die a row prints; what an attack reads goes to the derived block instead. */
function weaponFacts(row: ItemFacts): Extract<SheetItem, { resolved: true }>["weapon"] {
  const weapon = weaponTraitSchema.safeParse(row.json).data;
  return weapon ? { category: weapon.category, damage: weapon.damage } : null;
}

function sheetItem(
  entry: InventoryEntry,
  row: ItemFacts | undefined,
  typeNames: ReadonlyMap<string, string>,
): SheetItem {
  const { ref, variant, variantOverride, quantity, carried, equipped, attuned } = entry;
  const flags = { quantity, carried, equipped, attuned };
  if (!row) {
    return {
      resolved: false,
      name: displayName(ref),
      ...("homebrewId" in ref ? {} : { source: ref.source }),
      ...flags,
      ...(variant && { variant }),
    };
  }
  const entries = entriesSchema.safeParse(row.json.entries);
  const source = row.json.source;
  const type = typeOf(row);
  const abbreviation = type?.split("|")[0];
  return {
    resolved: true,
    name: row.name,
    ...("homebrewId" in ref || typeof source !== "string" ? {} : { source }),
    ...flags,
    type: type && abbreviation ? { abbreviation, name: typeNames.get(type) ?? null } : null,
    rarity: row.rarity,
    requiresAttunement: row.requiresAttunement,
    weight: weightOf(row),
    value: priceOf(row),
    estimate: estimateOf(row),
    weapon: weaponFacts(row),
    armor: armorTraitSchema.safeParse(row.json).data ?? null,
    entries: entries.success ? entries.data : [],
    ...(variantOverride && { overridden: variantOverride }),
  };
}

export function resolveCharacterInventory(
  dataDir: string,
  homebrewDb: HomebrewDb,
  definition: CharacterDefinition,
): CharacterInventory {
  const rows = resolveItemRows(dataDir, homebrewDb, definition.inventory);
  const types = new Set(rows.flatMap((row) => (row ? (typeOf(row) ?? []) : [])));
  const typeNames = getItemTypeNames(dataDir, [...types]);
  return {
    items: definition.inventory.map((entry, index) => sheetItem(entry, rows[index], typeNames)),
  };
}
