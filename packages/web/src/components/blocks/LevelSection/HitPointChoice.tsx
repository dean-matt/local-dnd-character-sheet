import { averageHitPoints, type HitDie } from "@dnd/character";
import { rollDice } from "@dnd/dice";
import { useId, useState } from "react";
import { InputField } from "../../InputField.tsx";
import { signed } from "../signed.ts";
import { type HitPointMethod, typedFace } from "./hitPointPick.ts";

const BUTTON =
  "grow rounded-control border border-border bg-surface px-3 py-1.5 font-semibold text-row aria-pressed:border-accent aria-pressed:text-accent-text";

export interface HitPointChoiceProps {
  die: HitDie;
  /** The Constitution modifier, `undefined` until the derived block loads. */
  constitution: number | undefined;
  method: HitPointMethod | undefined;
  /** The face the level stores, absent for the average. */
  rolled: number | undefined;
  onChange: (method: HitPointMethod, rolled: number | undefined) => void;
}

/**
 * How the level's hit points are found: the die's average, a roll shown as it lands, or a
 * roll made at the table and typed in, from 1 to the die's highest face.
 */
export function HitPointChoice({
  die,
  constitution,
  method,
  rolled,
  onChange,
}: HitPointChoiceProps) {
  const headingId = useId();
  const [typed, setTyped] = useState(rolled === undefined ? "" : String(rolled));
  const average = averageHitPoints(die);
  const face = method === "average" ? average : method === undefined ? undefined : rolled;
  const how =
    method === "roll"
      ? `Rolled ${rolled} on the d${die}`
      : method === "average"
        ? `Average ${average}`
        : `Typed ${face}`;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-1.5">
      <h3 id={headingId} className="font-semibold text-label text-muted uppercase">
        Hit points — d{die}
      </h3>
      <div className="flex gap-2">
        <button
          type="button"
          aria-pressed={method === "average"}
          onClick={() => onChange("average", undefined)}
          className={BUTTON}
        >
          Average ({average})
        </button>
        <button
          type="button"
          aria-pressed={method === "roll"}
          onClick={() => onChange("roll", rollDice(`1d${die}`).total)}
          className={BUTTON}
        >
          {method === "roll" ? "Reroll" : "Roll"} (d{die})
        </button>
        <button
          type="button"
          aria-pressed={method === "custom"}
          onClick={() => onChange("custom", typedFace(typed, die))}
          className={BUTTON}
        >
          Custom
        </button>
      </div>
      {method === "custom" && (
        <InputField
          label={`Rolled value, 1 to ${die}`}
          type="number"
          min={1}
          max={die}
          step={1}
          value={typed}
          onChange={(event) => {
            setTyped(event.target.value);
            onChange("custom", typedFace(event.target.value, die));
          }}
          error={typed !== "" && face === undefined && `Type a whole number from 1 to ${die}.`}
          className="w-24 text-row"
        />
      )}
      <p aria-live="polite" className="text-muted text-row">
        {face === undefined
          ? "Choose how this level's hit points are found."
          : constitution === undefined
            ? `${how}, plus your Constitution modifier.`
            : `${how} ${signed(constitution)} Constitution = +${Math.max(1, face + constitution)} hit points`}
      </p>
    </section>
  );
}
