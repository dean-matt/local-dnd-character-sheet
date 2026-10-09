import type { SheetItem } from "@dnd/catalog";
import { type CharacterDerived, type CharacterRecord, derivedValue } from "@dnd/character";
import { useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { EmptyState } from "../../../../EmptyState.tsx";
import { ErrorState } from "../../../../ErrorState.tsx";
import { characterInventoryKey } from "../../../../hooks/characterKeys.ts";
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
  const queryClient = useQueryClient();
  // A row edits by index, and its index holds only once the last row write has landed and
  // the rows have refetched: a second click before then could reach the entry that moved
  // into place, or a duplicate holding the same item. Such a click is dropped while "Saving…"
  // shows. Both are read at the click rather than from render state, which a query's
  // observers update a tick late, too late for a double click.
  const writing = useRef(0);
  const settled = () =>
    writing.current === 0 &&
    queryClient.isFetching({ queryKey: characterInventoryKey(character.id) }) === 0;
  const saving = update.isPending || counts.isPending || inventory.isFetching;
  const drawn = character.definition.inventory;
  const edit = (index: number, change: EntryChange) => {
    const entry = drawn[index];
    if (!entry || !settled()) return;
    writing.current += 1;
    // Released from the write's own promise: `add` calling `mutate` on this observer
    // detaches it from an earlier write, whose per-call `onSettled` then never runs. The
    // observer's `error` still carries a failure to the alert, so the rejection is dropped.
    update
      .mutateAsync((latest) => editInventoryEntry(latest, index, entry, change))
      .catch(() => {})
      .finally(() => {
        writing.current -= 1;
      });
  };
  const add = (entry: Pick<InventoryEntry, "ref" | "variant">) =>
    update.mutate((latest) => ({
      ...latest,
      inventory: [
        ...latest.inventory,
        { ...entry, quantity: 1, carried: true, equipped: false, attuned: false },
      ],
    }));

  const picker = (
    <div className="flex flex-col gap-1">
      <AddItemField edition={character.edition} onAdd={add} />
      <p role="status" className="text-muted text-row">
        {saving && inventory.data ? "Saving…" : ""}
      </p>
    </div>
  );
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
  // Without the derived block there is no slot count to refuse against, so attuning stays
  // open rather than blocked by a failed read.
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
                        if (!settled()) {
                          throw new Error("wait for the last change to save, then retry");
                        }
                        writing.current += 1;
                        try {
                          await counts.mutateAsync((latest) =>
                            editInventoryEntry(latest, index, entry, (at) => ({ ...at, quantity })),
                          );
                        } finally {
                          writing.current -= 1;
                        }
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
