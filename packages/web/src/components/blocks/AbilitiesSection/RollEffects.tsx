import type { RollEffectEntry } from "@dnd/character";

const MODE_LABEL = { advantage: "Advantage", disadvantage: "Disadvantage" } as const;

/**
 * The advantage or disadvantage equipped items grant on one roll. An unconditional effect
 * reads as a statement of the roll; a conditional one reads as a note, so the table checks
 * whether it applies before rolling with it.
 */
export function RollEffects({
  effects,
  className = "",
}: {
  effects: readonly RollEffectEntry[];
  className?: string;
}) {
  if (effects.length === 0) return null;
  return (
    <ul className={`text-label ${className}`}>
      {effects.map(({ item, mode, condition }) => (
        <li
          key={`${item}-${mode}-${condition ?? ""}`}
          className={condition ? "text-muted" : "font-semibold"}
        >
          {condition ? `${MODE_LABEL[mode]} ${condition}` : MODE_LABEL[mode]} ({item})
        </li>
      ))}
    </ul>
  );
}
