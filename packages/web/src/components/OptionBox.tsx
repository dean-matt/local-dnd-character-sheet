import type { RollEffectEntry, RollOption } from "@dnd/character";
import { doing, optionKey } from "../lib/rollOption.ts";

/** A checkbox the player ticks where the entry's condition holds. */
export function OptionBox({
  entry,
  ticked,
  toggle,
}: {
  entry: RollEffectEntry | RollOption;
  ticked: ReadonlySet<string>;
  toggle: (key: string, on: boolean) => void;
}) {
  const key = optionKey(entry);
  return (
    <label className="flex items-center gap-1 text-label">
      <input
        type="checkbox"
        checked={ticked.has(key)}
        aria-label={`${entry.source}: ${doing(entry)} ${entry.condition}`}
        onChange={(event) => toggle(key, event.target.checked)}
      />
      <span title={entry.condition}>
        {entry.source} {doing(entry)}
      </span>
    </label>
  );
}
