import type { CharacterDerived, CharacterRecord, CharacterState, RestLength } from "@dnd/character";
import { useState } from "react";
import { useReturnFocus } from "../../../../../hooks/useReturnFocus.ts";
import { RestDialog } from "./RestDialog.tsx";

/** Opens the dialog for one rest length; focus returns here when it closes. */
export function RestButton({
  length,
  onApplied,
  ...sheet
}: {
  character: CharacterRecord;
  derived: CharacterDerived;
  state: CharacterState;
  length: RestLength;
  onApplied: (summary: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useReturnFocus<HTMLButtonElement>(open);
  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="cursor-pointer rounded-control px-1.5 py-0.5 font-semibold text-accent-text normal-case tracking-normal hover:bg-subtle"
      >
        {length === "short" ? "Short rest" : "Long rest"}
      </button>
      {open && (
        <RestDialog
          {...sheet}
          length={length}
          onClose={() => setOpen(false)}
          onApplied={(summary) => {
            setOpen(false);
            onApplied(summary);
          }}
        />
      )}
    </>
  );
}
