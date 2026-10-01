/**
 * The Inventory page: what the character carries against what they can, the attunement
 * slots in use, their coins, then every item split into Weapons, Armor and Gear by its
 * type. The load and each weapon's attack come off the derived block and every item off
 * `/characters/{id}/inventory`, so the page does no rules arithmetic of its own. A
 * versatile weapon's grip is the one thing it writes, back into the definition.
 */
import type { CharacterDerived, CharacterRecord } from "@dnd/character";
import { EmptyState } from "../../EmptyState.tsx";
import { AttunementCard } from "./AttunementCard.tsx";
import { CarryingCard } from "./CarryingCard.tsx";
import { CurrencyCard } from "./CurrencyCard.tsx";
import { ItemList } from "./ItemList.tsx";

export function InventorySection({
  character,
  derived,
}: {
  character: CharacterRecord | undefined;
  derived: CharacterDerived | undefined;
}) {
  if (!character) return <EmptyState>Inventory isn't available yet.</EmptyState>;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {derived && <CarryingCard character={character} derived={derived} />}
        {derived && <AttunementCard definition={character.definition} derived={derived} />}
        <div className="sm:col-span-2">
          <CurrencyCard money={character.definition.money} />
        </div>
      </div>
      <ItemList character={character} derived={derived} />
    </div>
  );
}
