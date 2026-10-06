import type { CharacterDefinition, ContentRef, EntryRef } from "@dnd/character";
import { rollDice } from "@dnd/dice";

type Level = CharacterDefinition["levels"][number];

export const rollHitDie = (faces: number): number => rollDice(`1d${faces}`).total;

/**
 * `count` levels in `cls`, keeping each roll the old list held at the same position. The
 * first level takes the die's highest face whatever it holds, so it keeps no roll.
 */
export function levelsIn(cls: EntryRef, count: number, previous: readonly Level[]): Level[] {
  return Array.from({ length: count }, (_, index) => {
    const rolled = index === 0 ? undefined : previous[index]?.rolled;
    return rolled === undefined ? { class: cls } : { class: cls, rolled };
  });
}

/** `levels` with `subclass` on the level that grants it, or with no subclass where it is absent. */
export function withSubclass(
  levels: readonly Level[],
  subclass: ContentRef | undefined,
  at: number,
): Level[] {
  return levels.map(({ subclass: _, ...level }, index) =>
    subclass && index === at - 1 ? { ...level, subclass } : level,
  );
}

/** `levels` with every level after the first rolled afresh, or each roll dropped where `roll` is absent. */
export function rerolled(levels: readonly Level[], roll?: () => number): Level[] {
  return levels.map(({ rolled: _, ...level }, index) => {
    const face = index === 0 ? undefined : roll?.();
    return face === undefined ? level : { ...level, rolled: face };
  });
}

export const subclassOf = (levels: readonly Level[]): ContentRef | undefined =>
  levels.find((level) => level.subclass)?.subclass;
