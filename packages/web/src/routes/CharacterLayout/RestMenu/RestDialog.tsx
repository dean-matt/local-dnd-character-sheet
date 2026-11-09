import {
  type CharacterDerived,
  type CharacterRecord,
  type CharacterState,
  longRestHitDicePick,
  type RestLength,
} from "@dnd/character";
import { useState } from "react";
import { Modal } from "../../../components/Modal.tsx";
import { ModalEntry } from "../../../components/ModalEntry.tsx";
import { useReplaceCharacterState } from "../../../hooks/useReplaceCharacterState.ts";
import { HitDicePicks } from "./HitDicePicks.tsx";
import { restPreview } from "./restChanges.ts";
import { largestFirst, pickedDice } from "./restPicks.ts";
import { SpendHitDice } from "./SpendHitDice.tsx";

const TITLE: Record<RestLength, string> = { short: "Short rest", long: "Long rest" };

/**
 * What a rest changes, listed before anything is written. Confirm writes the rested state in
 * one write and hands `onApplied` what it changed; Cancel, Escape and a failed write write
 * nothing. The dialog stays open while the write is in flight, so its outcome is shown. Hit
 * dice are picked only where more than one size was spent; with one size, the most that
 * return come back. A short rest, once confirmed, stays open to spend hit dice, each spend
 * its own write; closing it then announces the rest and keeps every die already spent.
 */
export function RestDialog({
  character,
  derived,
  state,
  length,
  onClose,
  onApplied,
}: {
  character: CharacterRecord;
  derived: CharacterDerived;
  state: CharacterState;
  length: RestLength;
  onClose: () => void;
  /** Called with a sentence naming what the rest changed, once the write lands. */
  onApplied: (summary: string) => void;
}) {
  const { definition } = character;
  const replace = useReplaceCharacterState(character.id);
  const pick = length === "long" ? longRestHitDicePick(definition, derived, state) : null;
  const [typed, setTyped] = useState(() => (pick ? largestFirst(pick) : []));
  const picked = pick ? pickedDice(pick, typed) : undefined;
  const [taken, setTaken] = useState<string>();
  const ready = !pick || picked !== undefined;
  const { after, changes } = ready
    ? restPreview(definition, derived, state, length, picked)
    : { after: undefined, changes: undefined };

  function close() {
    if (replace.writing) return;
    if (taken === undefined) onClose();
    else onApplied(taken);
  }

  async function confirm() {
    if (!after || !changes || replace.writing) return;
    try {
      await replace.mutateAsync(after);
    } catch {
      return;
    }
    const moved = changes.map((change) => `${change.label} ${change.after}`).join(", ");
    const summary = `${TITLE[length]} applied. ${moved ? `${moved}.` : "Nothing changed."}`;
    if (length === "short") setTaken(summary);
    else onApplied(summary);
  }

  return (
    <Modal onClose={close} size="narrow">
      <ModalEntry
        title={TITLE[length]}
        footer={
          taken !== undefined ? (
            <button
              type="button"
              aria-disabled={replace.writing}
              onClick={close}
              className="min-h-11 rounded-control bg-accent px-3.5 font-semibold text-row text-white hover:bg-accent-hover aria-disabled:cursor-not-allowed aria-disabled:bg-subtle aria-disabled:text-muted"
            >
              Done
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-disabled={replace.writing}
                onClick={close}
                className="min-h-11 rounded-control px-3.5 font-semibold text-row hover:bg-subtle aria-disabled:cursor-not-allowed aria-disabled:text-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                aria-disabled={!after || replace.writing}
                onClick={confirm}
                className="min-h-11 rounded-control bg-accent px-3.5 font-semibold text-row text-white hover:bg-accent-hover aria-disabled:cursor-not-allowed aria-disabled:bg-subtle aria-disabled:text-muted"
              >
                {replace.isPending ? "Resting…" : `Take the ${TITLE[length].toLowerCase()}`}
              </button>
            </div>
          )
        }
      >
        {taken !== undefined && (
          <>
            <p>{taken}</p>
            <SpendHitDice character={character} derived={derived} state={state} />
          </>
        )}
        {taken === undefined && pick && pick.spent.length > 1 && (
          <HitDicePicks pick={pick} typed={typed} onChange={setTyped} />
        )}
        <div aria-live="polite" hidden={taken !== undefined}>
          {changes === undefined ? (
            <p className="text-muted">Pick the hit dice to recover to see what the rest changes.</p>
          ) : changes.length > 0 ? (
            <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 text-row">
              {changes.map((change) => (
                <div key={change.key} className="contents">
                  <dt>{change.label}</dt>
                  <dd className="text-right font-semibold tabular-nums">
                    {change.before} → {change.after}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-muted">This rest changes nothing.</p>
          )}
        </div>
        {replace.error && (
          <p role="alert" className="text-error text-row">
            The rest was not applied: {replace.error.message}
          </p>
        )}
      </ModalEntry>
    </Modal>
  );
}
