import { type CharacterDerived, type CharacterRecord, derivedValue } from "@dnd/character";
import { useCharacterInventory } from "../../../hooks/useCharacterInventory.ts";
import { Card } from "../../Card.tsx";
import { Field } from "../../Field/Field.tsx";
import { LabeledValue } from "./LabeledValue.tsx";

const names = new Intl.ListFormat("en", { style: "long", type: "conjunction" });

/**
 * Attuning is never refused for the count: past the limit the card warns, naming the
 * attuned items, so a table that allows more or a player mid-swap is not blocked.
 */
export function AttunementCard({
  character,
  derived,
}: {
  character: CharacterRecord;
  derived: CharacterDerived;
}) {
  const inventory = useCharacterInventory(character.id);
  const used = character.definition.inventory.filter((entry) => entry.attuned).length;
  const limit = derivedValue(derived.attunementSlots);
  const attuned = (inventory.data?.items ?? []).filter((item) => item.attuned);
  return (
    <Card title="Attunement">
      <div className="flex flex-col gap-1">
        <LabeledValue label="Attuned">{used}</LabeledValue>
        <Field mode="read" label="Slots" value={derived.attunementSlots} format={String} />
        {used > limit && (
          <p role="status" className="text-error text-row">
            <strong>
              {used} / {limit} attuned
            </strong>
            , over the limit
            {attuned.length > 0 && <>: {names.format(attuned.map((item) => item.name))}</>}.
          </p>
        )}
      </div>
    </Card>
  );
}
