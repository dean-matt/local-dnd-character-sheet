import type { SheetItem } from "@dnd/catalog";
import { type CharacterDerived, type CharacterRecord, derivedValue } from "@dnd/character";
import { useMemo } from "react";
import { EmptyState } from "../../../../EmptyState.tsx";
import { ErrorState } from "../../../../ErrorState.tsx";
import { useCharacterInventory } from "../../../../hooks/useCharacterInventory.ts";
import { useUpdateCharacterDefinition } from "../../../../hooks/useUpdateCharacterDefinition.ts";
import { LoadingState } from "../../../../LoadingState.tsx";
import { Card } from "../../../Card.tsx";
import { AddItemField } from "./AddItemField.tsx";
import { attunementRefusal } from "./attunementRefusal.ts";
import { editInventoryEntry, type InventoryEntry } from "./editInventoryEntry.ts";
import { QuantityField } from "./QuantityField.tsx";
import { ResolvedItemRow } from "./ResolvedItemRow/ResolvedItemRow.tsx";
import { UnresolvedItemRow } from "./UnresolvedItemRow.tsx";

const GROUPS = ["Weapons", "Armor", "Gear"] as const;

type Group = (typeof GROUPS)[number];

const GROUP_OF_TYPE: Record<string, Group> = {
  M: "Weapons",
  R: "Weapons",
  LA: "Armor",
  MA: "Armor",
  HA: "Armor",
  S: "Armor",
};

/** An item nothing resolves has no type to sort by, so it lands in Gear. */
const groupOf = (item: SheetItem): Group =>
  (item.resolved && item.type && GROUP_OF_TYPE[item.type.abbreviation]) || "Gear";

type EntryChange = (entry: InventoryEntry) => InventoryEntry | null;

export function ItemList({
  character,
  derived,
}: {
  character: CharacterRecord;
  derived: CharacterDerived | undefined;
}) {
  const inventory = useCharacterInventory(character.id);
  const update = useUpdateCharacterDefinition(character.id);
  // A count saves through its own field, which reports its own failure.
  const counts = useUpdateCharacterDefinition(character.id);
  // The rows draw against the definition the inventory was read from, not the detail
  // cache: a landed write moves the cache on at once, while the rows wait for the refetch.
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new inventory read is what moves the rows.
  const drawn = useMemo(() => character.definition.inventory, [inventory.data]);
  const edit = (index: number, change: EntryChange) => {
    const entry = drawn[index];
    if (entry) update.mutate((latest) => editInventoryEntry(latest, index, entry, change));
  };
  const add = (entry: Pick<InventoryEntry, "ref" | "variant">) =>
    update.mutate((latest) => ({
      ...latest,
      inventory: [
        ...latest.inventory,
        { ...entry, quantity: 1, carried: true, equipped: false, attuned: false },
      ],
    }));

  const picker = <AddItemField edition={character.edition} onAdd={add} />;
  const failure = update.isError && (
    <p role="alert" className="text-error text-row">
      The change was not saved: {update.error.message}
    </p>
  );
  if (inventory.isPending) return <LoadingState label="Loading inventory…" />;
  if (inventory.isError) return <ErrorState message={inventory.error.message} />;
  if (inventory.data.items.length === 0) {
    return (
      <>
        {picker}
        {failure}
        <EmptyState>{character.name} has no items yet.</EmptyState>
      </>
    );
  }
  const attuned = inventory.data.items.filter((item) => item.attuned).map((item) => item.name);
  const refusal = derived && attunementRefusal(derivedValue(derived.attunementSlots), attuned);
  const entries = inventory.data.items.map((item, index) => ({ item, index }));
  const cards = GROUPS.map((group) => {
    const rows = entries.filter(({ item }) => groupOf(item) === group);
    return (
      rows.length > 0 && (
        <Card key={group} title={group}>
          <ul className="flex flex-col gap-2">
            {/* The key is the definition's index, since two entries may hold the same item. */}
            {rows.map(({ item, index }) =>
              item.resolved ? (
                <ResolvedItemRow
                  key={index}
                  item={item}
                  attack={derived?.attacks.find((attack) => attack.entry === index)}
                  attuneRefusal={refusal}
                  quantity={
                    <QuantityField
                      name={item.name}
                      quantity={item.quantity}
                      onSave={async (quantity) => {
                        const entry = drawn[index];
                        if (!entry) return;
                        await counts.mutateAsync((latest) =>
                          editInventoryEntry(latest, index, entry, (at) => ({ ...at, quantity })),
                        );
                      }}
                    />
                  }
                  onGrip={(grip) => edit(index, (entry) => ({ ...entry, grip }))}
                  onEquip={(equipped) =>
                    edit(index, (entry) => ({
                      ...entry,
                      equipped,
                      carried: entry.carried || equipped,
                    }))
                  }
                  onAttune={(on) => edit(index, (entry) => ({ ...entry, attuned: on }))}
                  onRemove={() => edit(index, () => null)}
                />
              ) : (
                <UnresolvedItemRow
                  key={index}
                  item={item}
                  index={index}
                  characterId={character.id}
                  onRemove={() => edit(index, () => null)}
                />
              ),
            )}
          </ul>
        </Card>
      )
    );
  });
  return (
    <>
      {picker}
      {failure}
      {cards}
    </>
  );
}
