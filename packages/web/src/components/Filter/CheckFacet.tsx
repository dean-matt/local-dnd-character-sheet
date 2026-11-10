/**
 * A facet of checkboxes, one per option, ruled off from any facet above it. A row matches
 * where it holds any ticked option, so ticking none or every option shows all.
 */
export function CheckFacet({
  label,
  options,
  picked,
  onChange,
}: {
  /** Names the group to a screen reader; the boxes' own labels carry it on screen. */
  label: string;
  options: readonly { value: string; label: string }[];
  picked: readonly string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-1 border-border border-t pt-2 first:border-t-0 first:pt-0">
      <legend className="sr-only">{label}</legend>
      {options.map((option) => (
        <label key={option.value} className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={picked.includes(option.value)}
            onChange={() =>
              onChange(
                picked.includes(option.value)
                  ? picked.filter((pick) => pick !== option.value)
                  : [...picked, option.value],
              )
            }
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  );
}
