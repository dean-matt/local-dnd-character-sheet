import type { SheetItem } from "@dnd/catalog";
import type { CharacterDerived, CharacterRecord } from "@dnd/character";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { EmptyState } from "../../../../EmptyState.tsx";
import { ErrorState } from "../../../../ErrorState.tsx";
import { characterInventoryKey } from "../../../../hooks/characterKeys.ts";
import { useCharacterInventory } from "../../../../hooks/useCharacterInventory.ts";
import { useHeldWrites } from "../../../../hooks/useHeldWrites.ts";
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
  const writes = useHeldWrites(update);
  const failure = writes.latest?.error;
  // A count saves through its own field, which reports its own failure.
  const counts = useUpdateCharacterDefinition(character.id);
  const queryClient = useQueryClient();
  // A row edits by index, and its index holds only once the last row write has landed and
  // the rows have refetched: a second click before then could reach the entry that moved
  // into place, or a duplicate holding the same item. Such a click is dropped until both
  // settle. Both are read at the click rather than from render state, which a query's
  // observers update a tick late, too late for a double click; `rowWrites` mirrors the
  // count only to draw the list busy.
  const writing = useRef(0);
  const [rowWrites, setRowWrites] = useState(0);
  const busy = rowWrites > 0 || inventory.isFetching;
  const settled = () =>
    writing.current === 0 &&
    queryClient.isFetching({ queryKey: characterInventoryKey(character.id) }) === 0;
  // Released from the write's own promise: `add` calling `mutate` on this observer
  // detaches it from an earlier write, whose per-call `onSettled` then never runs.
  const hold = (run: () => Promise<unknown>) => {
    writing.current += 1;
    setRowWrites((count) => count + 1);
    return run().finally(() => {
      writing.current -= 1;
      setRowWrites((count) => count - 1);
    });
  };
  const drawn = character.definition.inventory;
  const edit = (index: number, change: EntryChange) => {
    const entry = drawn[index];
    if (!entry || !settled()) return;
    hold(() =>
      writes.write(`row:${index}`, (latest) => editInventoryEntry(latest, index, entry, change)),
    );
  };
  const place = (index: number, holder: number | null) => {
    const entry = drawn[index];
    const container = holder === null ? undefined : drawn[holder];
    if (!entry || (holder !== null && !container) || !settled()) return;
    hold(() =>
      writes.write(`row:${index}`, (latest) =>
        placeInventoryEntry(
          latest,
          index,
          entry,
          container && holder !== null ? { index: holder, drawn: container } : null,
        ),
      ),
    );
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
    writes.write(`add:${JSON.stringify([entry.ref, entry.variant])}`, (latest) => ({
      ...latest,
      inventory: [
        ...latest.inventory,
        { ...entry, quantity: 1, carried: true, equipped: false, attuned: false },
      ],
    }));

  useSaveToast(
    "Inventory",
    failure ? `Couldn't save: ${failure.message}` : undefined,
    writes.retry,
    failure,
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
        busy={busy}
      />
    );
  };
  const entries = inventory.data.items.map((item, index) => ({ item, index }));
  const cards = GROUPS.map((group) => {
    const rows = entries.filter(({ item }) => groupOf(item) === group);
    return (
      <Card key={group} title={group}>
        {rows.length === 0 ? (
          <p className="text-muted text-row">No {group.toLowerCase()}.</p>
        ) : (
          <ul
            aria-busy={busy}
            className="flex flex-col gap-2 aria-busy:cursor-wait aria-busy:opacity-60"
          >
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
                        await hold(() =>
                          counts.mutateAsync((latest) =>
                            editInventoryEntry(latest, index, entry, (at) => ({ ...at, quantity })),
                          ),
                        );
                      }}
                    />
                  }
                  placement={placementField(index, item.name)}
                  busy={busy}
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
                  busy={busy}
                  onRemove={() => edit(index, () => null)}
                />
              ),
            )}
          </ul>
        )}
      </Card>
    );
  });
  // A third of the content column fits a row's controls only from xl, beside the sidebar.
  return (
    <>
      {picker}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">{cards}</div>
    </>
  );
}
