import { type Derived, derivedValue } from "@dnd/character";
import { TermList } from "../../../TermList.tsx";
import { signed } from "../../signed.ts";

/**
 * A value's current total and the terms it is built from, which an override no longer adds up
 * to. Where `total` is off, the caller shows the total elsewhere and only an override's origin
 * stays here.
 */
export function ValueDetail({
  value,
  format = signed,
  total = true,
}: {
  value: Derived<number>;
  format?: (n: number) => string;
  total?: boolean;
}) {
  const terms = value.terms ?? [];
  return (
    <div className="flex flex-col gap-1">
      {total ? (
        <p className="font-semibold">
          {format(derivedValue(value))}
          {value.manual !== null && (
            <span className="ml-1 font-normal text-muted">
              (overridden from {format(value.computed)})
            </span>
          )}
        </p>
      ) : (
        value.manual !== null && (
          <p className="text-muted">Overridden from {format(value.computed)}</p>
        )
      )}
      {value.manual === null && terms.length > 0 && <TermList terms={terms} />}
    </div>
  );
}
