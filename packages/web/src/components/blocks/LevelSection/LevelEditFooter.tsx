import { LevelEditAlert } from "./LevelEditAlert.tsx";

const BUTTON = "rounded-control px-3.5 py-2 font-semibold text-row";

/** The Edit dialog's footer: the removal, the alert line, Cancel, and an Apply that holds while `blocked`. */
export function LevelEditFooter({
  level,
  error,
  onReload,
  onRemove,
  lines,
  blocked,
  saving,
  cancel,
  onSubmit,
}: {
  level: number;
  error: string | undefined;
  onReload?: () => void;
  onRemove?: () => void;
  lines: readonly string[];
  blocked: boolean;
  saving: boolean;
  cancel: () => void;
  /** Runs as Apply submits, when nothing blocks it. */
  onSubmit: () => void;
}) {
  return (
    <div className="flex w-full items-center gap-2">
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className={`${BUTTON} border border-error bg-surface text-error hover:bg-subtle`}
        >
          Remove level {level}
        </button>
      )}
      <LevelEditAlert error={error} onReload={onReload} lines={lines} />
      <button
        type="button"
        onClick={cancel}
        className={`${BUTTON} border border-border bg-surface text-ink hover:bg-subtle`}
      >
        Cancel
      </button>
      <button
        type="submit"
        aria-disabled={blocked}
        onClick={(event) => {
          if (blocked) event.preventDefault();
          else onSubmit();
        }}
        className={`${BUTTON} bg-accent text-white hover:bg-accent-hover aria-disabled:cursor-not-allowed aria-disabled:opacity-50`}
      >
        {saving ? "Saving…" : "Apply changes"}
      </button>
    </div>
  );
}
