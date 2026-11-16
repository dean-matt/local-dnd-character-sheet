import {
  type CharacterDerived,
  type CharacterRecord,
  type CharacterState,
  derivedValue,
  encounterEnded,
  encounterStarted,
  initiativeRolled,
  roundAdvanced,
} from "@dnd/character";
import { rollDice } from "@dnd/dice";
import { useEffect, useRef, useState } from "react";
import { useAnnouncedStateWrite } from "../../../../hooks/useAnnouncedStateWrite.ts";
import { useCharacterState } from "../../../../hooks/useCharacterState.ts";
import { useReplaceDefinitionAndState } from "../../../../hooks/useReplaceDefinitionAndState.ts";
import { Announcer } from "../../../Announcer.tsx";
import { Card } from "../../../Card.tsx";
import { EmptyNote } from "../../../EmptyNote.tsx";

const BUTTON =
  "h-8 rounded-control border border-border bg-surface px-3 font-semibold text-row hover:bg-subtle aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

/**
 * The Encounter card: the round of the character's encounter and the initiative rolled for it,
 * with controls that start, advance and end it. Each change is one state write, announced once
 * it lands. Rolling initiative logs the roll in the same write, so one undo takes both back,
 * and starts an encounter where none runs.
 */
export function Encounter({
  character,
  derived,
}: {
  character: CharacterRecord;
  derived: Pick<CharacterDerived, "initiative">;
}) {
  const play = useCharacterState(character.id);
  const replace = useAnnouncedStateWrite(character.id);
  const both = useReplaceDefinitionAndState(character.id);
  const start = useRef<HTMLButtonElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  // The control that took focus unmounts on press, so focus moves to the one that replaces it.
  const [focusNext, setFocusNext] = useState<"start" | "next">();
  const running = play.data?.state.encounter != null;
  useEffect(() => {
    if (focusNext === undefined || running !== (focusNext === "next")) return;
    (focusNext === "next" ? next : start).current?.focus();
    setFocusNext(undefined);
  }, [focusNext, running]);
  if (!play.data) return null;
  const state = play.data.state;
  const { encounter } = state;
  const busy = replace.writing;

  function change(after: CharacterState, text: string) {
    if (!busy) replace.write(after, text);
  }

  async function rollInitiative() {
    if (busy) return;
    const bonus = derivedValue(derived.initiative);
    const notation = bonus === 0 ? "1d20" : `1d20${bonus < 0 ? "-" : "+"}${Math.abs(bonus)}`;
    const rolled = rollDice(notation);
    try {
      await both.mutateAsync({
        state: (latest) => initiativeRolled(latest, rolled.total),
        edit: (latest) => latest,
        roll: {
          label: "Initiative",
          type: "check",
          origin: "Initiative",
          notation: rolled.notation,
          total: rolled.total,
          dice: rolled.dice,
          modifier: rolled.modifier,
          critical: rolled.critical,
        },
      });
    } catch (error) {
      replace.announce(`Initiative was not rolled: ${(error as Error).message}`);
      return;
    }
    replace.announce(`Initiative ${rolled.total}`);
  }

  const advanced = roundAdvanced(state);

  return (
    <Card title="Encounter">
      {encounter ? (
        <p className="text-row">
          <span className="font-semibold">Round {encounter.round}</span>
          <span className="text-muted"> · Initiative {encounter.initiative ?? "not rolled"}</span>
        </p>
      ) : (
        <EmptyNote>No encounter running.</EmptyNote>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        {!encounter && (
          <button
            type="button"
            aria-disabled={busy}
            ref={start}
            onClick={() => {
              change(encounterStarted(state), "Encounter started, round 1");
              setFocusNext("next");
            }}
            className={BUTTON}
          >
            Start encounter
          </button>
        )}
        <button type="button" aria-disabled={busy} onClick={rollInitiative} className={BUTTON}>
          {encounter?.initiative == null ? "Roll initiative" : "Reroll initiative"}
        </button>
        {encounter && (
          <>
            <button
              type="button"
              ref={next}
              aria-disabled={busy || advanced === state}
              onClick={() =>
                advanced !== state && change(advanced, `Round ${advanced.encounter?.round}`)
              }
              className={BUTTON}
            >
              Next round
            </button>
            <button
              type="button"
              aria-disabled={busy}
              onClick={() => {
                change(encounterEnded(state), "Encounter ended");
                setFocusNext("start");
              }}
              className={BUTTON}
            >
              End encounter
            </button>
          </>
        )}
      </div>
      <Announcer announced={replace.announced} />
    </Card>
  );
}
