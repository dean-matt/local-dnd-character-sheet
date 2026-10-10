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
  const lines = [
    ...new Map(
      effects.map(({ item, mode, condition }) => {
        const text = `${condition ? `${MODE_LABEL[mode]} ${condition}` : MODE_LABEL[mode]} (${item})`;
        return [text, { text, plain: !condition }] as const;
      }),
    ).values(),
  ];
  if (lines.length === 0) return null;
  return (
    <ul className={`text-label ${className}`}>
      {lines.map(({ text, plain }) => (
        <li key={text} className={plain ? "font-semibold" : "text-muted"}>
          {text}
        </li>
      ))}
    </ul>
  );
}
