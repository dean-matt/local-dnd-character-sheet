import { netRollEffect, type RollEffectEntry } from "@dnd/character";
import { CHIP } from "../../../lib/chipStyles.ts";
import { Popover } from "../../Popover.tsx";

const MODE = {
  advantage: { chip: "ADV", label: "Advantage" },
  disadvantage: { chip: "DIS", label: "Disadvantage" },
  cancel: { chip: "ADV/DIS", label: "Advantage and disadvantage cancel" },
} as const;

/**
 * The advantage or disadvantage equipped items grant on one roll, as one chip that opens
 * each effect and the net result. A conditional effect draws the chip in outline with an
 * asterisk, because only the table knows whether its condition holds.
 */
export function RollEffectChip({
  roll,
  effects,
}: {
  /** The roll the chip marks, such as "Stealth check", for its accessible name. */
  roll: string;
  effects: readonly RollEffectEntry[];
}) {
  const net = netRollEffect(effects);
  if (!net) return null;
  const lines = [
    ...new Set(
      effects.map(
        ({ item, mode, condition }) =>
          `${condition ? `${MODE[mode].label} ${condition}` : MODE[mode].label} (${item})`,
      ),
    ),
  ];
  const result = `${MODE[net.mode].label}${net.conditional ? " if every condition holds" : ""}`;
  const fill = net.conditional
    ? "border-accent bg-surface text-accent-text"
    : "border-accent bg-accent text-white";
  return (
    <Popover
      trigger={
        <span
          className={`${CHIP} ${fill} inline-block whitespace-nowrap leading-3 ${net.mode === "cancel" ? "line-through" : ""}`}
        >
          {MODE[net.mode].chip}
          {net.conditional && "*"}
        </span>
      }
      triggerLabel={`${roll}: ${result}`}
      label={`${roll} advantage and disadvantage`}
    >
      <ul>
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="mt-1 font-semibold">{result}</p>
    </Popover>
  );
}
