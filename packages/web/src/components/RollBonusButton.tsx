import type { RollRecord } from "@dnd/character";
import { Dices } from "lucide-react";
import { useContext, useState } from "react";
import { useRollAndRecord } from "../hooks/useRollAndRecord.ts";
import { RollingFor } from "./rollerContext.ts";

/**
 * Rolls `dice` (a d20 unless told otherwise) plus `bonus` and records it under `label`, `type` and `origin`; nothing where no character's
 * sheet is open to record to. Its status region speaks what was rolled and the total
 * without moving focus, and says so when the roll could not be logged.
 */
export function RollBonusButton({
  label,
  type,
  origin,
  bonus,
  dice = "1d20",
}: Pick<RollRecord, "label" | "type" | "origin"> & {
  bonus: number;
  dice?: string;
}) {
  const characterId = useContext(RollingFor);
  const { roll } = useRollAndRecord(characterId ?? "");
  const [heard, setHeard] = useState("");
  if (characterId === null) return null;
  const notation = bonus === 0 ? dice : `${dice}${bonus < 0 ? "-" : "+"}${Math.abs(bonus)}`;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setHeard("");
          roll(notation, { label, type, origin }, (rolled, logged) =>
            setHeard(`${label}: ${rolled.total}${logged ? "" : ", not logged"}`),
          );
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
