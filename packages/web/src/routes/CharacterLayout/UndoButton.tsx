import { Undo2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useCharacterUndoLog } from "../../hooks/useCharacterUndoLog.ts";
import { useUndoCharacterChange } from "../../hooks/useUndoCharacterChange.ts";

const SCOPE =
  "Undo reaches back 50 edits to this character's details. It does not reach play " +
  "state, page layout or a deleted character, and there is no redo.";

/** A text control keeps its own undo, so the shortcut leaves it to the browser there. */
function typingIn(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.closest("input, textarea, select") !== null)
  );
}

/**
 * Restores the character's newest undo entry, named in the button's label. Control+Z or
 * Command+Z does the same from anywhere on the page outside a text control.
 */
export function UndoButton({ characterId }: { characterId: string }) {
  const log = useCharacterUndoLog(characterId);
  const undo = useUndoCharacterChange(characterId);
  const [announced, setAnnounced] = useState("");
  const scopeId = useId();
  const next = log.data?.[0];
  const ready = next !== undefined && !undo.isPending;
  const label = next ? `Undo ${next.describedAs}` : "Nothing to undo";

  function run() {
    if (!next || undo.isPending) return;
    setAnnounced("");
    undo.mutate(undefined, { onSuccess: () => setAnnounced(`Undid ${next.describedAs}`) });
  }

  // The listener outlives a render, so it reads the latest `run` through a ref.
  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "z" || !(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) {
        return;
      }
      if (typingIn(e.target)) return;
      e.preventDefault();
      runRef.current();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="flex shrink-0 items-center gap-2">
      <span role="status" aria-live="polite" className="max-w-60 truncate text-muted text-row">
        {undo.isError ? `Undo failed: ${undo.error.message}` : announced}
      </span>
      <button
        type="button"
        onClick={run}
        aria-disabled={!ready}
        aria-keyshortcuts="Control+Z Meta+Z"
        aria-describedby={scopeId}
        title={`${label}\n${SCOPE}`}
        className="flex size-8 items-center justify-center rounded-control border border-border text-muted hover:bg-subtle aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
      >
        <Undo2 size={16} aria-hidden="true" />
        <span className="sr-only">{label}</span>
      </button>
      <span id={scopeId} hidden>
        {SCOPE}
      </span>
    </div>
  );
}
