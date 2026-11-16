import { type CharacterRecord, houseRule, type RollRecord } from "@dnd/character";
import { rollDice } from "@dnd/dice";
import { useQueryClient } from "@tanstack/react-query";
import { useContext } from "react";
import { OnRolled } from "../components/rollerContext.ts";
import { characterKey } from "./characterKeys.ts";
import { useRecordRoll } from "./useRecordRoll.ts";

type Roll = ReturnType<typeof rollDice>;

/**
 * Rolls `notation`, records it under `named` in the character's roll log and hands the
 * recorded entry to the layout. A `mode` in `named` rolls in it and is recorded with the dice, the discarded one included. A `critical` one doubles the dice and not the modifier, as a critical hit does, or counts one set at its maximum where the character's house rule says so. `settled` hears the roll and whether it was recorded; a
 * notation that does not parse rolls nothing and returns the parser's error.
 */
export function useRollAndRecord(characterId: string) {
  const record = useRecordRoll(characterId);
  const onRolled = useContext(OnRolled);
  const queryClient = useQueryClient();

  function roll(
    notation: string,
    named: Pick<RollRecord, "label" | "type" | "origin" | "mode"> & { critical?: boolean },
    settled?: (rolled: Roll, logged: boolean) => void,
  ): Error | undefined {
    let rolled: Roll;
    try {
      const definition = queryClient.getQueryData<CharacterRecord>(
        characterKey(characterId),
      )?.definition;
      rolled = rollDice(notation, {
        mode: named.mode,
        critical: named.critical,
        maximumCritical:
          definition !== undefined && houseRule(definition, "criticalHit") === "maximum",
      });
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
        ...(named.mode && { mode: rolled.mode }),
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
