/**
 * Resolves the items one definition's inventory lists, reading `content.db` for a catalog
 * reference, expanding a magic variant against its base item, and reading `homebrew.db`
 * for a homebrew one. A reference nothing answers stays in the list, marked unresolved,
 * for the reason `features.ts` gives.
 */
import { type CharacterInventory, entriesSchema, type SheetItem } from "@dnd/catalog";
import { type CharacterDefinition, displayName, itemKey } from "@dnd/character";
import { getItems } from "./content.ts";
import { getHomebrewItem, type HomebrewDb } from "./homebrew.ts";
import { getExpandedItem } from "./item-variant.ts";

type InventoryEntry = CharacterDefinition["inventory"][number];

export type ItemFacts = {
  name: string;
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
  return inventory.map(({ ref, variant }) => {
    if ("homebrewId" in ref) {
      const row = getHomebrewItem(homebrewDb, ref.homebrewId);
      return (
        row && {
          name: row.name,
          rarity: row.rarity,
          requiresAttunement: row.requiresAttunement,
          json: row.json as Record<string, unknown>,
        }
      );
    }
    // A variant its base item refuses is null, and the sheet lists it as not found.
    const row =
      (variant ? getExpandedItem(dataDir, ref, variant) : plainRows.next().value) ?? undefined;
    return (
      row && {
        name: row.name,
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

function sheetItem(entry: InventoryEntry, row: ItemFacts | undefined): SheetItem {
  const { ref, variant, quantity, carried, equipped, attuned } = entry;
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
  return {
    resolved: true,
    name: row.name,
    ...("homebrewId" in ref || typeof source !== "string" ? {} : { source }),
    ...flags,
    rarity: row.rarity,
    requiresAttunement: row.requiresAttunement,
    weight: weightOf(row),
    entries: entries.success ? entries.data : [],
  };
}

export function resolveCharacterInventory(
  dataDir: string,
  homebrewDb: HomebrewDb,
  definition: CharacterDefinition,
): CharacterInventory {
  const rows = resolveItemRows(dataDir, homebrewDb, definition.inventory);
  return { items: definition.inventory.map((entry, index) => sheetItem(entry, rows[index])) };
}
