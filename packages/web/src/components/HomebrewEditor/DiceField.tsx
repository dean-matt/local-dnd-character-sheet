import type { ReactNode } from "react";
import { Combobox } from "../Combobox.tsx";
import { FormField } from "../FormField.tsx";

/** The dice a weapon's damage most often takes; any other still saves. */
const WEAPON_DICE = ["1d4", "1d6", "1d8", "1d10", "1d12", "2d6"];

/** A damage die typed, or picked from `WEAPON_DICE`. */
export function DiceField({
  label,
  placeholder,
  error,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  error: ReactNode;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <FormField label={label} error={error}>
      {(control) => (
        <Combobox
          {...control}
          options={WEAPON_DICE}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
        />
      )}
    </FormField>
  );
}
