import { rollDice } from "@dnd/dice";
import { useContext, useState } from "react";
import { useRecordRoll } from "../../../../hooks/useRecordRoll.ts";
import { OnRolled } from "../../../rollerContext.ts";
import type { Attack, Landed } from "../../attack.ts";
import { signed } from "../../signed.ts";

const added = ({ source, dice, attack }: Attack["options"][number]) =>
  `${source} ${dice ?? signed(attack)}`;

/**
 * What the features that add after the roll offer on the roll that landed: a button for each,
 * which rolls its die where it has one and logs the roll again with the total it brings.
 * A feature adds once, so the sizes of a bonus it offers go with it.
 */
export function AttackAfterRoll({
  characterId,
  origin,
  options,
  landed,
  applied,
}: {
  characterId: string;
  origin: string;
  options: Attack["options"];
  landed: Landed | undefined;
  applied: (next: Landed) => void;
}) {
  const record = useRecordRoll(characterId);
  const onRolled = useContext(OnRolled);
  const [heard, setHeard] = useState("");
  const offered = landed ? options.filter(({ source }) => !landed.sources.includes(source)) : [];
  if (!landed || offered.length === 0) return null;

  function apply(option: Attack["options"][number]) {
    if (!landed) return;
    const die = option.dice ? rollDice(option.dice) : undefined;
    const roll = {
      ...landed.roll,
      notation: `${landed.roll.notation}+${option.dice ?? option.attack}`,
      total: landed.roll.total + option.attack + (die?.total ?? 0),
      dice: [...landed.roll.dice, ...(die?.dice ?? [])],
      modifier: landed.roll.modifier + option.attack,
    };
    const sources = [...landed.sources, option.source];
    const label = `${landed.label} with ${sources.join(" and ")}`;
    record.mutate(
      { type: "attack", label, origin, ...roll },
      {
        onSuccess: (entry) => {
          onRolled(entry);
          setHeard(`${label}: ${roll.total}`);
          applied({ ...landed, roll, sources });
        },
        onError: () => setHeard(`${label}: ${roll.total}, not logged`),
      },
    );
  }

  return (
    <>
      {offered.map((option) => (
        <button
          key={`${option.source}|${option.condition}`}
          type="button"
          onClick={() => apply(option)}
          aria-label={`Add ${added(option)} to the ${landed.label}, ${option.condition}`}
          title={option.condition}
          className="min-h-6 self-start rounded-control border border-border bg-surface px-1 text-label"
        >
          Add {added(option)}
        </button>
      ))}
      <span role="status" className="sr-only">
        {heard}
      </span>
    </>
  );
}
