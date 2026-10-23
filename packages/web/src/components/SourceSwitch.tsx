/** One source's on/off switch, named by the element `labelledBy` points at. */
export function SourceSwitch({
  labelledBy,
  checked,
  locked = false,
  onToggle,
}: {
  labelledBy: string;
  checked: boolean;
  /** Refuses the toggle while the switch stays focusable and reads as it stands. */
  locked?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-disabled={locked || undefined}
      aria-labelledby={labelledBy}
      onClick={() => {
        if (!locked) onToggle();
      }}
      className="group relative h-5 w-9 shrink-0 rounded-full border border-border bg-muted aria-checked:bg-accent aria-disabled:opacity-50"
    >
      <span
        aria-hidden="true"
        className="absolute top-px left-px size-4 rounded-full bg-surface forced-colors:bg-[CanvasText] transition-transform group-aria-checked:translate-x-4"
      />
    </button>
  );
}
