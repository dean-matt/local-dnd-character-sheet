import type { CharacterDefinition } from "@dnd/character";

export type ActionType = "action" | "bonus action" | "reaction" | "free";

export const ACTION_TYPES: readonly ActionType[] = ["action", "bonus action", "reaction", "free"];

/** A standard action's catalog row in `actions.json` and the kind of action it takes. */
export interface StandardAction {
  name: string;
  source: string;
  type: ActionType;
}

const row = (type: ActionType, source: string, ...names: string[]): StandardAction[] =>
  names.map((name) => ({ name, source, type }));

/** The actions each edition's rules print for every creature, as the catalog's rows name them. */
export const STANDARD_ACTIONS: Record<CharacterDefinition["edition"], readonly StandardAction[]> = {
  classic: [
    ...row(
      "action",
      "PHB",
      "Attack",
      "Dash",
      "Disengage",
      "Dodge",
      "Help",
      "Hide",
      "Ready",
      "Search",
      "Use an Object",
    ),
    ...row("bonus action", "PHB", "Two-Weapon Fighting"),
    ...row("reaction", "PHB", "Opportunity Attack"),
    ...row("free", "PHB", "End Concentration"),
  ],
  one: [
    ...row(
      "action",
      "XPHB",
      "Attack",
      "Dash",
      "Disengage",
      "Dodge",
      "Help",
      "Hide",
      "Influence",
      "Magic",
      "Ready",
      "Search",
      "Study",
      "Utilize",
    ),
    ...row("bonus action", "XPHB", "Two-Weapon Fighting"),
    ...row("reaction", "XPHB", "Opportunity Attack"),
    ...row("free", "XPHB", "End Concentration"),
  ],
};
