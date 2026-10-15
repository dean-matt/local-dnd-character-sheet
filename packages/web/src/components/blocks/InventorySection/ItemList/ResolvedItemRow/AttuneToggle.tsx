import { TOGGLE_PILL } from "../../../../../lib/chipStyles.ts";

/** Presses to attune and again to end it. */
export function AttuneToggle({
  name,
  attuned,
  onChange,
  busy,
}: {
  name: string;
  attuned: boolean;
  onChange: (attuned: boolean) => void;
  busy: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={`Attuned, ${name}`}
      aria-pressed={attuned}
      aria-disabled={busy || undefined}
      onClick={() => onChange(!attuned)}
      className={`${TOGGLE_PILL} ${attuned ? "border-accent bg-accent text-white" : "border-border bg-surface text-muted"}`}
    >
      {attuned ? "Attuned" : "Attune"}
    </button>
  );
}
