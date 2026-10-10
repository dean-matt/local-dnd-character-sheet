const PILL =
  "rounded-pill border px-2 py-0.5 font-bold text-chip leading-3 tracking-chip uppercase";

/** Presses to attune and again to end it. */
export function AttuneToggle({
  name,
  attuned,
  onChange,
}: {
  name: string;
  attuned: boolean;
  onChange: (attuned: boolean) => void;
}) {
  return (
    <button
      type="button"
      aria-label={`Attuned, ${name}`}
      aria-pressed={attuned}
      onClick={() => onChange(!attuned)}
      className={`${PILL} ${attuned ? "border-accent bg-accent text-white" : "border-border bg-surface text-muted"}`}
    >
      {attuned ? "Attuned" : "Attune"}
    </button>
  );
}
