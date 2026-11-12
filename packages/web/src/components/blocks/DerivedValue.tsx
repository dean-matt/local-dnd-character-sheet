import { type Derived, derivedValue } from "@dnd/character";
import { useContext } from "react";
import type { z } from "zod";
import { Field } from "../Field/Field.tsx";
import { SaveOverride } from "../overrideContext.ts";
import { Popover } from "../Popover.tsx";
import { DerivedBreakdown } from "./DerivedBreakdown.tsx";
import { signed } from "./signed.ts";

/**
 * A derived number, behind a popover of its terms and, on the character page, the field
 * that overrides it. With neither terms, an override nor anywhere to save one, it is the
 * bare number.
 */
export function DerivedValue({
  name,
  value,
  format = signed,
  named = false,
  overrideKey,
  schema,
}: {
  name: string;
  value: Derived<number>;
  format?: (value: number) => string;
  /** The surrounding term or row already names the value, so the field stays unlabeled rather than repeat it. */
  named?: boolean;
  /** The definition's `overrides` key for this value; without one it offers no override. */
  overrideKey?: string;
  schema?: z.ZodType<number>;
}) {
  const save = useContext(SaveOverride);
  const field = (
    <Field mode="read" label={named ? "" : name} labelHidden value={value} format={format} />
  );
  const terms = value.terms ?? [];
  const editable = save !== null && overrideKey !== undefined;
  if (terms.length === 0 && value.manual === null && !editable) return field;
  return (
    <Popover
      trigger={field}
      triggerLabel={`${name} ${format(derivedValue(value))}${
        value.manual === null ? "" : `, overridden from ${format(value.computed)}`
      }`}
      label={`${name} breakdown`}
    >
      <DerivedBreakdown
        name={name}
        value={value}
        format={format}
        overrideKey={overrideKey}
        schema={schema}
      />
    </Popover>
  );
}
