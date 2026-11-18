import type { Attack } from "../../attack.ts";
import { signed } from "../../signed.ts";

/** A checkbox per trade a feature offers on the row, such as Sharpshooter's -5/+10. */
export function AttackTrades({
  options,
  taken,
  take,
}: {
  options: Attack["options"];
  taken: Attack["options"];
  take: (source: string, on: boolean) => void;
}) {
  return options.map((option) => (
    <label key={option.source} className="flex items-center gap-1 text-label">
      <input
        type="checkbox"
        checked={taken.includes(option)}
        aria-label={`${option.source} ${signed(option.attack)}/${signed(option.damage)}, ${option.condition}`}
        onChange={(event) => take(option.source, event.target.checked)}
      />
      <span title={option.condition}>
        {option.source} {signed(option.attack)}/{signed(option.damage)}
      </span>
    </label>
  ));
}
