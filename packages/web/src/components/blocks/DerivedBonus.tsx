import { type Derived, derivedValue } from "@dnd/character";
import { signed } from "../../lib/signed.ts";
import { Field } from "../Field.tsx";
import { Popover } from "../Popover.tsx";
import { TermList } from "../TermList.tsx";

/** A derived number, behind a popover of its terms where the rules supplied any. */
export function DerivedBonus({
  name,
  value,
  format = signed,
  named = false,
}: {
  name: string;
  value: Derived<number>;
  format?: (value: number) => string;
  /** The surrounding term or row already names the value, so the field stays unlabeled rather than repeat it. */
  named?: boolean;
}) {
  const field = (
    <Field mode="read" label={named ? "" : name} labelHidden value={value} format={format} />
  );
  const terms = value.terms ?? [];
  if (terms.length === 0) return field;
  return (
    <Popover
      trigger={field}
      triggerLabel={`${name} ${format(derivedValue(value))}${
        value.manual === null ? "" : `, overridden from ${format(value.computed)}`
      }`}
      label={`${name} breakdown`}
    >
      <TermList terms={terms} />
    </Popover>
  );
}
