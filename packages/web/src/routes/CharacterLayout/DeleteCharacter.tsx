import type { CharacterRecord } from "@dnd/character";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useReturnFocus } from "../../hooks/useReturnFocus.ts";
import { DeleteCharacterDialog } from "./DeleteCharacterDialog.tsx";

/** The header's delete button, which opens the confirmation and takes focus back from it. */
export function DeleteCharacter({ character }: { character: CharacterRecord }) {
  const [open, setOpen] = useState(false);
  const trigger = useReturnFocus<HTMLButtonElement>(open);
  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={() => setOpen(true)}
        title="Delete character"
        className="flex size-8 shrink-0 items-center justify-center rounded-control border border-border text-muted hover:bg-subtle"
      >
        <Trash2 size={16} aria-hidden="true" />
        <span className="sr-only">Delete character</span>
      </button>
      {open && <DeleteCharacterDialog character={character} onClose={() => setOpen(false)} />}
    </>
  );
}
