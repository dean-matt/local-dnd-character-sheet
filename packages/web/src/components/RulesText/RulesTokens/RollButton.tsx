import { rollDice } from "@dnd/dice";
import { useContext } from "react";
import { useRecordRoll } from "../../../hooks/useRecordRoll.ts";
import { OnRolled } from "../../rollerContext.ts";

type Roll = ReturnType<typeof rollDice>;

/**
 * Rolls its notation and records the roll; the character layout shows it in the roll log.
 * The status region exists before the first roll so a reader speaks the one failure that
 * has no entry to show: a roll that could not be recorded.
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
  const record = useRecordRoll(characterId);
  const onRolled = useContext(OnRolled);

  function activate() {
    let rolled: Roll;
    try {
      rolled = rollDice(notation);
    } catch {
      return;
    }
    record.mutate(
      {
        label: display,
        notation: rolled.notation,
        total: rolled.total,
        dice: rolled.dice,
        modifier: rolled.modifier,
        critical: rolled.critical,
      },
      { onSuccess: (roll) => onRolled(roll) },
    );
  }

  return (
    <span data-notation={notation} data-rollable="true">
      <button
        type="button"
        onClick={activate}
        aria-label={`Roll ${display}`}
        className="cursor-pointer underline decoration-dotted underline-offset-2"
      >
        {display}
      </button>
      <span role="status" className="text-error empty:hidden">
        {record.isError && " not logged"}
      </span>
    </span>
  );
}
