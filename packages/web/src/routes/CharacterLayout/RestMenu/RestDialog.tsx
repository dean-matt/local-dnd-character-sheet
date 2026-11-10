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
import { useRecordRoll } from "../../../hooks/useRecordRoll.ts";
import { useReplaceCharacterState } from "../../../hooks/useReplaceCharacterState.ts";
import { ChangeList } from "./ChangeList.tsx";
import { HitDicePicks } from "./HitDicePicks.tsx";
import {
  type DialogSpend,
  type FeatureUse,
  type RestChange,
  restPreview,
  spentState,
} from "./restChanges.ts";
import { largestFirst, pickedDice } from "./restPicks.ts";
import { SpendHitDice } from "./SpendHitDice.tsx";

const TITLE: Record<RestLength, string> = { short: "Short rest", long: "Long rest" };

function appliedSummary(length: RestLength, changes: RestChange[]) {
  const moved = changes.map((change) => `${change.label} ${change.after}`).join(", ");
  return `${TITLE[length]} applied. ${moved ? `${moved}.` : "Nothing changed."}`;
}

function unloggedSummary(unlogged: number, logged: number) {
  if (logged === 0) return "The hit die rolls were not logged.";
  return `${unlogged} of ${unlogged + logged} hit die rolls were not logged.`;
}

function discardedSummary(length: RestLength, spent: number) {
  if (spent === 0) return undefined;
  const dice = spent === 1 ? "hit die spent was" : `${spent} hit dice spent were`;
  return `${TITLE[length]} cancelled. The ${dice} discarded.`;
}

/**
 * What a rest changes, listed before anything is written. Confirm writes the rested state in
 * one write and hands `onApplied` what it changed; Cancel, Escape and a failed write write
 * nothing. The dialog stays open while the write is in flight, so its outcome is shown. Hit
 * dice are picked only where more than one size was spent; with one size, the most that
 * return come back. A short rest spends hit dice before it is taken: the spends are
 * tentative, so closing the dialog discards them and hands `onClose` a sentence saying so,
 * and confirm writes them with the rest, then logs each roll. A roll that fails to log keeps
 * the dialog open on the applied rest to say how many. A spend the state no longer allows,
 * after a change from elsewhere, is neither shown, written nor logged.
 */
export function RestDialog({
  character,
  derived,
  state,
  features,
  length,
  onClose,
  onApplied,
}: {
  character: CharacterRecord;
  derived: CharacterDerived;
  state: CharacterState;
  /** The features whose uses a rest restores where it meets their reset. */
  features: readonly FeatureUse[];
  length: RestLength;
  /** Called on a close that writes nothing, with a sentence to announce where spends were discarded. */
  onClose: (announcement?: string) => void;
  /** Called with a sentence naming what the rest changed, once the write lands. */
  onApplied: (summary: string) => void;
}) {
  const { definition } = character;
  const replace = useReplaceCharacterState(character.id);
  const record = useRecordRoll(character.id);
  const [spends, setSpends] = useState<DialogSpend[]>([]);
  const [committing, setCommitting] = useState(false);
  const busy = replace.writing || committing;
  const pick = length === "long" ? longRestHitDicePick(definition, derived, state) : null;
  const [typed, setTyped] = useState(() => (pick ? largestFirst(pick) : []));
  const picked = pick ? pickedDice(pick, typed) : undefined;
  const [taken, setTaken] = useState<{ summary: string; unlogged: string }>();
  const spent = spentState(definition, derived, state, spends);
  const ready = !pick || picked !== undefined;
  const { after, changes } = ready
    ? restPreview(definition, derived, state, features, length, picked, spends)
    : { after: undefined, changes: undefined };

  function close() {
    if (busy) return;
    if (taken !== undefined) onApplied(taken.summary);
    else onClose(discardedSummary(length, spent.applied.length));
  }

  async function confirm() {
    if (!after || !changes || busy) return;
    setCommitting(true);
    try {
      await replace.mutateAsync(after);
    } catch {
      setCommitting(false);
      return;
    }
    const logged = spent.applied;
    // The landed state already holds the spends; kept, they would be counted twice.
    setSpends([]);
    let unlogged = 0;
    for (const spend of logged) {
      try {
        await record.mutateAsync(spend.roll);
      } catch {
        unlogged += 1;
      }
    }
    const summary = appliedSummary(length, changes);
    if (unlogged === 0) return onApplied(summary);
    setCommitting(false);
    setTaken({ summary, unlogged: unloggedSummary(unlogged, logged.length - unlogged) });
  }

  return (
    <Modal onClose={close} size="narrow">
      <ModalEntry
        title={TITLE[length]}
        footer={
          taken !== undefined ? (
            <button
              type="button"
              aria-disabled={busy}
              onClick={close}
              className="min-h-11 rounded-control bg-accent px-3.5 font-semibold text-row text-white hover:bg-accent-hover aria-disabled:cursor-not-allowed aria-disabled:bg-subtle aria-disabled:text-muted"
            >
              Done
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-disabled={busy}
                onClick={close}
                className="min-h-11 rounded-control px-3.5 font-semibold text-row hover:bg-subtle aria-disabled:cursor-not-allowed aria-disabled:text-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                aria-disabled={!after || busy}
                onClick={confirm}
                className="min-h-11 rounded-control bg-accent px-3.5 font-semibold text-row text-white hover:bg-accent-hover aria-disabled:cursor-not-allowed aria-disabled:bg-subtle aria-disabled:text-muted"
              >
                {committing ? "Resting…" : `Take the ${TITLE[length].toLowerCase()}`}
              </button>
            </div>
          )
        }
      >
        {taken !== undefined && (
          <>
            <p>{taken.summary}</p>
            <p role="alert" className="text-error text-row">
              {taken.unlogged}
            </p>
          </>
        )}
        {taken === undefined && length === "short" && (
          <SpendHitDice
            character={character}
            derived={derived}
            state={spent.state}
            spends={spent.applied}
            busy={busy}
            onChange={setSpends}
          />
        )}
        {taken === undefined && pick && pick.spent.length > 1 && (
          <HitDicePicks pick={pick} typed={typed} onChange={setTyped} />
        )}
        {/* The short rest's list follows each spend, which its own announcement already speaks. */}
        <div aria-live={length === "long" ? "polite" : undefined} hidden={taken !== undefined}>
          <ChangeList changes={changes} />
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
