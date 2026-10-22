import { Modal } from "../../../components/Modal.tsx";
import { ModalEntry } from "../../../components/ModalEntry.tsx";

const BUTTON = "rounded-control px-3.5 py-2 font-semibold text-row";

const changes = (count: number) => `${count} ${count === 1 ? "change" : "changes"}`;

/**
 * Asks before an undo back to `describedAs` and the `newer` entries after it, naming how
 * many changes they hold, `undoes`, and that there is no redo. `undoes` is `0` where the entry has left the log since the
 * dialog opened, and confirming is then refused.
 */
export function UndoToHereDialog({
  describedAs,
  newer,
  undoes,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  describedAs: string;
  newer: number;
  undoes: number;
  pending: boolean;
  error: Error | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const ready = undoes > 0 && !pending;
  return (
    <Modal onClose={onClose}>
      <ModalEntry
        title={undoes > 0 ? `Undo ${changes(undoes)}?` : "Change no longer in the history"}
        footer={
          <div className="flex items-center gap-2">
            <p role="alert" className="text-error text-row">
              {error && `Undo failed: ${error.message}`}
            </p>
            <button
              type="button"
              onClick={onClose}
              className={`${BUTTON} border border-border bg-surface text-ink hover:bg-subtle`}
            >
              Cancel
            </button>
            <button
              type="button"
              aria-disabled={!ready}
              onClick={() => ready && onConfirm()}
              className={`${BUTTON} bg-accent text-white hover:bg-accent-hover aria-disabled:cursor-not-allowed aria-disabled:opacity-50`}
            >
              {undoes > 0 ? `Undo ${changes(undoes)}` : "Undo"}
            </button>
          </div>
        }
      >
        {undoes > 0 ? (
          <p>
            This undoes “{describedAs}”
            {newer > 0 && ` and the ${newer} ${newer === 1 ? "entry" : "entries"} after it`},{" "}
            {changes(undoes)} in all, restoring the character as it was before. There is no redo.
          </p>
        ) : (
          <p>The history changed since this opened. Close this and pick again.</p>
        )}
      </ModalEntry>
    </Modal>
  );
}
