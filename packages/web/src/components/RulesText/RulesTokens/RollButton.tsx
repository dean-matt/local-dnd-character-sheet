import { rollDice } from "@dnd/dice";
import { type KeyboardEvent, useState } from "react";
import { useRecordRoll } from "../../../hooks/useRecordRoll.ts";

type Roll = ReturnType<typeof rollDice>;

/**
 * Rolls its notation and shows the pool beside itself: every die, a discarded one struck
 * through and named for a screen reader, then the modifier and the total. The result sits
 * in a live region that exists before the first roll, which is what makes a reader speak
 * it. Escape dismisses it; a second roll replaces it.
 */
export function RollButton({
  characterId,
  notation,
  display,
}: {
  characterId: string;
  notation: string;
  display: string;
}) {
  const [roll, setRoll] = useState<Roll | null>(null);
  const record = useRecordRoll(characterId);

  function activate() {
    let rolled: Roll;
    try {
      rolled = rollDice(notation);
    } catch {
      return;
    }
    setRoll(rolled);
    record.mutate({
      label: display,
      notation: rolled.notation,
      total: rolled.total,
      dice: rolled.dice,
      modifier: rolled.modifier,
      critical: rolled.critical,
    });
  }

  function dismiss(event: KeyboardEvent) {
    if (event.key === "Escape" && roll) {
      event.stopPropagation();
      setRoll(null);
    }
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: forwards Escape from the button inside it.
    <span onKeyDown={dismiss} data-notation={notation} data-rollable="true">
      <button
        type="button"
        onClick={activate}
        aria-label={`Roll ${display}`}
        className="cursor-pointer underline decoration-dotted underline-offset-2"
      >
        {display}
      </button>
      <span role="status" className="empty:hidden">
        {roll && (
          <>
            {" "}
            <span className="whitespace-nowrap rounded-control bg-subtle px-1 text-row">
              {roll.dice.map((die, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: a roll's pool never reorders.
                <span key={index} className={die.kept ? undefined : "line-through"}>
                  {index > 0 && " "}
                  {die.sign < 0 && "−"}
                  {die.value}
                  {!die.kept && <span className="sr-only"> discarded</span>}
                </span>
              ))}
              {roll.modifier !== 0 &&
                ` ${roll.modifier < 0 ? "−" : "+"} ${Math.abs(roll.modifier)}`}
              {" = "}
              <strong>{roll.total}</strong>
            </span>
          </>
        )}
      </span>
    </span>
  );
}
