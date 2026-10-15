/**
 * A catalog or homebrew row landing in a definition's lists: an item in the inventory, a
 * spell among those known, a feat among the chosen features. The sheet's own pickers and
 * "Add to…" both write through these, so each list takes a new entry one way.
 */
import type { CharacterDefinition, ContentRef, EntryRef } from "@dnd/character";

type InventoryEntry = CharacterDefinition["inventory"][number];

/** `definition` with one of the item at the end of its inventory, carried and unequipped. */
export const withItem = (
  definition: CharacterDefinition,
  entry: Pick<InventoryEntry, "ref" | "variant" | "variantOverride">,
): CharacterDefinition => ({
  ...definition,
  inventory: [
    ...definition.inventory,
    { ...entry, quantity: 1, carried: true, equipped: false, attuned: false },
  ],
});

/** `definition` knowing the spell unprepared, learned for the class `origin` where one is named. */
export const withSpell = (
  definition: CharacterDefinition,
  ref: EntryRef,
  origin: ContentRef | undefined,
): CharacterDefinition => ({
  ...definition,
  spells: [...definition.spells, { ref, prepared: false, ...(origin && { origin }) }],
});

/** `definition` holding the feat, with no entitlement recorded for it. */
export const withFeat = (definition: CharacterDefinition, ref: EntryRef): CharacterDefinition => ({
  ...definition,
  feats: [...definition.feats, { ref }],
});
