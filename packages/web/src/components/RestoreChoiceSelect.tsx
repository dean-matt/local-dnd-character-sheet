import type { RestoreChoice } from "../lib/restoreChoice.ts";

const LABEL = { slotLevel: "Spell slot level to expend", creature: "Creatures that accept" };

/** The slot level or creature count a use's amount scales with, among the values the sheet allows. */
export function RestoreChoiceSelect({
  name,
  choice,
  value,
  onChange,
}: {
  name: string;
  choice: RestoreChoice | null;
  value: number;
  onChange: (value: number) => void;
}) {
  if (!choice) return null;
  return (
    <select
      aria-label={`${LABEL[choice.unit]} for ${name}`}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      className="h-6 rounded-control border border-border bg-surface px-1 text-row"
    >
      {choice.values.map((each) => (
        <option key={each} value={each}>
          {choice.unit === "slotLevel" ? `Level ${each}` : each}
        </option>
      ))}
    </select>
  );
}
