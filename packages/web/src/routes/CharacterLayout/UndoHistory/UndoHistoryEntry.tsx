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
 * One undo entry: a button naming what it changed and when, stretched over the whole
 * entry so a click anywhere on it undoes back to here, and every change it holds behind a
 * disclosure that sits above the stretch. Hovering the entry or focusing its button calls
 * `onMark`, so the panel can mark this entry and every newer one as what it would undo;
 * `undoes` counts the changes they hold.
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
      onMouseEnter={() => onMark(true)}
      onMouseLeave={() => onMark(false)}
      className="relative flex flex-col gap-1 rounded-control border border-border px-3 py-2 hover:bg-subtle has-[button:focus-visible]:outline-2 has-[button:focus-visible]:outline-accent has-[button:focus-visible]:outline-offset-2 data-[marked=true]:border-error data-[marked=true]:bg-subtle"
    >
      <button
        type="button"
        aria-disabled={disabled}
        aria-haspopup="dialog"
        aria-label={`Undo to here: ${entry.describedAs}, undoing ${undoes} ${undoes === 1 ? "change" : "changes"}`}
        onFocus={() => onMark(true)}
        onBlur={() => onMark(false)}
        onClick={(event) => {
          if (!disabled) onUndo(event.currentTarget);
        }}
        className="flex flex-col gap-1 text-left focus-visible:outline-none! after:absolute after:inset-0 after:rounded-control aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
      >
        <span className="font-medium text-body in-data-[marked=true]:line-through">
          {entry.describedAs}
        </span>
        <time dateTime={entry.changedAt} className="text-muted text-row">
          {when.format(new Date(entry.changedAt))}
        </time>
      </button>
      {entry.changes.length > 1 && (
        <details className="relative text-row">
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
    </li>
  );
}
