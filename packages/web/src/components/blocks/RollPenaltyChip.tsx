import { CHIP } from "../../lib/chipStyles.ts";
import type { RollPenalty } from "../../lib/penalisedRoll.ts";
import { Popover } from "../Popover.tsx";

/** The points a rule takes off one roll, as a chip that opens to its source. */
export function RollPenaltyChip({
  roll,
  penalty,
}: {
  /** The roll the chip marks, such as "Stealth check", for its accessible name. */
  roll: string;
  penalty: RollPenalty | undefined;
}) {
  if (!penalty) return null;
  const points = `−${Math.abs(penalty.value)}`;
  return (
    <Popover
      trigger={
        <span
          className={`${CHIP} inline-block whitespace-nowrap border-accent bg-accent leading-3 text-white`}
        >
          {points}
        </span>
      }
      triggerLabel={`${roll}: ${points} (${penalty.source})`}
      label={`${roll} penalty`}
    >
      {points} to the roll ({penalty.source})
    </Popover>
  );
}
