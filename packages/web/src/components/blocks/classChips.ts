import { type CharacterDefinition, classLevelLabel, classLevels } from "@dnd/character";

export const classChips = (definition: CharacterDefinition) =>
  classLevels(definition).map(classLevelLabel);
