import type { CharacterDefinition, CharacterDerived } from "@dnd/character";
import { Card } from "../../Card.tsx";
import { Field } from "../../Field/Field.tsx";
import { LabeledValue } from "./LabeledValue.tsx";

export function AttunementCard({
  definition,
  derived,
}: {
  definition: CharacterDefinition;
  derived: CharacterDerived;
}) {
  const used = definition.inventory.filter((entry) => entry.attuned).length;
  return (
    <Card title="Attunement">
      <div className="flex flex-col gap-1">
        <LabeledValue label="Attuned">{used}</LabeledValue>
        <Field mode="read" label="Slots" value={derived.attunementSlots} format={String} />
      </div>
    </Card>
  );
}
