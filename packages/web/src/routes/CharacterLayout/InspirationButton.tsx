import { Zap } from "lucide-react";
import { Announcer } from "../../components/Announcer.tsx";
import { useAnnouncedStateWrite } from "../../hooks/useAnnouncedStateWrite.ts";
import { useCharacterState } from "../../hooks/useCharacterState.ts";

/**
 * The header's bolt: filled with the accent while the character holds inspiration. A click
 * is one state write, so one undo entry, announced once it lands. Inert until the state loads.
 */
export function InspirationButton({ characterId }: { characterId: string }) {
  const state = useCharacterState(characterId);
  const replace = useAnnouncedStateWrite(characterId);
  const held = state.data?.state.inspiration ?? false;

  function toggle() {
    if (!state.data || replace.writing) return;
    replace.write(
      { ...state.data.state, inspiration: !held },
      held ? "Inspiration spent" : "Inspiration gained",
    );
  }

  return (
    <>
      <button
        type="button"
        aria-label="Inspiration"
        aria-pressed={held}
        aria-disabled={!state.data || replace.writing}
        title="Inspiration: spend for advantage on one roll"
        onClick={toggle}
        className="flex size-8 shrink-0 items-center justify-center rounded-control border border-border text-muted hover:bg-subtle aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-pressed:border-accent aria-pressed:bg-accent-tint aria-pressed:text-accent-text"
      >
        <Zap size={16} aria-hidden="true" fill={held ? "currentColor" : "none"} />
      </button>
      <Announcer announced={replace.announced} />
    </>
  );
}
