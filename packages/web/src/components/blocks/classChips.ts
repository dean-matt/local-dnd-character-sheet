import {
  type CharacterDefinition,
  classLevelLabel,
  classLevels,
  type HomebrewNames,
} from "@dnd/character";

export const classChips = (definition: CharacterDefinition, names: HomebrewNames) =>
  classLevels(definition).map((group) => classLevelLabel(group, names));
