import type { RollRecord } from "@dnd/character";
import { Dices } from "lucide-react";
import { useContext, useState } from "react";
import { useRollAndRecord } from "../hooks/useRollAndRecord.ts";
import { extraTotal, parseExtraDie } from "../lib/extraDie.ts";
import { RollingFor } from "./rollerContext.ts";

function included(
  dice: Parameters<typeof extraTotal>[0],
  { count, notation }: { count: number; notation: string },
) {
  return count === 0 ? "" : `, including ${extraTotal(dice, count)} from ${notation}`;
}

/**
 * Rolls `dice` (a d20 unless told otherwise) plus `bonus` and records it under `label`, `type` and `origin`; nothing where no character's
 * sheet is open to record to. Its status region speaks what was rolled and the total
 * without moving focus, and says so when the roll could not be logged. `beforeRoll` runs
 * first and rolls nothing when it resolves false. A `mode` rolls with advantage or disadvantage and says so.
 * An `extra` die the player typed, such as `+1d4`, rolls with the d20 as its own term, and a
 * result that is not a die is spoken and rolls nothing.
 * `critAt` makes it an attack that scores a critical hit on a kept die of that number or more, and says so;
 * `critical` rolls the damage of one, doubling the dice. `onRolled` hears whether the roll was a critical hit.
 */
export function RollBonusButton({
  label,
  type,
  origin,
  bonus,
  dice = "1d20",
  mode,
  extra = "",
  beforeRoll,
  critAt,
  critical,
  onRolled,
}: Pick<RollRecord, "label" | "type" | "origin" | "mode"> & {
  bonus: number;
  dice?: string;
  extra?: string;
  critAt?: number;
  critical?: boolean;
  onRolled?: (hit: boolean) => void;
  beforeRoll?: () => Promise<boolean>;
}) {
  const characterId = useContext(RollingFor);
  const { roll } = useRollAndRecord(characterId ?? "");
  const [heard, setHeard] = useState("");
  if (characterId === null) return null;
  const die = parseExtraDie(extra);
  const notation = `${dice}${die.notation}${bonus === 0 ? "" : `${bonus < 0 ? "-" : "+"}${Math.abs(bonus)}`}`;

  return (
    <>
      <button
        type="button"
        onClick={async () => {
          setHeard("");
          if (die.error) {
            setHeard(die.error);
            return;
          }
          if (beforeRoll && !(await beforeRoll())) return;
          roll(notation, { label, type, origin, mode, critical }, (rolled, logged, outcome) => {
            const kept = rolled.dice.find((die) => die.kept)?.value ?? 0;
            const hit = critAt !== undefined && kept >= critAt;
            onRolled?.(hit);
            const said = [hit && "critical hit", outcome, !logged && "not logged"].filter(Boolean);
            setHeard(
              `${label}${mode && mode !== "normal" ? ` with ${mode}` : ""}${critical ? " as a critical hit" : ""}: ${rolled.total}${included(rolled.dice, die)}${said.map((part) => `, ${part}`).join("")}`,
            );
          });
        }}
        aria-label={`Roll ${label}`}
        title={`Roll ${label}`}
        className="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-control text-muted hover:bg-subtle hover:text-ink"
      >
        <Dices size={14} aria-hidden="true" />
      </button>
      <span role="status" className="sr-only">
        {heard}
      </span>
    </>
  );
}
