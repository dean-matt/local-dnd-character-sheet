import type { RollEffectEntry, RollOption } from "@dnd/character";
import { Dice4 } from "lucide-react";
import { optionKey } from "../lib/rollOption.ts";
import { OptionBox } from "./OptionBox.tsx";
import { Popover } from "./Popover.tsx";

/** The rider-die options, behind a trigger so the row keeps its size. */
export function DiceOptions({
  riders,
  ticked,
  toggle,
  label,
}: {
  riders: readonly (RollEffectEntry | RollOption)[];
  ticked: ReadonlySet<string>;
  toggle: (key: string, on: boolean) => void;
  label: string;
}) {
  if (riders.length === 0) return null;
  const on = riders.some((entry) => ticked.has(optionKey(entry)));
  return (
    <Popover
      trigger={
        <Dice4 aria-hidden="true" size={14} className={on ? "text-accent-text" : "text-muted"} />
      }
      triggerLabel={label}
      label={label}
    >
      <span className="flex flex-col gap-1">
        {riders.map((entry) => (
          <OptionBox key={optionKey(entry)} entry={entry} ticked={ticked} toggle={toggle} />
        ))}
      </span>
    </Popover>
  );
}
