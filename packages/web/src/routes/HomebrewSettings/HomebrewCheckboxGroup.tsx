export interface HomebrewCheckboxGroupProps {
  legend: string;
  options: { value: string; label: string }[];
  chosen: string[];
  onChange: (chosen: string[]) => void;
}

/** A fieldset of checkboxes, one per option, wrapping into as many columns as fit. */
export function HomebrewCheckboxGroup({
  legend,
  options,
  chosen,
  onChange,
}: HomebrewCheckboxGroupProps) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-1">
      <legend className="mb-1 text-muted text-row">{legend}</legend>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-x-3 gap-y-1">
        {options.map((option) => (
          <label key={option.value} className="flex items-center gap-2 text-ink text-row">
            <input
              type="checkbox"
              checked={chosen.includes(option.value)}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...chosen, option.value]
                    : chosen.filter((value) => value !== option.value),
                )
              }
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
