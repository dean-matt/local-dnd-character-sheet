import { rollDice } from "@dnd/dice";

export interface GoldAlternativeFieldProps {
  gold: { dice: string; multiplier: number };
  /** The gold pieces rolled, or `undefined` while the equipment is taken instead. */
  taken: number | undefined;
  onTake: (gp: number | undefined) => void;
}

/** A classic class's gold in place of the class's and the background's equipment, rolled when taken. */
export function GoldAlternativeField({ gold, taken, onTake }: GoldAlternativeFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-center gap-2 text-body">
        <input
          type="checkbox"
          checked={taken !== undefined}
          onChange={() =>
            onTake(taken === undefined ? rollDice(gold.dice).total * gold.multiplier : undefined)
          }
        />
        Take {gold.dice}
        {gold.multiplier > 1 && ` × ${gold.multiplier}`} gp instead of the class's and the
        background's equipment
      </label>
      {taken !== undefined && <p className="text-muted text-row">Rolled {taken} gp.</p>}
    </div>
  );
}
