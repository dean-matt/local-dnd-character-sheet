import { X } from "lucide-react";
import { PILL } from "../../lib/chipStyles.ts";

export interface SearchFacetProps {
  /** What the facet narrows by, such as "Source". */
  label: string;
  selected: string[];
  /** Each value the select offers, and the shorter `chip` its chip shows where it has one. */
  options: { value: string; label: string; chip?: string }[];
  onChange: (next: string[]) => void;
}

/**
 * A filter of chosen values: a chip for each, removable, or "Showing all" for none, then a
 * select adding any value not yet chosen.
 */
export function SearchFacet({ label, selected, options, onChange }: SearchFacetProps) {
  const chipOf = (value: string) => {
    const option = options.find((o) => o.value === value);
    return option?.chip ?? option?.label ?? value;
  };
  const hidden = options.filter((o) => !selected.includes(o.value));
  const noun = label.toLowerCase();

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-label font-semibold uppercase tracking-label text-muted">
        {label}
      </legend>
      <div className="flex flex-wrap gap-1.5">
        {selected.map((value) => (
          <span key={value} className={`${PILL} flex items-center gap-1.5 font-medium text-ink`}>
            {chipOf(value)}
            <button
              type="button"
              aria-label={`Remove ${chipOf(value)}`}
              onClick={() => onChange(selected.filter((v) => v !== value))}
              className="flex rounded-full text-muted hover:text-ink"
            >
              <X size={10} strokeWidth={2.5} aria-hidden />
            </button>
          </span>
        ))}
        {selected.length === 0 && <span className="text-row text-muted italic">Showing all</span>}
      </div>
      {hidden.length > 0 && (
        <select
          aria-label={`Narrow by ${noun}`}
          value=""
          onChange={(event) => {
            if (event.target.value) onChange([...selected, event.target.value]);
          }}
          className="rounded-control border border-border bg-surface px-2 py-1.5 text-row text-ink"
        >
          <option value="" disabled>
            + Narrow to {noun}…
          </option>
          {hidden.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </fieldset>
  );
}
