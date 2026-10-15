import { type KeyboardEvent, useId, useRef, useState } from "react";
import { Link } from "react-router";
import { type AddOutcome, useAddToCharacter } from "../../hooks/useAddToCharacter.ts";
import { useCharacters } from "../../hooks/useCharacters.ts";
import { useSheetCharacter } from "../../hooks/useSheetCharacter.ts";
import type { Addable } from "../../lib/addable.ts";
import { AddToOption } from "./AddToOption.tsx";

const LOOKS = {
  quiet:
    "rounded-control border border-border bg-surface px-2.5 py-1 text-label font-semibold text-accent-text hover:bg-subtle",
  primary:
    "rounded-control bg-accent px-3.5 py-2 text-row font-semibold text-white hover:bg-accent-hover",
};

export interface AddToProps {
  row: Addable;
  /** Called once an add settles, with what to tell the user. */
  onAdded: (outcome: AddOutcome) => void;
  look?: keyof typeof LOOKS;
  /** Opens the character list above the button, as at the foot of a modal. */
  above?: boolean;
}

/**
 * "Add to…" for one row. From a character's sheet it adds to that character; anywhere else
 * it first lists the characters to choose from, and offers to create one where there are
 * none. Escape, or focus leaving, closes the list, and focus returns to the button once an
 * add settles.
 */
export function AddTo({ row, onAdded, look = "quiet", above = false }: AddToProps) {
  const sheet = useSheetCharacter();
  const addToSheet = useAddToCharacter(sheet?.id ?? "");
  const characters = useCharacters();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const listId = useId();

  // A ref rather than `busy`, which a second click in the same tick reads stale.
  const adding = useRef(false);

  function run(add: (row: Addable) => Promise<AddOutcome>) {
    if (adding.current) return;
    adding.current = true;
    setBusy(true);
    add(row).then((outcome) => {
      adding.current = false;
      setBusy(false);
      setOpen(false);
      button.current?.focus();
      onAdded(outcome);
    });
  }

  function press() {
    if (sheet) run(addToSheet);
    else if (!adding.current) setOpen(!open);
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key !== "Escape" || !open) return;
    event.preventDefault();
    event.stopPropagation();
    setOpen(false);
    button.current?.focus();
  }

  const list = characters.data ?? [];
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Escape and focus leaving bubble here from the button and the list.
    <div
      onKeyDown={handleKeyDown}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      className="relative shrink-0"
    >
      <button
        ref={button}
        type="button"
        aria-expanded={sheet ? undefined : open}
        aria-controls={sheet || !open ? undefined : listId}
        aria-busy={busy || undefined}
        onClick={press}
        className={`${LOOKS[look]} cursor-pointer aria-busy:cursor-wait`}
      >
        Add to…{" "}
        <span className="sr-only">
          {row.label}
          {sheet && `, for ${sheet.name}`}
        </span>
      </button>
      {open && !sheet && (
        // biome-ignore lint/a11y/useSemanticElements: a group of buttons, not form controls a fieldset would gather.
        <div
          id={listId}
          role="group"
          aria-label={`Add ${row.label} to which character`}
          className={`absolute right-0 z-10 flex w-60 flex-col rounded-control border border-border bg-surface p-1.5 shadow-popover ${above ? "bottom-full mb-1.5" : "top-full mt-1.5"}`}
        >
          <p aria-hidden className="px-1.5 pb-1 text-label font-semibold text-muted">
            Add to which character?
          </p>
          {list.map((character) => (
            <AddToOption key={character.id} character={character} onPick={run} />
          ))}
          {characters.isSuccess && list.length === 0 && (
            <p className="px-1.5 py-1 text-row text-muted">
              There is no character to add to.{" "}
              <Link to="/characters/new" className="font-semibold text-accent-text">
                + New Character
              </Link>
            </p>
          )}
          {characters.isError && (
            <p className="px-1.5 py-1 text-row text-error">
              Couldn't list the characters: {characters.error.message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
