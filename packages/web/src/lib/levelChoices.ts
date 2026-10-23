/**
 * The choices one character level's level-up made, read by what each record states: the
 * feats and ability increases whose `level` it is, the improvement among them; the spells it
 * was `pickedAt` and the optional features whose `level` it is; the feature choices keyed on
 * its class at the class level it reached, and on its subclass's earlier levels too where the
 * level chose the subclass.
 */
import { type FeatRecord, featTermsSchema, type OptionalFeaturePrerequisite } from "@dnd/catalog";
import {
  abilityScore,
  type CharacterDefinition,
  displayName,
  type EntryRef,
  entryKey,
  type FeatureKey,
  refKey,
} from "@dnd/character";
import { candidateAt } from "./improvementFeats.ts";
import {
  isPrerequisiteField,
  meetsPrerequisite,
  prerequisiteText,
  withPrerequisiteDepartures,
} from "./multiclassPrerequisites.ts";
import { prerequisiteFacts, prerequisiteNotes } from "./optionalFeaturePrerequisites.ts";

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

/**
 * A later level in the old starting class or the new one, whose class level the change would
 * shift: the old class's would start over as a multiclass entry, and the new class's would
 * take a second first level.
 */
const startingClassBuiltOn: Refusal = (before, after, level) => {
  const was = before.levels[0]?.class;
  const now = after.levels[0]?.class;
  if (level !== 1 || !was || !now || entryKey(was) === entryKey(now)) return [];
  const shared = new Set([entryKey(was), entryKey(now)]);
  const later = before.levels.flatMap((each, index) =>
    index > 0 && shared.has(entryKey(each.class)) ? [String(index + 1)] : [],
  );
  if (later.length === 0) return [];
  const many = later.length > 1;
  return [
    `${many ? "Levels" : "Level"} ${listed(later)} ${many ? "take" : "takes"} ${displayName(was)} or ${displayName(now)}; remove ${many ? "them" : "it"} to change the starting class.`,
  ];
};

/** What the level at `index` holds that rests on its class level, which the class change shifts. */
function restingOnClassLevel(definition: CharacterDefinition, index: number) {
  const { class: cls, subclass } = definition.levels[index] ?? {};
  if (!cls) return [];
  const level = index + 1;
  const classLevel = definition.levels
    .slice(0, level)
    .filter((each) => entryKey(each.class) === entryKey(cls)).length;
  return [
    subclass && "a subclass",
    (definition.feats.some((feat) => feat.level === level) ||
      definition.abilityIncreases.some((increase) => increase.level === level)) &&
      "an improvement",
    "name" in cls &&
      definition.featureChoices.some(
        ({ feature }) =>
          feature.className === cls.name &&
          feature.classSource === cls.source &&
          feature.level === classLevel,
      ) &&
      "a feature choice",
    definition.spells.some((spell) => spell.pickedAt === level) && "a spell pick",
    definition.optionalFeatures.some((pick) => pick.level === level) && "an option pick",
  ].filter((each) => typeof each === "string");
}

/**
 * A later level in the old class or the new one that holds a subclass, improvement, feature
 * choice, spell pick or option pick: each rests on the class level the level takes, which the
 * change shifts by one. A later level holding none has nothing to leave behind.
 */
const classLevelBuiltOn: Refusal = (before, after, level) => {
  const was = before.levels[level - 1]?.class;
  const now = after.levels[level - 1]?.class;
  if (level === 1 || !was || !now || entryKey(was) === entryKey(now)) return [];
  const shared = new Set([entryKey(was), entryKey(now)]);
  return before.levels.flatMap((each, index) => {
    const rests =
      index >= level && shared.has(entryKey(each.class)) ? restingOnClassLevel(before, index) : [];
    return rests.length === 0
      ? []
      : [
          `Level ${index + 1} takes ${displayName(each.class)} and holds ${listed(rests)}; remove it to change level ${level}'s class.`,
        ];
  });
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

/** The catalog rows a later pick's prerequisite lives on: each held option's, by `entryKey`, and the feats. */
export type PrerequisiteRows = {
  options: ReadonlyMap<string, readonly OptionalFeaturePrerequisite[]>;
  feats: readonly FeatRecord[];
};

const optionShort =
  (rows: PrerequisiteRows): Refusal =>
  (before, after) => {
    const was = prerequisiteFacts(before);
    const now = prerequisiteFacts(after);
    const held = new Set(before.optionalFeatures.map((pick) => entryKey(pick.ref)));
    return after.optionalFeatures.flatMap((pick) => {
      const needs = rows.options.get(entryKey(pick.ref));
      if (!needs || !held.has(entryKey(pick.ref)) || prerequisiteNotes(needs, was).needs) return [];
      const missing = prerequisiteNotes(needs, now).needs;
      return missing
        ? [
            `${displayName(pick.ref)}, picked at level ${pick.level}, needs ${missing}; remove it to make this change.`,
          ]
        : [];
    });
  };

const featShort =
  (rows: PrerequisiteRows): Refusal =>
  (before, after, level) =>
    after.feats.flatMap(({ ref, level: at }) => {
      const row = rows.feats.find((feat) => entryKey(feat) === entryKey(ref));
      if (at === undefined || at === level || !row) return [];
      const { prerequisites } = featTermsSchema.parse(row.json);
      const needs = prerequisites.flatMap((part) => part.scores);
      const met = (definition: CharacterDefinition) => {
        const scores = candidateAt(definition, { level: at, features: [] }).scores;
        return (
          scores === undefined ||
          prerequisites.some((part) => meetsPrerequisite(part.scores, (ability) => scores[ability]))
        );
      };
      return needs.length > 0 && met(before) && !met(after)
        ? [
            `${displayName(ref)}, taken at level ${at}, needs ${prerequisiteText(needs)}; remove it to make this change.`,
          ]
        : [];
    });

/**
 * Why `after`, `before` with `level`'s choices made again, cannot be written, one line per
 * dependency, naming it: a later level in the class building on a subclass the level
 * changes, a later level in the class level 1 gives up or in the one it takes up, a later
 * level in the class a later level gives up or takes up whose picks rest on its class level, a prepared
 * spell the level no longer picks, a pick made for a feat or option it no longer takes, an
 * option whose prerequisite the level's picks met, and a feat from
 * another level whose ability prerequisite the level's increases met. A prerequisite met
 * before the change and unmet after it refuses; one unmet already is the user's to keep.
 */
export const levelChoiceRefusals = (
  before: CharacterDefinition,
  after: CharacterDefinition,
  level: number,
  rows: PrerequisiteRows,
) =>
  [
    subclassBuiltOn,
    startingClassBuiltOn,
    classLevelBuiltOn,
    preparedDropped,
    grantorDropped,
    optionShort(rows),
    featShort(rows),
  ].flatMap((refusal) => refusal(before, after, level));

/**
 * `after`'s departures with every multiclass prerequisite its scores leave unmet noted, as the
 * level-up notes one: recorded, never refused. `added` names each note `before` lacked.
 */
export function levelChoiceDepartures(
  before: CharacterDefinition,
  after: CharacterDefinition,
  classes: Parameters<typeof withPrerequisiteDepartures>[1],
) {
  const departures = withPrerequisiteDepartures(after.departures, classes, (ability) =>
    abilityScore(after, ability),
  );
  const noted = new Set(before.departures.map((each) => each.note));
  return {
    departures,
    added: departures
      .filter((each) => isPrerequisiteField(each.field) && !noted.has(each.note))
      .map((each) => each.note),
  };
}
