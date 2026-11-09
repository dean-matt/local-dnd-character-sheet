import { InputField } from "../InputField.tsx";
import type { Range } from "./facets.ts";

/** A facet taking a minimum and a maximum, either left empty for no bound. */
export function RangeFacet({
  label,
  range,
  bounds,
  onChange,
}: {
  label: string;
  range: Range;
  bounds: { min: number; max: number };
  onChange: (next: Range) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-semibold text-label text-muted uppercase tracking-label">{label}</span>
      <div className="flex gap-2">
        {(["min", "max"] as const).map((end) => (
          <InputField
            key={end}
            label={`${end === "min" ? "Minimum" : "Maximum"} ${label.toLowerCase()}`}
            type="number"
            inputMode="numeric"
            min={bounds.min}
            max={bounds.max}
            placeholder={end === "min" ? "Min" : "Max"}
            value={range[end]}
            onChange={(event) => onChange({ ...range, [end]: event.target.value })}
            className="w-full"
          />
        ))}
      </div>
    </div>
  );
}
