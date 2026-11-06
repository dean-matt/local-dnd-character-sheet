import {
  type CharacterDerived,
  type CharacterRecord,
  type CharacterState,
  characterDerivedSchema,
  overrideKey,
  sheetState,
} from "@dnd/character";
import { ErrorState } from "../../../../ErrorState.tsx";
import { useAnnouncedStateWrite } from "../../../../hooks/useAnnouncedStateWrite.ts";
import { useCharacterState } from "../../../../hooks/useCharacterState.ts";
import { LoadingState } from "../../../../LoadingState.tsx";
import { levelLabel, ORDINAL } from "../../../../lib/spellLevel.ts";
import { Announcer } from "../../../Announcer.tsx";
import { Card } from "../../../Card.tsx";
import { SpellSlotRow } from "./SpellSlotRow.tsx";

const { shape } = characterDerivedSchema;

type Slot = CharacterState["spellSlots"][number];

/** The state with one slot level's entry replaced, or the pact slots' where `pact` is set. */
function expendedState(state: CharacterState, slot: Slot, pact: boolean): CharacterState {
  if (pact) return { ...state, pactSlots: slot };
  const others = state.spellSlots.filter((held) => held.level !== slot.level);
  return {
    ...state,
    spellSlots: [...others, slot].sort((a, b) => a.level - b.level),
  };
}

/**
 * The Spell Slots card: a row per slot level and one for pact slots, each pip filled while
 * its slot is expended. Expended counts are read against the totals the card shows, as a
 * rest reads them. Each spend or restore is one state write, announced once it lands.
 */
export function SpellSlots({
  character,
  derived,
}: {
  character: CharacterRecord;
  derived: CharacterDerived;
}) {
  const { spellSlots, pactSlots } = derived;
  const state = useCharacterState(character.id);
  const replace = useAnnouncedStateWrite(character.id);
  if (spellSlots.length === 0 && !pactSlots) return null;
  if (state.isPending) return <LoadingState label="Loading spell slots…" />;
  if (state.isError) return <ErrorState error={state.error} />;

  const stored = state.data.state;
  const sheet = sheetState(derived, stored);
  const pactSlot = sheet.pactSlots;
  const pactSpoken = pactSlots && `Pact Magic, ${levelLabel(pactSlots.level)}`;

  function expend(slot: Slot, pact: boolean, spoken: string, expended: number) {
    replace.write(
      expendedState(stored, { ...slot, expended }, pact),
      `${spoken} spell slots: ${slot.total - expended} of ${slot.total} left.`,
    );
  }

  return (
    <Card title="Spell Slots">
      <ul className="flex flex-col gap-1.5">
        {spellSlots.map((slot, index) => {
          const held = sheet.spellSlots[index] as Slot;
          const label = levelLabel(slot.level);
          return (
            <SpellSlotRow
              key={slot.level}
              label={label}
              total={slot.total}
              expended={held.expended}
              writing={replace.writing}
              onExpend={(expended) => expend(held, false, label, expended)}
              overrideKey={`${overrideKey("spellSlots", slot, character.definition)}.total`}
              schema={shape.spellSlots.element.shape.total.shape.computed}
            />
          );
        })}
        {pactSlots && pactSpoken && pactSlot && (
          <SpellSlotRow
            label={`Pact ${ORDINAL[pactSlots.level]}`}
            spoken={pactSpoken}
            total={pactSlots.total}
            expended={pactSlot.expended}
            writing={replace.writing}
            onExpend={(expended) => expend(pactSlot, true, pactSpoken, expended)}
            overrideKey="pactSlots.total"
            schema={shape.pactSlots.unwrap().shape.total.shape.computed}
          />
        )}
      </ul>
      {replace.error && (
        <p role="alert" className="mt-1 text-error text-row">
          Spell slots were not changed: {replace.error.message}
        </p>
      )}
      <Announcer announced={replace.announced} />
    </Card>
  );
}
