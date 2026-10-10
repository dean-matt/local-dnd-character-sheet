import type { CharacterDerived, CharacterRecord } from "@dnd/character";
import { useCharacterInventory } from "../../../hooks/useCharacterInventory.ts";
import { Card } from "../../Card.tsx";
import { Field } from "../../Field/Field.tsx";
import { LabeledValue } from "./LabeledValue.tsx";
import { pounds } from "./pounds.ts";

const ENCUMBRANCE_LABEL: Record<NonNullable<CharacterDerived["encumbrance"]>, string> = {
  unencumbered: "Unencumbered",
  encumbered: "Encumbered",
  heavilyEncumbered: "Heavily encumbered",
};

/** A carried item nothing resolves weighs nothing in the total, so the card says so. */
export function CarryingCard({
  character,
  derived,
}: {
  character: CharacterRecord;
  derived: CharacterDerived;
}) {
  const inventory = useCharacterInventory(character.id);
  const missing =
    inventory.data?.items.filter((item) => !item.resolved && item.carried).length ?? 0;
  const overfull = derived.containers.flatMap(({ entry, name, overflow }) =>
    overflow.map(({ excess, unit }) => ({
      entry,
      name,
      text: unit === "lb" ? pounds(excess) : `${excess} ${unit.split("|")[0]}`,
    })),
  );
  return (
    <Card title="Carrying">
      <div className="flex flex-col gap-1">
        <LabeledValue label="Carried">{pounds(derived.carriedWeight)}</LabeledValue>
        <Field
          mode="read"
          label="Carrying Capacity"
          value={derived.carryingCapacity}
          format={pounds}
        />
        {derived.encumbrance && (
          <LabeledValue label="Encumbrance">{ENCUMBRANCE_LABEL[derived.encumbrance]}</LabeledValue>
        )}
        {overfull.map(({ entry, name, text }) => (
          <p key={`${entry}|${text}`} role="status" className="text-error text-row">
            {name} holds {text} more than it can.
          </p>
        ))}
        {missing > 0 && (
          <p className="text-muted text-row">
            Leaves out {missing === 1 ? "1 item" : `${missing} items`} not found.
          </p>
        )}
      </div>
    </Card>
  );
}
