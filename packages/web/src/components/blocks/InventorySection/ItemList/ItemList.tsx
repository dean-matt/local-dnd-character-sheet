import type { SheetItem } from "@dnd/catalog";
import type { CharacterDerived, CharacterRecord } from "@dnd/character";
import { useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { EmptyState } from "../../../../EmptyState.tsx";
import { ErrorState } from "../../../../ErrorState.tsx";
import { characterInventoryKey } from "../../../../hooks/characterKeys.ts";
import { useCharacterInventory } from "../../../../hooks/useCharacterInventory.ts";
import { useHeldWriteError } from "../../../../hooks/useHeldWriteError.ts";
import { useSaveToast } from "../../../../hooks/useSaveToast.ts";
import { useUpdateCharacterDefinition } from "../../../../hooks/useUpdateCharacterDefinition.ts";
import { LoadingState } from "../../../../LoadingState.tsx";
import { Card } from "../../../Card.tsx";
import { AddItemField } from "./AddItemField.tsx";
import {
  editInventoryEntry,
  type InventoryEntry,
  placeInventoryEntry,
} from "./editInventoryEntry.ts";
import { PlaceField } from "./PlaceField.tsx";
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
  const failure = useHeldWriteError(update);
  // A count saves through its own field, which reports its own failure.
  const counts = useUpdateCharacterDefinition(character.id);
  const queryClient = useQueryClient();
  // A row edits by index, and its index holds only once the last row write has landed and
  // the rows have refetched: a second click before then could reach the entry that moved
  // into place, or a duplicate holding the same item. Such a click is dropped until both
  // settle. Both are read at the click rather than from render state, which a query's
  // observers update a tick late, too late for a double click.
  const writing = useRef(0);
  const settled = () =>
    writing.current === 0 &&
    queryClient.isFetching({ queryKey: characterInventoryKey(character.id) }) === 0;
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
  const place = (index: number, holder: number | null) => {
    const entry = drawn[index];
    const container = holder === null ? undefined : drawn[holder];
    if (!entry || (holder !== null && !container) || !settled()) return;
    writing.current += 1;
    update
      .mutateAsync((latest) =>
        placeInventoryEntry(
          latest,
          index,
          entry,
          container && holder !== null ? { index: holder, drawn: container } : null,
        ),
      )
      .catch(() => {})
      .finally(() => {
        writing.current -= 1;
      });
  };
  // One level deep: a container on offer is not itself inside another, and an item that
  // holds others is offered none.
  const holdersFor = (index: number) => {
    const entry = drawn[index];
    if (!entry || drawn.some((other) => entry.id && other.inside === entry.id)) return [];
    return (derived?.containers ?? [])
      .filter((container) => container.entry !== index && !drawn[container.entry]?.inside)
      .map(({ entry: at, name }) => ({ index: at, name }));
  };
  const add = (entry: Pick<InventoryEntry, "ref" | "variant" | "variantOverride">) =>
    update.mutate((latest) => ({
      ...latest,
      inventory: [
        ...latest.inventory,
        { ...entry, quantity: 1, carried: true, equipped: false, attuned: false },
      ],
    }));

  useSaveToast(
    "Inventory",
    failure ? `Couldn't save: ${failure.message}` : undefined,
    () => update.variables && update.mutate(update.variables),
  );

  const picker = <AddItemField edition={character.edition} onAdd={add} />;
  if (inventory.isPending) return <LoadingState label="Loading inventory…" />;
  if (inventory.isError) return <ErrorState error={inventory.error} />;
  if (inventory.data.items.length === 0) {
    return (
      <>
        {picker}
        <EmptyState>{character.name} has no items yet.</EmptyState>
      </>
    );
  }
  const placementField = (index: number, name: string) => {
    const holders = holdersFor(index);
    const inside = drawn[index]?.inside;
    const current = inside ? drawn.findIndex((entry) => entry.id === inside) : -1;
    if (holders.length === 0 && current < 0) return null;
    return (
      <PlaceField
        name={name}
        holders={holders}
        current={current < 0 ? null : current}
        onChange={(holder) => place(index, holder)}
      />
    );
  };
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
                  placement={placementField(index, item.name)}
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
      {cards}
    </>
  );
}
