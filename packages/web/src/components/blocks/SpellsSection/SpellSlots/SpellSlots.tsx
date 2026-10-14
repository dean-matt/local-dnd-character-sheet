import {
  type CharacterDerived,
  type CharacterRecord,
  characterDerivedSchema,
  overrideKey,
} from "@dnd/character";
import { levelLabel, ORDINAL } from "../../../../lib/spellLevel.ts";
import { Card } from "../../../Card.tsx";
import { SpellSlotRow } from "./SpellSlotRow.tsx";

const { shape } = characterDerivedSchema;

export function SpellSlots({
  character,
  derived,
}: {
  character: CharacterRecord;
  derived: CharacterDerived;
}) {
  const { spellSlots, pactSlots } = derived;
  if (spellSlots.length === 0 && !pactSlots) return null;
  return (
    <Card title="Spell Slots">
      <ul className="flex flex-col gap-1.5">
        {spellSlots.map((slot) => (
          <SpellSlotRow
            key={slot.level}
            label={levelLabel(slot.level)}
            total={slot.total}
            overrideKey={`${overrideKey("spellSlots", slot, character.definition)}.total`}
            schema={shape.spellSlots.element.shape.total.shape.computed}
          />
        ))}
        {pactSlots && (
          <SpellSlotRow
            label={`Pact ${ORDINAL[pactSlots.level]}`}
            spoken={`Pact Magic, ${levelLabel(pactSlots.level)}`}
            total={pactSlots.total}
            overrideKey="pactSlots.total"
            schema={shape.pactSlots.unwrap().shape.total.shape.computed}
          />
        )}
      </ul>
    </Card>
  );
}
