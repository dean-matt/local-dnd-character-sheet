import type { CharacterRecord } from "@dnd/character";
import { Pencil } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import type { LevelHistoryRow } from "../../../lib/levelHistory.ts";
import { Modal } from "../../Modal.tsx";
import { ModalEntry } from "../../ModalEntry.tsx";
import { LevelChoicesDialog } from "./LevelChoicesDialog.tsx";
import { LevelRemoval } from "./LevelRemoval.tsx";

const HEADING = "font-semibold text-label text-muted uppercase";

export interface LevelEditProps {
  character: CharacterRecord;
  /** This level, then every level after it, oldest first. */
  rows: readonly LevelHistoryRow[];
  /** The control that changes this level's hit point gain. */
  hitPoints: ReactNode;
  /** Set where this row's button should take focus, as once the levels after it were removed. */
  focusRequest?: boolean;
  onFocused: () => void;
  onRemoved: () => void;
}

/**
 * A level's one Edit button, which opens a dialog that changes its hit point gain, opens its
 * choices again in the level-up's pickers (level 1's class among them), and removes it with
 * every level after it, for any level but the first. Each change is its own write. Closing
 * the dialog returns focus to the button.
 */
export function LevelEdit({
  character,
  rows,
  hitPoints,
  focusRequest,
  onFocused,
  onRemoved,
}: LevelEditProps) {
  const [view, setView] = useState<"edit" | "choices">();
  const [returning, setReturning] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (returning && view === undefined) {
      button.current?.focus();
      setReturning(false);
    }
  }, [returning, view]);
  useEffect(() => {
    if (focusRequest) {
      button.current?.focus();
      onFocused();
    }
  }, [focusRequest, onFocused]);
  const row = rows[0];
  if (!row) return null;
  const close = () => {
    setView(undefined);
    setReturning(true);
  };
  return (
    <>
      <button
        type="button"
        ref={button}
        aria-label={`Edit level ${row.level}`}
        title={`Edit level ${row.level}`}
        onClick={() => setView("edit")}
        className="flex size-6 items-center justify-center rounded-control text-muted hover:bg-subtle hover:text-ink print:hidden"
      >
        <Pencil aria-hidden="true" size={14} />
      </button>
      {view === "edit" && (
        <Modal onClose={close}>
          <ModalEntry title={`Edit level ${row.level}`}>
            <section aria-labelledby={`${id}-hp`} className="flex flex-col gap-1.5">
              <h3 id={`${id}-hp`} className={HEADING}>
                Hit points
              </h3>
              {hitPoints}
            </section>
            <section aria-labelledby={`${id}-choices`} className="flex flex-col gap-1.5">
              <h3 id={`${id}-choices`} className={HEADING}>
                Choices
              </h3>
              <button
                type="button"
                onClick={() => setView("choices")}
                className="w-fit text-label text-muted underline"
              >
                {row.level === 1 ? "Change the class and choices" : "Change the choices"}
              </button>
            </section>
            {row.level > 1 && (
              <LevelRemoval character={character} rows={rows} onRemoved={onRemoved} />
            )}
          </ModalEntry>
        </Modal>
      )}
      {view === "choices" && (
        <LevelChoicesDialog character={character} level={row.level} onClose={close} />
      )}
    </>
  );
}
