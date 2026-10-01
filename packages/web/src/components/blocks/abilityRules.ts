import type { CharacterDefinition } from "@dnd/character";

/** The catalog row a modal reads its rules text from. */
export interface Rules {
  tag: string;
  name: string;
  source: string;
}

/**
 * An ability and a save have no row of their own, so they read the 2024 rule that covers
 * them. The 2014 rules print no such row, so a classic character gets no rules text here.
 */
export const ABILITY_RULES: Rules = {
  tag: "variantrule",
  name: "Ability Score and Modifier",
  source: "XPHB",
};
export const SAVE_RULES: Rules = { tag: "variantrule", name: "Saving Throw", source: "XPHB" };

export const editionRules = (definition: CharacterDefinition, rules: Rules) =>
  definition.edition === "one" ? rules : undefined;
