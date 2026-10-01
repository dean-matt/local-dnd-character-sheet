import type { CharacterDerived } from "@dnd/character";
import { Card } from "../Card.tsx";
import { SpellSlotRow } from "./SpellSlotRow.tsx";
import { levelLabel, ORDINAL } from "./spellLevel.ts";

export function SpellSlots({ derived }: { derived: CharacterDerived }) {
  const { spellSlots, pactSlots } = derived;
  if (spellSlots.length === 0 && !pactSlots) return null;
  return (
    <Card title="Spell Slots">
      <ul className="flex flex-col gap-2.5">
        {spellSlots.map((slot) => (
          <SpellSlotRow key={slot.level} label={levelLabel(slot.level)} total={slot.total} />
        ))}
        {pactSlots && (
          <SpellSlotRow
            label={`Pact ${ORDINAL[pactSlots.level]}`}
            spoken={`Pact Magic, ${levelLabel(pactSlots.level)}`}
            total={pactSlots.total}
          />
        )}
      </ul>
    </Card>
  );
}
