import type { RollType } from "@dnd/character";
import { rollDice } from "@dnd/dice";
import { useContext } from "react";
import { OnRolled } from "../components/rollerContext.ts";
import { useRecordRoll } from "./useRecordRoll.ts";

type Roll = ReturnType<typeof rollDice>;

/**
 * Rolls `notation`, records it under `label` and `type` in the character's roll log and hands the
 * recorded entry to the layout. `settled` hears the roll and whether it was recorded; a
 * notation that does not parse rolls nothing.
 */
export function useRollAndRecord(characterId: string) {
  const record = useRecordRoll(characterId);
  const onRolled = useContext(OnRolled);

  function roll(
    notation: string,
    label: string,
    type: RollType,
    settled?: (rolled: Roll, logged: boolean) => void,
  ) {
    let rolled: Roll;
    try {
      rolled = rollDice(notation);
    } catch {
      return;
    }
    record.mutate(
      {
        type,
        label,
        notation: rolled.notation,
        total: rolled.total,
        dice: rolled.dice,
        modifier: rolled.modifier,
        critical: rolled.critical,
      },
      {
        onSuccess: (entry) => {
          onRolled(entry);
          settled?.(rolled, true);
        },
        onError: () => settled?.(rolled, false),
      },
    );
  }

  return { roll, failed: record.isError };
}
