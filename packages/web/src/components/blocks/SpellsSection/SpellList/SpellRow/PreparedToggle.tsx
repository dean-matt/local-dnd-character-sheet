import { TOGGLE_PILL } from "../../../../../lib/chipStyles.ts";

/** Presses to prepare a spell and again to unprepare it. */
export function PreparedToggle({
  name,
  prepared,
  onChange,
  busy,
}: {
  name: string;
  prepared: boolean;
  onChange: (prepared: boolean) => void;
  busy: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={`Prepared, ${name}`}
      aria-pressed={prepared}
      aria-disabled={busy || undefined}
      onClick={() => onChange(!prepared)}
      className={`${TOGGLE_PILL} ${prepared ? "border-accent bg-accent text-white" : "border-border bg-surface text-muted"}`}
    >
      {prepared ? "Prepared" : "Prepare"}
    </button>
  );
}
