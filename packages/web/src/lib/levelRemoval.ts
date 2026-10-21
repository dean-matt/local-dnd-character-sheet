import { type CharacterDefinition, entryKey } from "@dnd/character";
import { lostGrantors, withoutLevelChoices } from "./levelChoices.ts";
import { isPrerequisiteField } from "./multiclassPrerequisites.ts";

/**
 * `definition` without its newest level and what that level brought: the choices
 * `withoutLevelChoices` reads as its own, the optional features and spells picked for a feat
 * or an option the level took where no other copy of it stays, the departures noted on that
 * level's own fields, and every multiclass prerequisite note once one class is left.
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
  const level = definition.levels.length;
  if (level < 2) return definition;
  const without = withoutLevelChoices(definition, level);
  const orphaned = lostGrantors(definition, without);
  const own = `levels.${level - 1}.`;
  const departures = definition.departures.filter(({ field }) => !field.startsWith(own));
  const classes = new Set(without.levels.map((each) => entryKey(each.class))).size;
  return {
    ...without,
    spells: without.spells.filter((spell) => !orphaned(spell.pickedFor)),
    optionalFeatures: without.optionalFeatures.filter((pick) => !orphaned(pick.grantedBy)),
    departures:
      classes < 2 ? departures.filter(({ field }) => !isPrerequisiteField(field)) : departures,
  };
}
