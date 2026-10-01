import { type Derived, derivedValue } from "@dnd/character";
import { signed } from "../../../../lib/signed.ts";
import { TermList } from "../../../TermList.tsx";

/** A value's current total and the terms it is built from. */
export function ValueDetail({
  value,
  format = signed,
}: {
  value: Derived<number>;
  format?: (n: number) => string;
}) {
  const terms = value.terms ?? [];
  return (
    <div className="flex flex-col gap-1">
      <p className="font-semibold">
        {format(derivedValue(value))}
        {value.manual !== null && (
          <span className="ml-1 font-normal text-muted">
            (overridden from {format(value.computed)})
          </span>
        )}
      </p>
      {terms.length > 0 && <TermList terms={terms} />}
    </div>
  );
}
