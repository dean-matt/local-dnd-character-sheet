import { FormField } from "./FormField.tsx";
import { Select } from "./Select.tsx";

export interface AddChoiceProps {
  /** Names the control, and reads `<label>…` as its prompt. */
  label: string;
  /** What is left to add; none hides the control. */
  options: readonly { value: string; label: string }[];
  onAdd: (value: string) => void;
}

/** A select that adds its pick to a list and returns to its prompt, for a fixed vocabulary. */
export function AddChoice({ label, options, onAdd }: AddChoiceProps) {
  if (options.length === 0) return null;
  return (
    <FormField label={label} labelHidden>
      {(control) => (
        <Select
          {...control}
          options={[{ value: "", label: `${label}…` }, ...options]}
          value=""
          onChange={onAdd}
        />
      )}
    </FormField>
  );
}
