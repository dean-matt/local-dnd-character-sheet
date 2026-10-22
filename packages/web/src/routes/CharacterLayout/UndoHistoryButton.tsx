import { useIsMutating } from "@tanstack/react-query";
import { History } from "lucide-react";
import { type Ref, useEffect, useId, useRef, useState } from "react";
import { characterDefinitionWriteKey } from "../../hooks/characterKeys.ts";
import { useCharacterUndoLog } from "../../hooks/useCharacterUndoLog.ts";
import { useUndoCharacterChange } from "../../hooks/useUndoCharacterChange.ts";

const TEXT_ENTRY =
  "textarea, input:not([type]), input[type='text'], input[type='search'], " +
  "input[type='email'], input[type='url'], input[type='tel'], input[type='password'], " +
  "input[type='number']";

/**
 * A text control keeps its own undo, so the shortcut leaves it to the browser there. An
 * open dialog hides the sheet, so the shortcut leaves that alone too.
 */
function shortcutIgnoredIn(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.closest(`${TEXT_ENTRY}, dialog[open]`) !== null)
  );
}

/**
 * Opens and closes the undo history panel `panelId` names. Control+Z or Command+Z
 * restores the newest entry, which the button's description names, from anywhere on the
 * page outside a text control, and the status beside the button announces what it undid.
 */
export function UndoHistoryButton({
  characterId,
  panelId,
  open,
  onToggle,
  ref,
}: {
  characterId: string;
  panelId: string;
  open: boolean;
  onToggle: () => void;
  ref?: Ref<HTMLButtonElement>;
}) {
  const log = useCharacterUndoLog(characterId);
  const undo = useUndoCharacterChange(characterId);
  const [announced, setAnnounced] = useState("");
  const writing = useIsMutating({ mutationKey: characterDefinitionWriteKey(characterId) }) > 0;
  const next = log.data?.[0];
  const shortcutId = useId();
  const shortcut = next ? `Control+Z or Command+Z undoes ${next.describedAs}` : "Nothing to undo";

  function undoNewest() {
    if (!next || undo.isPending || writing) return;
    setAnnounced("");
    undo.mutate(undefined, { onSuccess: () => setAnnounced(`Undid ${next.describedAs}`) });
  }

  // The listener outlives a render, so it reads the latest `undoNewest` through a ref.
  const undoRef = useRef(undoNewest);
  undoRef.current = undoNewest;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "z" || !(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) {
        return;
      }
      if (shortcutIgnoredIn(e.target)) return;
      e.preventDefault();
      undoRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="flex shrink-0 items-center gap-2">
      <span
        role="status"
        aria-live="polite"
        data-failed={undo.isError}
        className="max-w-60 truncate text-muted text-row data-[failed=true]:text-error"
      >
        {undo.isError ? `Undo failed: ${undo.error.message}` : announced}
      </span>
      <button
        ref={ref}
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-describedby={shortcutId}
        title={`Undo Changes\n${shortcut}`}
        className="flex size-8 items-center justify-center rounded-control border border-border text-muted hover:bg-subtle aria-expanded:bg-accent-tint aria-expanded:text-ink"
      >
        <History size={16} aria-hidden="true" />
        <span className="sr-only">Undo Changes</span>
      </button>
      <span id={shortcutId} hidden>
        {shortcut}
      </span>
    </div>
  );
}
