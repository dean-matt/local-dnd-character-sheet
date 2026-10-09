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
};

/** The class features that grant an improvement, in both editions, and whether each is a boon. */
const IMPROVEMENT_FEATURES: Record<string, boolean> = {
  "Ability Score Improvement": false,
  "Epic Boon": true,
};

/**
 * Every improvement `levels` reaches, in level order: each level in a class whose features,
 * from `featuresOf`, include an improvement at that class level.
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
    return [{ level: index + 1, cls, classLevel, boon }];
  });
}

/** Names `grant` where a sheet lists it: `Level 4 · Wizard 4`, a boon saying so. */
export const grantTitle = (grant: ImprovementGrant): string =>
  `Level ${grant.level} · ${displayName(grant.cls)} ${grant.classLevel}${grant.boon ? " · Epic Boon" : ""}`;
