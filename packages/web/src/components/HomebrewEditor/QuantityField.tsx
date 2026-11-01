import { useState } from "react";
import { InputField } from "../InputField.tsx";
import { typedInteger } from "./homebrewEntry.ts";

/** A whole-number quantity of 1 or more; the text being typed stays until it is one, so the field can be cleared. */
export function QuantityField({
  label,
  quantity,
  onCommit,
}: {
  label: string;
  quantity: number;
  onCommit: (quantity: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <InputField
      label={label}
      type="number"
      min={1}
      step={1}
      value={draft ?? quantity}
      onChange={(event) => {
        setDraft(event.target.value);
        const next = typedInteger(event.target.value);
        if (next !== undefined && next >= 1) onCommit(next);
      }}
      onBlur={() => setDraft(null)}
    />
  );
}
