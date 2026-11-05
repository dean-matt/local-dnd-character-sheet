import { useId } from "react";
import { InputField } from "../../../components/InputField.tsx";
import { type HitDicePick, typedCounts } from "./restPicks.ts";

/**
 * How many spent hit dice of each size a classic long rest recovers, where fewer return than
 * were spent. A count past what return is refused here, and the rest waits on a valid pick.
 */
export function HitDicePicks({
  pick,
  typed,
  onChange,
}: {
  pick: HitDicePick;
  typed: readonly string[];
  onChange: (typed: string[]) => void;
}) {
  const hintId = useId();
  const counts = typedCounts(pick, typed);
  const sum = counts.reduce<number>((total, count) => total + (count ?? 0), 0);
  return (
    <fieldset aria-describedby={hintId} className="flex flex-col gap-2">
      <legend className="font-semibold">Hit dice to recover</legend>
      <p id={hintId} className="text-muted text-row">
        {pick.allowed} of the {pick.spent.reduce((total, size) => total + size.count, 0)} spent hit
        dice return.
      </p>
      <div className="flex flex-wrap gap-3">
        {pick.spent.map(({ die, count }, index) => (
          <InputField
            key={die}
            label={`d${die}, ${count} spent`}
            type="number"
            min={0}
            max={count}
            step={1}
            value={typed[index] ?? ""}
            onChange={(event) =>
              onChange(typed.map((value, at) => (at === index ? event.target.value : value)))
            }
            error={counts[index] === undefined && `Type a whole number from 0 to ${count}.`}
            className="w-24 text-row"
          />
        ))}
      </div>
      <p role="alert" className="text-error text-row">
        {sum > pick.allowed && `Only ${pick.allowed} hit dice return; ${sum} are picked.`}
      </p>
    </fieldset>
  );
}
