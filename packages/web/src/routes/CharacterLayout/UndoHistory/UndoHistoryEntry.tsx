import type { undoLogSchema } from "@dnd/character";
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
 * "Undo to here". Hovering or focusing that button calls `onMark`, so the panel can mark
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
  return (
    <li
      data-marked={marked}
      className="flex flex-col gap-1 rounded-control border border-border px-3 py-2 data-[marked=true]:border-error data-[marked=true]:bg-subtle"
    >
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
      <button
        type="button"
        aria-disabled={disabled}
        aria-haspopup="dialog"
        aria-label={`Undo to here, undoing ${undoes} ${undoes === 1 ? "change" : "changes"}`}
        onMouseEnter={() => onMark(true)}
        onMouseLeave={() => onMark(false)}
        onFocus={() => onMark(true)}
        onBlur={() => onMark(false)}
        onClick={(event) => {
          if (!disabled) onUndo(event.currentTarget);
        }}
        className="self-start rounded-control border border-border px-2.5 py-1 font-medium text-row hover:bg-subtle aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
      >
        Undo to here
      </button>
    </li>
  );
}
