import type { CharacterPageRecord } from "@dnd/character";
import { Undo2 } from "lucide-react";
import { useNavigate, useParams } from "react-router";

/**
 * Undoes the newest change to a character's pages. `held` keeps it from racing a write
 * outside the page list's queue, such as restoring the defaults. An undo that takes away
 * the page on screen, as undoing its creation does, moves to the first visible page.
 */
export function PagesUndoButton({
  replace,
  held = false,
  onUndone,
}: {
  replace: { canUndo: boolean; undo: () => CharacterPageRecord[] | undefined };
  held?: boolean;
  onUndone: () => void;
}) {
  const { id, slug } = useParams();
  const navigate = useNavigate();
  const ready = replace.canUndo && !held;
  return (
    <button
      type="button"
      aria-disabled={!ready}
      onClick={() => {
        if (!ready) return;
        const restored = replace.undo();
        if (!restored) return;
        onUndone();
        if (restored.some((page) => page.slug === slug)) return;
        const landing = restored.find((page) => !page.hidden);
        if (landing) navigate(`/characters/${id}/p/${landing.slug}`, { replace: true });
      }}
      className="flex items-center gap-1 rounded-control border border-border px-3 py-1.5 text-muted text-row hover:bg-subtle aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
    >
      <Undo2 aria-hidden="true" size={13} />
      Undo page change
    </button>
  );
}
