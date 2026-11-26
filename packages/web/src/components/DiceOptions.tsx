import type { RollEffectEntry, RollOption } from "@dnd/character";
import { Dice4 } from "lucide-react";
import { doing, optionKey } from "../lib/rollOption.ts";
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
  const on = riders.filter((entry) => ticked.has(optionKey(entry)));
  const named = on.map((entry) => `${entry.source} ${doing(entry)}`).join(", ");
  return (
    <Popover
      trigger={
        <span
          aria-hidden="true"
          className={`flex h-5 min-w-5 items-center justify-center gap-0.5 text-label ${on.length > 0 ? "text-accent-text" : "text-muted"}`}
        >
          <Dice4 size={14} />
          {on.length > 0 && on.map((entry) => doing(entry)).join(" ")}
        </span>
      }
      triggerLabel={on.length > 0 ? `${label}, ${named} ticked` : label}
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
