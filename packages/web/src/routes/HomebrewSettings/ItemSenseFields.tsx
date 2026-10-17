import { SENSES } from "@dnd/character";
import type { ReactNode } from "react";
import { InputField } from "../../components/InputField.tsx";
import { isRecord } from "../../lib/entryGuards.ts";
import { titleCase } from "../../lib/proficiencyGrants.ts";
import { numberAt, typedInteger } from "./homebrewEntry.ts";

/** The range a `senses` list gives `sense`: the longest any of its entries states. */
function rangeOf(senses: readonly unknown[], sense: string): number | undefined {
  const ranges = senses.flatMap(
    (entry) => numberAt(isRecord(entry) ? entry[sense] : undefined) ?? [],
  );
  return ranges.length > 0 ? Math.max(...ranges) : undefined;
}

/**
 * One range, in feet, for each sense the item grants, written as `senses` holds them: a
 * list with one object per sense. A sense left blank writes nothing.
 */
export function ItemSenseFields({
  senses,
  onChange,
  error,
}: {
  senses: unknown[];
  onChange: (next: Record<string, number>[]) => void;
  error?: ReactNode;
}) {
  const write = (sense: string, range: number | undefined) =>
    onChange(
      SENSES.flatMap((each) => {
        const feet = each === sense ? range : rangeOf(senses, each);
        return feet === undefined ? [] : [{ [each]: feet }];
      }),
    );
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-1 text-muted text-row">Senses</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {SENSES.map((sense) => (
          <InputField
            key={sense}
            label={`${titleCase(sense)} (ft.)`}
            type="number"
            min={1}
            step={5}
            value={rangeOf(senses, sense) ?? ""}
            onChange={(event) => write(sense, typedInteger(event.target.value) || undefined)}
          />
        ))}
      </div>
      {error && (
        <p role="alert" className="text-error text-row">
          {error}
        </p>
      )}
    </fieldset>
  );
}
