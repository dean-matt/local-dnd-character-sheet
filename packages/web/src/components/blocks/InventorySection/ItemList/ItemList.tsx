import type { SheetItem } from "@dnd/catalog";
import type { CharacterDerived, CharacterRecord } from "@dnd/character";
import { useIsMutating } from "@tanstack/react-query";
import { EmptyState } from "../../../../EmptyState.tsx";
import { ErrorState } from "../../../../ErrorState.tsx";
import { characterDefinitionWriteKey } from "../../../../hooks/characterKeys.ts";
import { useCharacterInventory } from "../../../../hooks/useCharacterInventory.ts";
import { useUpdateCharacterDefinition } from "../../../../hooks/useUpdateCharacterDefinition.ts";
import { LoadingState } from "../../../../LoadingState.tsx";
import { Card } from "../../../Card.tsx";
import type { Grip } from "../../attack.ts";
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

export function ItemList({
  character,
  derived,
}: {
  character: CharacterRecord;
  derived: CharacterDerived | undefined;
}) {
  const inventory = useCharacterInventory(character.id);
  const update = useUpdateCharacterDefinition(character.id);
  const writing = useIsMutating({ mutationKey: characterDefinitionWriteKey(character.id) }) > 0;
  const setGrip = (index: number, grip: Grip) =>
    update.mutate((definition) => ({
      ...definition,
      inventory: definition.inventory.map((entry, at) =>
        at === index ? { ...entry, grip } : entry,
      ),
    }));
  if (inventory.isPending) return <LoadingState label="Loading inventory…" />;
  if (inventory.isError) return <ErrorState message={inventory.error.message} />;
  if (inventory.data.items.length === 0) {
    return <EmptyState>{character.name} has no items yet.</EmptyState>;
  }
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
                  onGrip={(grip) => setGrip(index, grip)}
                  saving={writing}
                />
              ) : (
                <UnresolvedItemRow
                  key={index}
                  item={item}
                  index={index}
                  characterId={character.id}
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
      {update.isError && (
        <p role="alert" className="text-error text-row">
          The grip was not saved: {update.error.message}
        </p>
      )}
      {cards}
    </>
  );
}
