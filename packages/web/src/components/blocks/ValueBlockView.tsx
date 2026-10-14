import { characterDerivedSchema, type ValueBlockField } from "@dnd/character";
import { EmptyState } from "../../EmptyState.tsx";
import { DerivedValue } from "./DerivedValue.tsx";
import { LabeledValue } from "./LabeledValue.tsx";
import type { BlockViewProps } from "./types.ts";

const VALUE_LABELS: Record<ValueBlockField, string> = {
  hitPointMaximum: "Hit Point Maximum",
  armorClass: "Armor Class",
  initiative: "Initiative",
  proficiencyBonus: "Proficiency Bonus",
};

/**
 * One derived value, with the breakdown and override behind it — read from the derived
 * block a caller resolved, never recomputed here.
 */
export function ValueBlockView({ block, derived }: BlockViewProps) {
  if (block.kind !== "value") return null;
  const label = VALUE_LABELS[block.field];
  const field = derived?.[block.field];
  if (!field) return <EmptyState>{label} isn't available yet.</EmptyState>;

  return (
    <LabeledValue label={label}>
      <DerivedValue
        named
        name={label}
        value={field}
        format={String}
        overrideKey={block.field}
        schema={characterDerivedSchema.shape[block.field].shape.computed}
      />
    </LabeledValue>
  );
}
