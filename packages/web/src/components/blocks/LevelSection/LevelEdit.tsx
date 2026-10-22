import type { CharacterRecord } from "@dnd/character";
import { Pencil } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { LevelHistoryRow } from "../../../lib/levelHistory.ts";
import { LevelEditDialog } from "./LevelEditDialog.tsx";

export interface LevelEditProps {
  character: CharacterRecord;
  /** This level, then every level after it, oldest first. */
  rows: readonly LevelHistoryRow[];
  /** Set where this row's button should take focus, as once the levels after it were removed. */
  focusRequest?: boolean;
  onFocused: () => void;
  onRemoved: () => void;
}

/** A level's one Edit button, which opens its Edit dialog; closing it returns focus to the button. */
export function LevelEdit({ character, rows, focusRequest, onFocused, onRemoved }: LevelEditProps) {
  const [open, setOpen] = useState(false);
  const [returning, setReturning] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (returning && !open) {
      button.current?.focus();
      setReturning(false);
    }
  }, [returning, open]);
  useEffect(() => {
    if (focusRequest) {
      button.current?.focus();
      onFocused();
    }
  }, [focusRequest, onFocused]);
  const [row, ...after] = rows;
  if (!row) return null;
  return (
    <>
      <button
        type="button"
        ref={button}
        aria-label={`Edit level ${row.level}`}
        title={`Edit level ${row.level}`}
        onClick={() => setOpen(true)}
        className="flex size-6 items-center justify-center rounded-control text-muted hover:bg-subtle hover:text-ink print:hidden"
      >
        <Pencil aria-hidden="true" size={14} />
      </button>
      {open && (
        <LevelEditDialog
          character={character}
          rows={[row, ...after]}
          onClose={() => {
            setOpen(false);
            setReturning(true);
          }}
          onRemoved={onRemoved}
        />
      )}
    </>
  );
}
