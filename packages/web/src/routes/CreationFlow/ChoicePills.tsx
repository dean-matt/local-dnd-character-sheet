export interface ChoicePillsProps {
  legend: string;
  /** Draws the legend in the accent, for a choice the step waits on. */
  prompting?: boolean;
  options: readonly { value: string; label: string }[];
  /** The chosen option's value, or `undefined` where none is. */
  value: string | undefined;
  onChange: (value: string) => void;
}

/** One choice among a few, each a pill that reads as pressed once chosen. */
export function ChoicePills({
  legend,
  prompting = false,
  options,
  value,
  onChange,
}: ChoicePillsProps) {
  return (
    <fieldset className="mt-2 flex flex-col gap-1.5">
      <legend
        className={`mb-1.5 text-row ${prompting ? "font-semibold text-accent-text" : "text-muted"}`}
      >
        {legend}
      </legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            type="button"
            key={option.value}
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
            className="rounded-pill border border-border px-3 py-1 font-semibold text-row aria-pressed:border-accent aria-pressed:bg-accent-tint"
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
