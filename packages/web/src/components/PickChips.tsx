import { type EntryRef, entryKey } from "@dnd/character";
import { Repeat, X } from "lucide-react";
import { PILL } from "../lib/chipStyles.ts";

const PILL_BUTTON =
  "flex size-5 items-center justify-center rounded-pill text-muted hover:bg-border";

type Picked = { ref: EntryRef; name: string };

/** Each pick as a pill with a remove button, and a swap button where `onReplace` is given. */
export function PickChips({
  picked,
  onRemove,
  onReplace,
}: {
  picked: readonly Picked[];
  onRemove: (ref: EntryRef) => void;
  onReplace?: (pick: Picked) => void;
}) {
  if (picked.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {picked.map((pick) => (
        <li key={entryKey(pick.ref)} className={`${PILL} flex items-center gap-1 pr-1`}>
          {pick.name}
          {onReplace && (
            <button
              type="button"
              onClick={() => onReplace(pick)}
              aria-label={`Replace ${pick.name}`}
              className={PILL_BUTTON}
            >
              <Repeat aria-hidden="true" size={12} />
            </button>
          )}
          <button
            type="button"
            onClick={() => onRemove(pick.ref)}
            aria-label={`Remove ${pick.name}`}
            className={PILL_BUTTON}
          >
            <X aria-hidden="true" size={12} />
          </button>
        </li>
      ))}
    </ul>
  );
}
