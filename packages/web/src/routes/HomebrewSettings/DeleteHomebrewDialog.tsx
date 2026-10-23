import { Link } from "react-router";
import { z } from "zod";
import { Modal } from "../../components/Modal.tsx";
import { ModalEntry } from "../../components/ModalEntry.tsx";
import { ApiError } from "../../lib/api.ts";

const BUTTON = "rounded-control px-3.5 py-2 font-semibold text-row";

const namedSchema = z.object({ id: z.string(), name: z.string() });

const refusalSchema = z.object({
  characters: z.array(namedSchema),
  items: z.array(namedSchema).default([]),
});

/** The characters and items a refused delete names; none where it failed for another reason. */
function holders(error: Error | null) {
  const none = { characters: [], items: [] };
  if (!(error instanceof ApiError) || error.status !== 409) return none;
  return refusalSchema.safeParse(error.body).data ?? none;
}

export interface DeleteHomebrewDialogProps {
  name: string;
  noun: string;
  deleting: boolean;
  error: Error | null;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Asks before deleting a homebrew row, since nothing brings one back. A row a character
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
  const { characters: holding, items } = holders(error);
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
          This deletes the homebrew {noun} for good. While a character or an item holds it, the
          delete is refused.
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
