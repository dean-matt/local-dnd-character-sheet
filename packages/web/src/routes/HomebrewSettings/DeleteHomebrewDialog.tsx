import { Link } from "react-router";
import { Modal } from "../../components/Modal.tsx";
import { ModalEntry } from "../../components/ModalEntry.tsx";
import { refusedHolders } from "../../lib/refusedHolders.ts";

const BUTTON = "rounded-control px-3.5 py-2 font-semibold text-row";

export interface DeleteHomebrewDialogProps {
  name: string;
  noun: string;
  deleting: boolean;
  error: Error | null;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Asks before deleting a homebrew row, which Undo and Recently deleted bring back until the API restarts. A row a character
 * still holds is refused, and the refusal links each character holding it.
 */
export function DeleteHomebrewDialog({
  name,
  noun,
  deleting,
  error,
  onConfirm,
  onClose,
}: DeleteHomebrewDialogProps) {
  const { characters: holding, items } = refusedHolders(error);
  const held = holding.length + items.length > 0;
  return (
    <Modal onClose={onClose}>
      <ModalEntry
        title={`Delete ${name}?`}
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className={`${BUTTON} border border-border bg-surface text-ink hover:bg-subtle`}
            >
              Cancel
            </button>
            <button
              type="button"
              aria-disabled={deleting || held}
              onClick={() => !deleting && !held && onConfirm()}
              className={`${BUTTON} bg-accent text-white hover:bg-accent-hover aria-disabled:cursor-not-allowed aria-disabled:opacity-50`}
            >
              Delete
            </button>
          </div>
        }
      >
        <p>
          This deletes the homebrew {noun}. Undo or Recently deleted restores it until the API
          restarts. While a character or an item holds it, the delete is refused.
        </p>
        <div role="alert" className="text-error">
          {held ? (
            <>
              {holding.length > 0 && (
                <>
                  <p>
                    {name} is still on{" "}
                    {holding.length === 1 ? "this character" : "these characters"}. Remove it from
                    each, then delete it:
                  </p>
                  <ul className="mt-1 list-disc pl-5">
                    {holding.map((character) => (
                      <li key={character.id}>
                        <Link to={`/characters/${character.id}`} className="underline">
                          {character.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {items.length > 0 && (
                <>
                  <p>
                    {name} is still named by {items.length === 1 ? "this item" : "these items"}.
                    Remove it from each, then delete it:
                  </p>
                  <ul className="mt-1 list-disc pl-5">
                    {items.map((each) => (
                      <li key={each.id}>{each.name}</li>
                    ))}
                  </ul>
                </>
              )}
            </>
          ) : (
            error && <p>Delete failed: {error.message}</p>
          )}
        </div>
      </ModalEntry>
    </Modal>
  );
}
