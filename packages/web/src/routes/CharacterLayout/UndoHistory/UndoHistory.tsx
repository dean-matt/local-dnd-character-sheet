import { UNDO_LOG_LIMIT } from "@dnd/character";
import { useIsMutating } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { EmptyNote } from "../../../components/EmptyNote.tsx";
import { characterDefinitionWriteKey } from "../../../hooks/characterKeys.ts";
import { useCharacter } from "../../../hooks/useCharacter.ts";
import { useCharacterUndoLog } from "../../../hooks/useCharacterUndoLog.ts";
import { useUndoCharacterChange } from "../../../hooks/useUndoCharacterChange.ts";
import { UndoHistoryEntry } from "./UndoHistoryEntry.tsx";
import { UndoToHereDialog } from "./UndoToHereDialog.tsx";

const SCOPE = `Your last ${UNDO_LOG_LIMIT} changes.`;

/**
 * The character's undo log, newest first, each entry able to undo back to itself after a
 * confirmation, which stays open until the undo it sent settles. The heading takes focus
 * when the panel opens, and again after an undo removes the entry that held it.
 */
export function UndoHistory({ characterId }: { characterId: string }) {
  const log = useCharacterUndoLog(characterId);
  const character = useCharacter(characterId);
  const undo = useUndoCharacterChange(characterId);
  const writing = useIsMutating({ mutationKey: characterDefinitionWriteKey(characterId) }) > 0;
  const [marked, setMarked] = useState<number | null>(null);
  const [confirming, setConfirming] = useState<{ id: number; describedAs: string } | null>(null);
  const [announced, setAnnounced] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);

  useEffect(() => heading.current?.focus(), []);

  const entries = log.data ?? [];
  // Every entry back to and including `at`, counted in the field changes each holds.
  const undoneBy = (at: number) =>
    entries.slice(0, at + 1).reduce((sum, entry) => sum + entry.changes.length, 0);
  const confirmingAt = confirming ? entries.findIndex((entry) => entry.id === confirming.id) : -1;
  const undoes = confirmingAt < 0 ? 0 : undoneBy(confirmingAt);

  function close() {
    if (undo.isPending) return;
    setConfirming(null);
    undo.reset();
    setTimeout(() => trigger.current?.focus(), 0);
  }

  function confirm() {
    const newest = entries[0];
    const readAt = character.data?.updatedAt;
    if (!confirming || !newest || !readAt) return;
    const count = undoes;
    setAnnounced("");
    undo.mutate(
      { to: confirming.id, newest: newest.id, readAt },
      {
        onSuccess: () => {
          setConfirming(null);
          setMarked(null);
          setAnnounced(`Undid ${count} ${count === 1 ? "change" : "changes"}`);
          setTimeout(() => heading.current?.focus(), 0);
        },
      },
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5">
      <h2 ref={heading} tabIndex={-1} className="font-bold text-title">
        Undo history
      </h2>
      <p className="text-muted text-row">{SCOPE}</p>
      <p role="status" aria-live="polite" className="text-row">
        {announced}
      </p>
      {log.isError && <p className="text-error text-row">{log.error.message}</p>}
      {log.isSuccess && entries.length === 0 && <EmptyNote>Nothing to undo.</EmptyNote>}
      <ol className="flex min-h-0 flex-col gap-2 overflow-y-auto">
        {entries.map((entry, at) => (
          <UndoHistoryEntry
            key={entry.id}
            entry={entry}
            undoes={undoneBy(at)}
            marked={marked !== null && at <= marked}
            disabled={writing || !character.data}
            onMark={(on) => setMarked((current) => (on ? at : current === at ? null : current))}
            onUndo={(button) => {
              trigger.current = button;
              setConfirming({ id: entry.id, describedAs: entry.describedAs });
            }}
          />
        ))}
      </ol>
      {confirming && (
        <UndoToHereDialog
          describedAs={confirming.describedAs}
          newer={Math.max(confirmingAt, 0)}
          undoes={undoes}
          pending={undo.isPending}
          error={undo.error}
          onConfirm={confirm}
          onClose={close}
        />
      )}
    </div>
  );
}
