import type { undoLogSchema } from "@dnd/character";
import { Undo2 } from "lucide-react";
import { useRef } from "react";
import type { z } from "zod";

type Entry = z.infer<typeof undoLogSchema>[number];

const when = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/**
 * One undo entry: what it changed, when, every change it holds behind a disclosure, and
 * "Undo to here", which a click anywhere on the entry outside the disclosure also presses.
 * Hovering the entry or focusing that button calls `onMark`, so the panel can mark
 * this entry and every newer one as what it would undo; `undoes` counts the changes they
 * hold.
 */
export function UndoHistoryEntry({
  entry,
  undoes,
  marked,
  disabled,
  onMark,
  onUndo,
}: {
  entry: Entry;
  undoes: number;
  marked: boolean;
  disabled: boolean;
  onMark: (marked: boolean) => void;
  onUndo: (trigger: HTMLButtonElement) => void;
}) {
  const button = useRef<HTMLButtonElement>(null);
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents lint/a11y/noNoninteractiveElementInteractions: a pointer shortcut to the entry's own button, which keyboard and screen reader users reach.
    <li
      data-marked={marked}
      onMouseEnter={() => onMark(true)}
      onMouseLeave={() => onMark(false)}
      onClick={(event) => {
        const target = event.target as HTMLElement;
        if (!disabled && button.current && !target.closest("details, button")) {
          onUndo(button.current);
        }
      }}
      className="flex cursor-pointer items-start gap-2 rounded-control border border-border px-3 py-2 data-[marked=true]:border-error data-[marked=true]:bg-subtle"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="font-medium text-body in-data-[marked=true]:line-through">
          {entry.describedAs}
        </p>
        <time dateTime={entry.changedAt} className="text-muted text-row">
          {when.format(new Date(entry.changedAt))}
        </time>
        {entry.changes.length > 1 && (
          <details className="text-row">
            <summary className="cursor-pointer text-secondary">
              {entry.changes.length} changes
            </summary>
            <ul className="mt-1 list-disc pl-5">
              {entry.changes.map((change, at) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: two changes can read alike, and the list never reorders.
                <li key={at}>{change}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
      <button
        ref={button}
        type="button"
        aria-disabled={disabled}
        aria-haspopup="dialog"
        aria-label={`Undo to here, undoing ${undoes} ${undoes === 1 ? "change" : "changes"}`}
        title="Undo to here"
        onFocus={() => onMark(true)}
        onBlur={() => onMark(false)}
        onClick={(event) => {
          if (!disabled) onUndo(event.currentTarget);
        }}
        className="flex size-7 shrink-0 items-center justify-center rounded-control border border-border text-muted hover:bg-subtle hover:text-ink aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
      >
        <Undo2 aria-hidden="true" size={14} />
      </button>
    </li>
  );
}
