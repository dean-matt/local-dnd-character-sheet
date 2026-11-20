import { type Attack, tradeKey } from "../../attack.ts";
import { signed } from "../../signed.ts";

type Trade = Attack["options"][number];

const tradeText = ({ source, attack, damage, critical }: Trade) =>
  critical === null
    ? `${source} ${signed(attack)}/${signed(damage)}`
    : `${source} crit ${critical}–20`;

/** A checkbox per trade a feature offers on the row, such as Sharpshooter's -5/+10. */
export function AttackTrades({
  options,
  taken,
  take,
}: {
  options: Attack["options"];
  taken: Attack["options"];
  take: (key: string, on: boolean) => void;
}) {
  return options.map((option) => (
    <label key={tradeKey(option)} className="flex items-center gap-1 text-label">
      <input
        type="checkbox"
        checked={taken.includes(option)}
        aria-label={`${tradeText(option)}, ${option.condition}`}
        onChange={(event) => take(tradeKey(option), event.target.checked)}
      />
      <span title={option.condition}>{tradeText(option)}</span>
    </label>
  ));
}
