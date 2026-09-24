import { derivedValue, type ValueBlockField } from "@dnd/character";
import { EmptyState } from "../../states.tsx";
import { Popover } from "../Popover.tsx";
import type { BlockViewProps } from "./types.ts";

const VALUE_LABELS: Record<ValueBlockField, string> = {
  hitPointMaximum: "Hit Point Maximum",
  armorClass: "Armor Class",
  initiative: "Initiative",
  proficiencyBonus: "Proficiency Bonus",
};

/**
 * One derived value, with the breakdown behind it — read from the derived block a
 * caller resolved, never recomputed here.
 */
export function ValueBlockView({ block, derived }: BlockViewProps) {
  if (block.kind !== "value") return null;
  const label = VALUE_LABELS[block.field];
  const field = derived?.[block.field];
  if (!field) return <EmptyState>{label} isn't available yet.</EmptyState>;

  const value = derivedValue(field);
  const terms = field.terms ?? [];

  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-muted text-row">{label}</span>
      {terms.length > 0 ? (
        <Popover trigger={value} label={`${label} breakdown`}>
          <ul className="flex flex-col gap-1">
            {terms.map((term, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: a breakdown's terms never reorder.
              <li key={index} className="flex justify-between gap-4">
                <span>{term.label}</span>
                <span>{term.value}</span>
              </li>
            ))}
          </ul>
        </Popover>
      ) : (
        <span className="font-medium">{value}</span>
      )}
    </div>
  );
}
