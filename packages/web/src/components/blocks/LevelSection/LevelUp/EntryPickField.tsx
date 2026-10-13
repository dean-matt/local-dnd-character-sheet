export interface EntryPickFieldProps {
  legend: string;
  count: number;
  /** Each option's key and the name it shows. */
  options: readonly { key: string; label: string }[];
  picked: ReadonlySet<string>;
  onToggle: (key: string) => void;
}

/**
 * A checkbox list for one pick a class offers on entry, saying how many it asks for and how
 * many are checked. Apply waits until the two match, so a pick past the count is refused
 * there rather than here.
 */
export function EntryPickField({ legend, count, options, picked, onToggle }: EntryPickFieldProps) {
  const taken = options.filter((option) => picked.has(option.key)).length;
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="font-semibold text-label text-muted uppercase">{legend}</legend>
      <p
        aria-live="polite"
        className={`text-row ${taken === count ? "text-muted" : "font-semibold text-accent-text"}`}
      >
        {count === 0
          ? "The character already holds every option."
          : `Choose ${count} — ${taken} selected`}
      </p>
      {options.map((option) => (
        <label key={option.key} className="flex items-center gap-2 py-0.5 text-body">
          <input
            type="checkbox"
            checked={picked.has(option.key)}
            onChange={() => onToggle(option.key)}
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  );
}
