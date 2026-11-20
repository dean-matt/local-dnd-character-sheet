import {
  type CharacterDerived,
  type CharacterState,
  type ContentRef,
  type RollRecord,
  restoredState,
  restoreFor,
  slotSpent,
} from "@dnd/character";
import { rollDice } from "@dnd/dice";
import { useContext } from "react";
import { OnRolled } from "../components/rollerContext.ts";
import { useRecordRoll } from "./useRecordRoll.ts";

type Restore = CharacterDerived["featureRestores"][number];

const ROLL_TYPE = { heal: "healing", tempHp: "temporary-hp" } as const;

/** The dice plus the bonus, rolled; a bonus alone, which notation cannot start with, is its own total. */
function rolled({ dice, bonus }: Restore): Omit<RollRecord, "type" | "label"> {
  if (dice === null) {
    return { notation: String(bonus), total: bonus, dice: [], modifier: bonus, critical: false };
  }
  const sign = bonus < 0 ? "-" : "+";
  return rollDice(bonus === 0 ? dice : `${dice}${sign}${Math.abs(bonus)}`);
}

const points = (amount: number, temporary = false) =>
  `${amount} ${temporary ? "temporary " : ""}hit point${amount === 1 ? "" : "s"}`;

function said({ kind, others }: Restore, amount: number, before: CharacterState) {
  if (others && kind === "heal") return `${points(amount)} to restore to another creature`;
  if (others) return `${points(amount, true)} to give another creature`;
  if (kind === "heal") return `regained ${points(amount)}`;
  return before.hitPoints.temporary > amount
    ? `kept ${points(before.hitPoints.temporary, true)} over ${amount}`
    : `gained ${points(amount, true)}`;
}

/** What the player chose for an amount per choice, in the words that follow the restore. */
const chosenWords = ({ per }: Restore, count: number) =>
  per?.unit === "slotLevel"
    ? ` from a level ${count} slot`
    : per
      ? ` for ${count} creature${count === 1 ? "" : "s"}`
      : "";

/**
 * What one use of `feature` restores, rolled: each of its restores landed on `state` by
 * `restoredState`, what to announce, and the rolls under the feature's name. An amount per
 * choice is multiplied by `count`, the slot level or creatures the player chose, and a slot
 * level also spends a slot of that level.
 */
function featureRestore(
  derived: CharacterDerived,
  feature: ContentRef,
  state: CharacterState,
  count = 1,
  roll: (restore: Restore) => Omit<RollRecord, "type" | "label"> = rolled,
): { state: CharacterState; text: string[]; rolls: RollRecord[] } {
  const restores = derived.featureRestores.filter(
    (restore) => restore.feature.name === feature.name && restore.feature.source === feature.source,
  );
  return restores.reduce<{ state: CharacterState; text: string[]; rolls: RollRecord[] }>(
    (into, restore) => {
      const record = roll({ ...restore, ...restoreFor(restore, count) });
      const spent =
        restore.per?.unit === "slotLevel"
          ? slotSpent(derived, into.state, { via: "slot", level: count, left: null })
          : into.state;
      const landed = restoredState(derived, spent, restore, record.total);
      return {
        state: landed.state,
        text: [
          ...into.text,
          `${feature.name}: ${said(restore, landed.amount, into.state)}${chosenWords(restore, count)}`,
        ],
        rolls: [...into.rolls, { type: ROLL_TYPE[restore.kind], label: feature.name, ...record }],
      };
    },
    { state, text: [], rolls: [] },
  );
}

/**
 * Rolls what one use of a held feature restores, for the caller to write with its spend as
 * one state write. `log` records the rolls once that write lands. A feature that restores
 * nothing leaves `state` as given.
 */
export function useFeatureRestore(characterId: string) {
  const record = useRecordRoll(characterId);
  const onRolled = useContext(OnRolled);

  return (derived: CharacterDerived, feature: ContentRef, state: CharacterState, count = 1) => {
    const restored = featureRestore(derived, feature, state, count);
    return {
      ...restored,
      log: () => {
        for (const roll of restored.rolls) record.mutate(roll, { onSuccess: onRolled });
      },
    };
  };
}
