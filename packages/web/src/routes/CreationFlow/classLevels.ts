import { type CharacterDefinition, type ContentRef, type EntryRef, entryKey } from "@dnd/character";
import { rollDice } from "@dnd/dice";

type Level = CharacterDefinition["levels"][number];

/** The most levels a character holds, across every class. */
export const HIGHEST_LEVEL = 20;

export const rollHitDie = (faces: number): number => rollDice(`1d${faces}`).total;

/** One class the levels hold, with its own levels in the order they were taken. */
type ClassGroup = { class: EntryRef; levels: Level[] };

/** `levels` split by class, in the order each class was first taken. */
function groupLevels(levels: readonly Level[]): ClassGroup[] {
  const groups = new Map<string, ClassGroup>();
  for (const level of levels) {
    const key = entryKey(level.class);
    const group = groups.get(key) ?? { class: level.class, levels: [] };
    group.levels.push(level);
    groups.set(key, group);
  }
  return [...groups.values()];
}

/** The groups' levels, one class after another. The first takes its die's highest face, so it keeps no roll. */
function joined(groups: readonly ClassGroup[]): Level[] {
  return groups
    .flatMap((group) => group.levels)
    .map((level, index) => {
      if (index > 0 || level.rolled === undefined) return level;
      const { rolled: _, ...rest } = level;
      return rest;
    });
}

/**
 * `levels` holding `count` levels in `cls`, each class's levels side by side in the order
 * the classes were first taken. A class it lacks is added last, and a count of 0 removes
 * it. A kept level keeps its roll and its subclass, so a count lowered past the level
 * that holds a subclass drops it.
 */
export function withClassCount(levels: readonly Level[], cls: EntryRef, count: number): Level[] {
  const key = entryKey(cls);
  const groups = groupLevels(levels);
  const resized = (previous: readonly Level[]) =>
    Array.from({ length: count }, (_, index) => previous[index] ?? { class: cls });
  const found = groups.some((group) => entryKey(group.class) === key);
  return joined(
    found
      ? groups.map((group) =>
          entryKey(group.class) === key ? { ...group, levels: resized(group.levels) } : group,
        )
      : [...groups, { class: cls, levels: resized([]) }],
  );
}

/**
 * `levels` with `subclass` on the `at`th level in `cls`, or with no subclass in `cls` where
 * it is absent. Every other class keeps its own.
 */
export function withSubclass(
  levels: readonly Level[],
  cls: EntryRef,
  subclass: ContentRef | undefined,
  at: number,
): Level[] {
  const key = entryKey(cls);
  let taken = 0;
  return levels.map((level) => {
    if (entryKey(level.class) !== key) return level;
    taken += 1;
    const { subclass: _, ...rest } = level;
    return subclass && taken === at ? { ...rest, subclass } : rest;
  });
}

/**
 * `levels` with every level after the first rolled afresh by `roll`, which takes the
 * level's position, or each roll dropped where `roll` is absent.
 */
export function rerolled(levels: readonly Level[], roll?: (index: number) => number): Level[] {
  return levels.map(({ rolled: _, ...level }, index) => {
    const face = index === 0 ? undefined : roll?.(index);
    return face === undefined ? level : { ...level, rolled: face };
  });
}

/** The subclass a level in `cls` names. */
export const subclassOf = (levels: readonly Level[], cls: EntryRef): ContentRef | undefined =>
  levels.find((level) => level.subclass && entryKey(level.class) === entryKey(cls))?.subclass;
