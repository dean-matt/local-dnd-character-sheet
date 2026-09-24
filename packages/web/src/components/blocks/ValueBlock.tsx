import { derivedValue, type ValueBlockField } from "@dnd/character";
import { EmptyState } from "../../states.tsx";
import { Field } from "../Field.tsx";
import { Popover } from "../Popover.tsx";
import type { BlockViewProps } from "./types.ts";

const VALUE_LABELS: Record<ValueBlockField, string> = {
  hitPointMaximum: "Hit Point Maximum",
  armorClass: "Armor Class",
  initiative: "Initiative",
  proficiencyBonus: "Proficiency Bonus",
};

const formatValue = (value: number) => `${value}`;

/**
 * One derived value, with the breakdown behind it — read from the derived block a
 * caller resolved, never recomputed here. Renders through `Field` the same way the rest
 * of the sheet reads a `Derived<T>`, so a value block gains editing the day `Field` does.
 */
export function ValueBlockView({ block, derived }: BlockViewProps) {
  if (block.kind !== "value") return null;
  const label = VALUE_LABELS[block.field];
  const field = derived?.[block.field];
  if (!field) return <EmptyState>{label} isn't available yet.</EmptyState>;

  const terms = field.terms ?? [];
  if (terms.length === 0) {
    return <Field mode="read" label={label} value={field} format={formatValue} />;
  }

  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-muted text-row">{label}</span>
      <Popover trigger={derivedValue(field)} label={`${label} breakdown`}>
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
    </div>
  );
}
