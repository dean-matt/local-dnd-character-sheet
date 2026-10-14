import {
  type CharacterDerived,
  type CharacterRecord,
  characterDerivedSchema,
  derivedValue,
} from "@dnd/character";
import { TriangleAlert } from "lucide-react";
import { useCharacterInventory } from "../../../hooks/useCharacterInventory.ts";
import { Card } from "../../Card.tsx";
import { Popover } from "../../Popover.tsx";
import { DerivedValue } from "../DerivedValue.tsx";
import { LabeledValue } from "../LabeledValue.tsx";

const names = new Intl.ListFormat("en", { style: "long", type: "conjunction" });

/**
 * Attuning is never refused for the count: past the limit the Attuned count turns to
 * the error color with a mark that opens the attuned items, so a table that allows more
 * or a player mid-swap is not blocked. The warning stays inside the row, so the card
 * keeps its height beside the others on the shared row.
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
  const over = used > limit;
  const warning = `${used} / ${limit} attuned, over the limit${
    attuned.length > 0 ? `: ${names.format(attuned.map((item) => item.name))}` : ""
  }.`;
  return (
    <Card title="Attunement">
      <div className="flex flex-col gap-0.5">
        <LabeledValue label="Attuned">
          <span className={over ? "inline-flex items-center gap-1 text-error" : undefined}>
            {used}
            {over && (
              <Popover
                trigger={<TriangleAlert aria-hidden="true" size={14} className="block" />}
                triggerLabel="Over the attunement limit"
                label="Over the attunement limit"
              >
                {warning}
              </Popover>
            )}
          </span>
        </LabeledValue>
        <LabeledValue label="Slots">
          <DerivedValue
            named
            name="Attunement slots"
            value={derived.attunementSlots}
            format={String}
            overrideKey="attunementSlots"
            schema={characterDerivedSchema.shape.attunementSlots.shape.computed}
          />
        </LabeledValue>
        {/* Kept mounted while empty: a live region added with its text is often not announced. */}
        <span role="status" className="sr-only">
          {over ? warning : null}
        </span>
      </div>
    </Card>
  );
}
