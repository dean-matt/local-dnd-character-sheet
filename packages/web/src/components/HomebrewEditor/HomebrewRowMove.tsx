import { ArrowDown, ArrowUp } from "lucide-react";

const MOVE =
  "flex w-8 items-center justify-center self-stretch rounded-control text-muted hover:bg-subtle disabled:opacity-40";

export interface HomebrewRowMoveProps {
  /** The row as a screen reader hears it: `trait 1`. */
  name: string;
  /** Absent where the row is already first. */
  onUp?: () => void;
  /** Absent where the row is already last. */
  onDown?: () => void;
}

/** The up and down arrows that move one row of a homebrew row list. */
export function HomebrewRowMove({ name, onUp, onDown }: HomebrewRowMoveProps) {
  return (
    <>
      <button
        type="button"
        aria-label={`Move ${name} up`}
        title="Move up"
        disabled={!onUp}
        onClick={onUp}
        className={MOVE}
      >
        <ArrowUp aria-hidden size={16} />
      </button>
      <button
        type="button"
        aria-label={`Move ${name} down`}
        title="Move down"
        disabled={!onDown}
        onClick={onDown}
        className={MOVE}
      >
        <ArrowDown aria-hidden size={16} />
      </button>
    </>
  );
}
