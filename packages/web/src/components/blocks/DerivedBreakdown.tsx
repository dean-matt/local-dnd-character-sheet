import type { Derived } from "@dnd/character";
import { useContext } from "react";
import { z } from "zod";
import { Field } from "../Field/Field.tsx";
import { SaveOverride } from "../overrideContext.ts";
import { TermList } from "../TermList.tsx";

/**
 * A sign, digits and a decimal fraction only, so `Number` cannot read "1e1" or "0x1E" as a
 * value nobody typed. The fraction is for carrying capacity, whose pounds need not be whole.
 */
const parseNumber = (raw: string) =>
  /^[+-]?\d+(\.\d+)?$/.test(raw.trim()) ? Number(raw.trim()) : Number.NaN;

/**
 * The terms behind a derived number and, where an `overrideKey` names it on the character
 * page, a field that types over it. An overridden value names its computed one in place of
 * the terms, which no longer add up to what the sheet shows. Clearing the field drops the
 * override, and the terms return.
 *
 * `schema` must match the field's own in `characterDerivedSchema`: `applyOverrides` drops a
 * value that schema refuses without a word, so a looser one here saves an override that never shows.
 */
export function DerivedBreakdown({
  name,
  label = "Override",
  value,
  format,
  overrideKey,
  schema = z.int(),
}: {
  name: string;
  label?: string;
  value: Derived<number>;
  format: (value: number) => string;
  overrideKey?: string;
  schema?: z.ZodType<number>;
}) {
  const save = useContext(SaveOverride);
  const terms = value.terms ?? [];
  const editable = save !== null && overrideKey !== undefined;
  return (
    <div className="flex flex-col gap-1.5">
      {value.manual !== null ? (
        <p>
          Overridden from {format(value.computed)}.
          {editable && " Clear the override to return to it."}
        </p>
      ) : (
        terms.length > 0 && <TermList terms={terms} />
      )}
      {editable && (
        <div className="flex items-baseline justify-between gap-4">
          <span aria-hidden="true" className="text-muted">
            {label}
          </span>
          <Field
            mode="edit"
            label={`${name} override`}
            labelHidden
            value={value}
            format={String}
            parse={parseNumber}
            schema={schema}
            inputClassName="w-16 py-0.5 text-right"
            onSave={(next: number | null) => save(overrideKey, next)}
          />
        </div>
      )}
    </div>
  );
}
