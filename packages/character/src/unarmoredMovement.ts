import { type Term, unarmoredMovementBonus } from "@dnd/rules";
import type { Speed } from "./characterDerived.ts";
import type { CharacterDefinition } from "./definition.ts";
import type { TermReference } from "./derivedField.ts";
import { refKey } from "./keys.ts";
import { classLevels } from "./summaries.ts";

const MONK_CLASSES = new Set(["Monk|PHB", "Monk|XPHB"]);

/**
 * The speed with a Monk's Unarmored Movement added to the walk, and its term. The bonus
 * needs no armor and no shield. A homebrew class is absent by design, as in
 * `unarmoredDefense`.
 */
export function speedWithUnarmoredMovement(
  base: Speed,
  definition: Pick<CharacterDefinition, "levels">,
  armored: boolean,
): { speed: Speed; terms: Term<TermReference>[] } {
  const monk = classLevels(definition).find(
    (group) => !("homebrewId" in group.class) && MONK_CLASSES.has(refKey(group.class)),
  );
  const bonus = monk && !armored ? unarmoredMovementBonus(monk.level) : 0;
  if (bonus === 0 || base.walk === undefined) return { speed: base, terms: [] };
  return {
    speed: { ...base, walk: base.walk + bonus },
    terms: [{ label: "Unarmored Movement", value: bonus }],
  };
}
