import { type CharacterDefinition, entryKey, type FeatureKey } from "@dnd/character";
import { withPrerequisiteDepartures } from "./multiclassPrerequisites.ts";

/**
 * `definition` without its newest level and what that level brought, matched by what each
 * record states:
 *
 * - the feats and ability increases whose `level` is that character level, the improvement
 *   among them;
 * - the spells it was `pickedAt` and the optional features whose `level` it is;
 * - the feature choices keyed on its class at the class level it reached, and on its
 *   subclass's earlier levels too where the level chose the subclass;
 * - the departures noted on that level's own fields, and every multiclass prerequisite
 *   note once one class is left.
 *
 * A pick made outside a level-up states no level and stays, as do the proficiencies a
 * class's multiclass entry granted, which record no grantor, and the experience total.
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
  const own = `levels.${level - 1}.`;
  const departures = definition.departures.filter(({ field }) => !field.startsWith(own));
  const classes = new Set(kept.map((each) => entryKey(each.class))).size;
  return {
    ...definition,
    levels: kept,
    feats: definition.feats.filter((feat) => feat.level !== level),
    abilityIncreases: definition.abilityIncreases.filter((increase) => increase.level !== level),
    featureChoices: definition.featureChoices.filter((choice) => !broughtBy(choice.feature)),
    spells: definition.spells.filter((spell) => spell.pickedAt !== level),
    optionalFeatures: definition.optionalFeatures.filter((pick) => pick.level !== level),
    departures: classes < 2 ? withPrerequisiteDepartures(departures, [], undefined) : departures,
  };
}
