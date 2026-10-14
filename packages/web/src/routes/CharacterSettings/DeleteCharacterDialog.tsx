import type { CharacterRecord } from "@dnd/character";
import { useId, useState } from "react";
import { useNavigate } from "react-router";
import { InputField } from "../../components/InputField.tsx";
import { Modal } from "../../components/Modal.tsx";
import { ModalEntry } from "../../components/ModalEntry.tsx";
import { useCharacterPages } from "../../hooks/useCharacterPages.ts";
import { useDeleteCharacter } from "../../hooks/useDeleteCharacter.ts";

const BUTTON = "rounded-control px-3.5 py-2 font-semibold text-row";

/**
 * Deletes the character once its name is typed back, so a stray click or Enter cannot. It
 * names everything that goes with it and the one way back, since undo has none.
 */
export function DeleteCharacterDialog({
  character,
  onClose,
}: {
  character: CharacterRecord;
  onClose: () => void;
}) {
  const pages = useCharacterPages(character.id).data;
  const remove = useDeleteCharacter(character.id);
  const navigate = useNavigate();
  const [typed, setTyped] = useState("");
  const formId = useId();
  const confirmed = typed === character.name;
  const ready = confirmed && !remove.isPending;
  const pageCount = pages ? `all ${pages.length} of its pages` : "its pages";

  return (
    <Modal onClose={onClose}>
      <ModalEntry
        title={`Delete ${character.name}?`}
        footer={
          <div className="flex items-center gap-2">
            <p role="alert" className="text-error text-row">
              {remove.isError && `Delete failed: ${remove.error.message}`}
            </p>
            <button
              type="button"
              onClick={onClose}
              className={`${BUTTON} border border-border bg-surface text-ink hover:bg-subtle`}
            >
              Cancel
            </button>
            <button
              type="submit"
              form={formId}
              aria-disabled={!ready}
              className={`${BUTTON} bg-accent text-white hover:bg-accent-hover aria-disabled:cursor-not-allowed aria-disabled:opacity-50`}
            >
              Delete
            </button>
          </div>
        }
      >
        <p>
          This deletes the sheet, its play state, {pageCount}, its roll log and its undo history.
        </p>
        <p>
          Undo cannot bring it back. A snapshot of <code>characters.db</code> lands in{" "}
          <code>data/backups/</code> first, and <code>docs/reviving.md</code> says how to restore
          the character from it.
        </p>
        <form
          id={formId}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (!ready) return;
            remove.mutate(undefined, { onSuccess: () => navigate("/characters") });
          }}
        >
          <InputField
            label={`Type ${character.name} to confirm`}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </form>
      </ModalEntry>
    </Modal>
  );
}
