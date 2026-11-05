import type { CharacterRecord, RestLength } from "@dnd/character";
import { FlameKindling } from "lucide-react";
import { useId, useState } from "react";
import { useCharacterDerived } from "../../../hooks/useCharacterDerived.ts";
import { useCharacterState } from "../../../hooks/useCharacterState.ts";
import { useReturnFocus } from "../../../hooks/useReturnFocus.ts";
import { RestDialog } from "./RestDialog.tsx";
import { recoverySummary } from "./recoverySummary.ts";
import { restPreview } from "./restChanges.ts";

/**
 * The header's Rest button and the menu under it, whose items open the dialog for a short or
 * a long rest. Escape, or focus leaving the menu, closes it; focus returns to the button when
 * the dialog closes, and a rest applied is announced, since its dialog closes on it. The short
 * rest's line names what it would recover, from the same changes its dialog lists. The
 * button waits on the sheet's derived block and state, which the dialog reads, and names
 * why where either failed to load.
 */
export function RestMenu({ character }: { character: CharacterRecord }) {
  const derived = useCharacterDerived(character.id);
  const state = useCharacterState(character.id);
  const [menuOpen, setMenuOpen] = useState(false);
  const [resting, setResting] = useState<RestLength>();
  const [applied, setApplied] = useState<string>();
  const button = useReturnFocus<HTMLButtonElement>(resting !== undefined);
  const menuId = useId();
  const ready = derived.data !== undefined && state.data !== undefined;
  const failed = derived.error ?? state.error;
  const rests: { length: RestLength; title: string; description: string }[] = [
    {
      length: "short",
      title: "Short rest",
      description:
        derived.data && state.data
          ? recoverySummary(
              restPreview(character.definition, derived.data, state.data.state, "short").changes,
            )
          : "",
    },
    { length: "long", title: "Long rest", description: "Restore HP, Hit Dice and spent resources" },
  ];

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Escape and focusout bubbling from the button and the menu.
    <div
      className="relative shrink-0"
      onKeyDown={(event) => {
        if (event.key === "Escape" && menuOpen) {
          event.preventDefault();
          setMenuOpen(false);
          button.current?.focus();
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setMenuOpen(false);
      }}
    >
      <button
        ref={button}
        type="button"
        title={failed ? `A rest is unavailable: ${failed.message}` : "Take a short or long rest"}
        aria-expanded={menuOpen}
        aria-controls={menuOpen ? menuId : undefined}
        aria-disabled={!ready}
        onClick={() => ready && setMenuOpen((open) => !open)}
        className="flex h-8 items-center gap-1.5 rounded-control border border-border px-2.5 font-semibold text-label text-muted hover:bg-subtle aria-disabled:cursor-not-allowed aria-expanded:bg-accent-tint aria-expanded:text-ink"
      >
        <FlameKindling size={14} aria-hidden="true" />
        Rest
      </button>
      {menuOpen && (
        <div
          id={menuId}
          className="absolute top-full right-0 z-40 mt-1 flex w-max max-w-[calc(100vw-2rem)] flex-col rounded-card border border-border bg-surface p-1.5 shadow-popover"
        >
          {rests.map(({ length, title, description }) => (
            <button
              key={length}
              type="button"
              aria-haspopup="dialog"
              aria-labelledby={`${menuId}-${length}-title`}
              aria-describedby={`${menuId}-${length}-description`}
              // Keeps focus on the menu through the click, so the blur above cannot close it first.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setMenuOpen(false);
                setResting(length);
              }}
              className="flex flex-col items-start gap-px rounded-control px-2.5 py-2 text-left hover:bg-subtle"
            >
              <span id={`${menuId}-${length}-title`} className="font-semibold text-ink text-row">
                {title}
              </span>
              <span id={`${menuId}-${length}-description`} className="text-label text-muted">
                {description}
              </span>
            </button>
          ))}
        </div>
      )}
      {resting && derived.data && state.data && (
        <RestDialog
          character={character}
          derived={derived.data}
          state={state.data.state}
          length={resting}
          onClose={() => setResting(undefined)}
          onApplied={(summary) => {
            setResting(undefined);
            setApplied(summary);
          }}
        />
      )}
      {/* Mounted while empty: a live region added with its text is often not announced. */}
      <span role="status" className="sr-only">
        {applied}
      </span>
    </div>
  );
}
