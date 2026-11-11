import type { RollRecord } from "@dnd/character";
import { rollDice } from "@dnd/dice";
import { useContext } from "react";
import { OnRolled } from "../components/rollerContext.ts";
import { useRecordRoll } from "./useRecordRoll.ts";

type Roll = ReturnType<typeof rollDice>;

/**
 * Rolls `notation`, records it under `named` in the character's roll log and hands the
 * recorded entry to the layout. `settled` hears the roll and whether it was recorded; a
 * notation that does not parse rolls nothing and returns the parser's error.
 */
export function useRollAndRecord(characterId: string) {
  const record = useRecordRoll(characterId);
  const onRolled = useContext(OnRolled);

  function roll(
    notation: string,
    named: Pick<RollRecord, "label" | "type" | "origin">,
    settled?: (rolled: Roll, logged: boolean) => void,
  ): Error | undefined {
    let rolled: Roll;
    try {
      rolled = rollDice(notation);
    } catch (error) {
      return error as Error;
    }
    record.mutate(
      {
        ...named,
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
    return undefined;
  }

  return { roll, failed: record.isError };
}
