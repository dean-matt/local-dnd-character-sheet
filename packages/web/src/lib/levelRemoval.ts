import { type CharacterDefinition, type EntryRef, entryKey, type FeatureKey } from "@dnd/character";
import { isPrerequisiteField } from "./multiclassPrerequisites.ts";

type Grantor = { kind: string; ref: EntryRef };

/**
 * `definition` without its newest level and what that level brought, matched by what each
 * record states:
 *
 * - the feats and ability increases whose `level` is that character level, the improvement
 *   among them;
 * - the spells it was `pickedAt` and the optional features whose `level` it is;
 * - the optional features and spells picked for a feat or an option the level took, where
 *   no other copy of it stays;
 * - the feature choices keyed on its class at the class level it reached, and on its
 *   subclass's earlier levels too where the level chose the subclass;
 * - the departures noted on that level's own fields, and every multiclass prerequisite
 *   note once one class is left.
 *
 * Any other pick made outside a level-up states no level and stays, as do the proficiencies
 * a class's multiclass entry granted, which record no grantor, and the experience total.
 * A definition of one level is returned as it is.
 *
 * A choice stored for a subclass the class no longer holds goes with a level that chose the
 * subclass, since a key names the subclass by a short name no level records. Reading the
 * subclass row's short name before removing is the way out.
 */
export function withoutNewestLevel(definition: CharacterDefinition): CharacterDefinition {
  const { levels } = definition;
  const level = levels.length;
  const removed = levels.at(-1);
  if (level < 2 || !removed) return definition;
  const kept = levels.slice(0, -1);
  const cls = removed.class;
  const classLevel = levels.filter((each) => entryKey(each.class) === entryKey(cls)).length;
  const broughtBy = (feature: FeatureKey) =>
    "name" in cls &&
    feature.className === cls.name &&
    feature.classSource === cls.source &&
    (feature.level === classLevel ||
      (feature.subclass !== undefined &&
        removed.subclass !== undefined &&
        feature.level < classLevel));

  const feats = definition.feats.filter((feat) => feat.level !== level);
  const options = definition.optionalFeatures.filter((pick) => pick.level !== level);
  const gone = (kind: string, before: { ref: EntryRef }[], after: { ref: EntryRef }[]) => {
    const held = new Set(after.map((each) => entryKey(each.ref)));
    return before
      .filter((each) => !held.has(entryKey(each.ref)))
      .map((each) => `${kind}|${entryKey(each.ref)}`);
  };
  const lost = new Set([
    ...gone("feat", definition.feats, feats),
    ...gone("optionalFeature", definition.optionalFeatures, options),
  ]);
  const orphaned = (grantor: Grantor | undefined) =>
    grantor !== undefined && lost.has(`${grantor.kind}|${entryKey(grantor.ref)}`);

  const own = `levels.${level - 1}.`;
  const departures = definition.departures.filter(({ field }) => !field.startsWith(own));
  const classes = new Set(kept.map((each) => entryKey(each.class))).size;
  return {
    ...definition,
    levels: kept,
    feats,
    abilityIncreases: definition.abilityIncreases.filter((increase) => increase.level !== level),
    featureChoices: definition.featureChoices.filter((choice) => !broughtBy(choice.feature)),
    spells: definition.spells.filter(
      (spell) => spell.pickedAt !== level && !orphaned(spell.pickedFor),
    ),
    optionalFeatures: options.filter((pick) => !orphaned(pick.grantedBy)),
    departures:
      classes < 2 ? departures.filter(({ field }) => !isPrerequisiteField(field)) : departures,
  };
}
