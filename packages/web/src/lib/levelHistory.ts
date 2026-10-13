import type { ClassFeatureRecord } from "@dnd/catalog";
import {
  type CharacterDefinition,
  type ContentRef,
  displayName,
  type EntryRef,
  entryKey,
} from "@dnd/character";

type Level = CharacterDefinition["levels"][number];

/** A class's features and its subclass's, each at the class level it arrives. */
export type ClassFeatures = {
  class: readonly ClassFeatureRecord[];
  subclass: readonly ClassFeatureRecord[];
};

/** One character level as the level history lists it. */
export type LevelHistoryRow = {
  /** The character level, a position in `levels`. */
  level: number;
  cls: EntryRef;
  /** The class's own level this character level reached. */
  classLevel: number;
  /** The subclass chosen at this level, if any. */
  subclass?: ContentRef;
  features: readonly HistoryFeature[];
};

/**
 * A feature a level grants, with the class or subclass that grants it. A class and its
 * subclass can grant one name at one level — `Channel Divinity` (PHB) to a classic
 * Paladin 3 — and a late subclass pick brings one name at several, so only the grantor
 * and the level tell two apart.
 */
export type HistoryFeature = { record: ClassFeatureRecord; grantor: string; subclass: boolean };

/**
 * One row per entry in `levels`, oldest first, each with the features its class level
 * grants. A subclass's features land at the class level they print, except those printed
 * below the level the subclass was chosen at, which all arrive with the choice. A feature
 * that is one option of another's choice is left out: the choice, not the menu, is what
 * the level grants.
 */
export function levelHistory(
  levels: readonly Level[],
  featuresOf: (cls: EntryRef) => ClassFeatures,
): LevelHistoryRow[] {
  const taken = new Map<string, number>();
  const chosenAt = new Map<string, { level: number; subclass: ContentRef }>();
  return levels.map(({ class: cls, subclass }, index) => {
    const key = entryKey(cls);
    const classLevel = (taken.get(key) ?? 0) + 1;
    taken.set(key, classLevel);
    if (subclass) chosenAt.set(key, { level: classLevel, subclass });
    const chosen = chosenAt.get(key);
    const features = featuresOf(cls);
    const arrives = ({ level, offeredBy }: ClassFeatureRecord, early: boolean) =>
      offeredBy === undefined && (level === classLevel || (early && level < classLevel));
    return {
      level: index + 1,
      cls,
      classLevel,
      ...(subclass && { subclass }),
      features: [
        ...features.class
          .filter((feature) => arrives(feature, false))
          .map((record) => ({ record, grantor: displayName(cls), subclass: false })),
        ...(chosen === undefined
          ? []
          : features.subclass
              .filter((feature) => arrives(feature, chosen.level === classLevel))
              .map((record) => ({ record, grantor: chosen.subclass.name, subclass: true }))),
      ],
    };
  });
}
