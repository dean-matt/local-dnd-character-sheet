import { type CharacterDefinition, displayName, type EntryRef, entryKey } from "@dnd/character";

type Level = CharacterDefinition["levels"][number];

/** A class feature, as far as finding an improvement needs. */
type Feature = { name: string; level: number };

/** One Ability Score Improvement or Epic Boon a character's classes grant. */
export type ImprovementGrant = {
  /** The character level it arrives at, which its choice is stored under. */
  level: number;
  cls: EntryRef;
  /** The class's own level it arrives at. */
  classLevel: number;
  /** An Epic Boon, which offers the boons beside the other feats. */
  boon: boolean;
  /** The name of every class and subclass feature the character holds by `level`. */
  features: string[];
};

/** The class features that grant an improvement, in both editions, and whether each is a boon. */
const IMPROVEMENT_FEATURES: Record<string, boolean> = {
  "Ability Score Improvement": false,
  "Epic Boon": true,
};

/**
 * Every improvement `levels` reaches, in level order: each level in a class whose features,
 * from `featuresOf`, include an improvement at that class level. `featuresOf` gives a
 * class's features and its subclass's, each at the class level it arrives.
 */
export function improvementGrants(
  levels: readonly Level[],
  featuresOf: (cls: EntryRef) => readonly Feature[],
): ImprovementGrant[] {
  const taken = new Map<string, number>();
  return levels.flatMap(({ class: cls }, index): ImprovementGrant[] => {
    const key = entryKey(cls);
    const classLevel = (taken.get(key) ?? 0) + 1;
    taken.set(key, classLevel);
    const feature = featuresOf(cls).find(
      ({ name, level }) => level === classLevel && name in IMPROVEMENT_FEATURES,
    );
    if (feature === undefined) return [];
    const boon = IMPROVEMENT_FEATURES[feature.name] === true;
    const features = classLevels(levels.slice(0, index + 1)).flatMap(({ cls: held, level: at }) =>
      featuresOf(held)
        .filter(({ level }) => level <= at)
        .map(({ name }) => name),
    );
    return [{ level: index + 1, cls, classLevel, boon, features }];
  });
}

/** Each class `levels` holds, with the class level it reaches. */
export function classLevels(levels: readonly Level[]): { cls: EntryRef; level: number }[] {
  const reached = new Map<string, { cls: EntryRef; level: number }>();
  for (const { class: cls } of levels) {
    const key = entryKey(cls);
    reached.set(key, { cls, level: (reached.get(key)?.level ?? 0) + 1 });
  }
  return [...reached.values()];
}

/** Names `grant` where a sheet lists it: `Level 4 · Wizard 4`, a boon saying so. */
export const grantTitle = (grant: ImprovementGrant): string =>
  `Level ${grant.level} · ${displayName(grant.cls)} ${grant.classLevel}${grant.boon ? " · Epic Boon" : ""}`;
