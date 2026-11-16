import { houseRule, type RollRecord } from "@dnd/character";
import { rollDice } from "@dnd/dice";
import { useContext } from "react";
import { OnRolled } from "../components/rollerContext.ts";
import { useCharacter } from "./useCharacter.ts";
import { useRecordRoll } from "./useRecordRoll.ts";

type Roll = ReturnType<typeof rollDice>;

/** What the naturalExtremes house rule makes of a check or save, by the d20 it kept. */
function naturalOutcome(rolled: Roll, type: RollRecord["type"], on: boolean) {
  if (!on || (type !== "check" && type !== "save")) return undefined;
  const d20 = rolled.dice.find((die) => die.kept && die.faces === 20 && die.sign === 1);
  if (d20?.value === 20) return "automatic success";
  return d20?.value === 1 ? "automatic failure" : undefined;
}

/**
 * Rolls `notation`, records it under `named` in the character's roll log and hands the
 * recorded entry to the layout. A `mode` in `named` rolls in it and is recorded with the dice, the discarded one included. A `critical` one doubles the dice and not the modifier, as a critical hit does, or counts one set at its maximum where the character's house rule says so. `settled` hears the roll, whether it was recorded and the automatic outcome a natural 20 or 1 gave a check or save under the house rule, which the log's label names too; a
 * notation that does not parse rolls nothing and returns the parser's error.
 */
export function useRollAndRecord(characterId: string) {
  const record = useRecordRoll(characterId);
  const onRolled = useContext(OnRolled);
  const character = useCharacter(characterId);

  function roll(
    notation: string,
    named: Pick<RollRecord, "label" | "type" | "origin" | "mode"> & { critical?: boolean },
    settled?: (rolled: Roll, logged: boolean, outcome?: string) => void,
  ): Error | undefined {
    let rolled: Roll;
    let outcome: string | undefined;
    try {
      const definition = character.data?.definition;
      rolled = rollDice(notation, {
        mode: named.mode,
        critical: named.critical,
        maximumCritical:
          definition !== undefined && houseRule(definition, "criticalHit") === "maximum",
      });
      outcome = naturalOutcome(
        rolled,
        named.type,
        definition !== undefined && houseRule(definition, "naturalExtremes"),
      );
    } catch (error) {
      return error as Error;
    }
    record.mutate(
      {
        ...named,
        ...(outcome && { label: `${named.label} (${outcome})` }),
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
          settled?.(rolled, true, outcome);
        },
        onError: () => settled?.(rolled, false, outcome),
      },
    );
    return undefined;
  }

  return { roll, failed: record.isError };
}
