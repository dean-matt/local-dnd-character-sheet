/**
 * The choices one character level's level-up made, read by what each record states: the
 * feats and ability increases whose `level` it is, the improvement among them; the spells it
 * was `pickedAt` and the optional features whose `level` it is; the feature choices keyed on
 * its class at the class level it reached, and on its subclass's earlier levels too where the
 * level chose the subclass.
 */
import {
  type CharacterDefinition,
  displayName,
  type EntryRef,
  entryKey,
  type FeatureKey,
  refKey,
} from "@dnd/character";

type Grantor = { kind: string; ref: EntryRef };

const grantor = (each: Grantor) => `${each.kind}|${entryKey(each.ref)}`;

/**
 * `definition` as it stood before `level`'s level-up chose anything: the levels before it,
 * and every record but the choices that level made. A choice a later level made stays.
 */
export function withoutLevelChoices(
  definition: CharacterDefinition,
  level: number,
): CharacterDefinition {
  const { levels } = definition;
  const taken = levels[level - 1];
  if (!taken) return definition;
  const cls = taken.class;
  const classLevel = levels
    .slice(0, level)
    .filter((each) => entryKey(each.class) === entryKey(cls)).length;
  const broughtBy = (feature: FeatureKey) =>
    "name" in cls &&
    feature.className === cls.name &&
    feature.classSource === cls.source &&
    (feature.level === classLevel ||
      (feature.subclass !== undefined &&
        taken.subclass !== undefined &&
        feature.level < classLevel));
  return {
    ...definition,
    levels: levels.slice(0, level - 1),
    feats: definition.feats.filter((feat) => feat.level !== level),
    abilityIncreases: definition.abilityIncreases.filter((increase) => increase.level !== level),
    featureChoices: definition.featureChoices.filter((choice) => !broughtBy(choice.feature)),
    spells: definition.spells.filter((spell) => spell.pickedAt !== level),
    optionalFeatures: definition.optionalFeatures.filter((pick) => pick.level !== level),
  };
}

/** The feats and optional features `before` held and `after` does not, each keyed by kind. */
export function lostGrantors(before: CharacterDefinition, after: CharacterDefinition) {
  const gone = (kind: string, from: { ref: EntryRef }[], to: { ref: EntryRef }[]) => {
    const held = new Set(to.map((each) => entryKey(each.ref)));
    return from
      .filter((each) => !held.has(entryKey(each.ref)))
      .map((each) => grantor({ kind, ref: each.ref }));
  };
  const lost = new Set([
    ...gone("feat", before.feats, after.feats),
    ...gone("optionalFeature", before.optionalFeatures, after.optionalFeatures),
  ]);
  return (by: Grantor | undefined) => by !== undefined && lost.has(grantor(by));
}

const listed = (words: string[]) =>
  words.length < 3 ? words.join(" and ") : `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;

type Refusal = (before: CharacterDefinition, after: CharacterDefinition, level: number) => string[];

const subclassBuiltOn: Refusal = (before, after, level) => {
  const was = before.levels[level - 1];
  const now = after.levels[level - 1]?.subclass;
  if (!was?.subclass || (now && refKey(was.subclass) === refKey(now))) return [];
  const later = before.levels.flatMap((each, index) =>
    index >= level && entryKey(each.class) === entryKey(was.class) ? [String(index + 1)] : [],
  );
  if (later.length === 0) return [];
  const many = later.length > 1;
  return [
    `${many ? "Levels" : "Level"} ${listed(later)} ${many ? "build" : "builds"} on ${was.subclass.name}; remove ${many ? "them" : "it"} to change the subclass.`,
  ];
};

const preparedDropped: Refusal = (before, after) => {
  const kept = new Set(after.spells.map((spell) => entryKey(spell.ref)));
  return before.spells
    .filter((spell) => spell.prepared && !kept.has(entryKey(spell.ref)))
    .map((spell) => `${displayName(spell.ref)} is prepared; unprepare it to drop the pick.`);
};

const grantorDropped: Refusal = (before, after) => {
  const orphaned = lostGrantors(before, after);
  const line = (ref: EntryRef, by: Grantor) =>
    `${displayName(ref)} was picked for ${displayName(by.ref)}; remove it to drop ${displayName(by.ref)}.`;
  return [
    ...after.spells.flatMap((spell) =>
      spell.pickedFor && orphaned(spell.pickedFor) ? [line(spell.ref, spell.pickedFor)] : [],
    ),
    ...after.optionalFeatures.flatMap((pick) =>
      orphaned(pick.grantedBy) ? [line(pick.ref, pick.grantedBy)] : [],
    ),
  ];
};

/**
 * Why `after`, `before` with `level`'s choices made again, cannot be written, one line per
 * dependency, naming it: a later level in the class building on a subclass the level
 * changes, a prepared spell the level no longer picks, and a pick made for a feat or option
 * it no longer takes. A later option whose prerequisite a changed pick met is not judged,
 * since its prerequisite lives on the catalog row.
 */
export const levelChoiceRefusals: Refusal = (before, after, level) =>
  [subclassBuiltOn, preparedDropped, grantorDropped].flatMap((refusal) =>
    refusal(before, after, level),
  );
