import { refKey } from "./keys.ts";
import type { ContentRef } from "./refs.ts";

export const ACTION_TYPES = ["action", "bonus action", "reaction", "free"] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

const row = (type: ActionType, source: string, ...names: string[]): [string, ActionType][] =>
  names.map((name) => [refKey({ name, source }), type]);

/**
 * The features that take an action of their own, keyed `(name, source)`. The catalog states no
 * action type for a feature, so a feature absent here is listed nowhere on the Actions card.
 */
const FEATURE_ACTIONS: ReadonlyMap<string, ActionType> = new Map([
  ...row("action", "PHB", "Channel Divinity", "Divine Sense", "Lay on Hands", "Wild Shape"),
  ...row("action", "XPHB", "Channel Divinity", "Lay on Hands"),
  ...row(
    "bonus action",
    "PHB",
    "Bardic Inspiration",
    "Cunning Action",
    "Flurry of Blows",
    "Font of Magic",
    "Patient Defense",
    "Rage",
    "Second Wind",
    "Step of the Wind",
  ),
  ...row(
    "bonus action",
    "XPHB",
    "Bardic Inspiration",
    "Bonus Unarmed Strike",
    "Cunning Action",
    "Divine Sense",
    "Flurry of Blows",
    "Font of Magic",
    "Patient Defense",
    "Rage",
    "Second Wind",
    "Step of the Wind",
    "Wild Shape",
  ),
  ...row("reaction", "PHB", "Deflect Missiles", "Uncanny Dodge"),
  ...row("reaction", "XPHB", "Deflect Attacks", "Uncanny Dodge"),
  ...row("free", "PHB", "Action Surge"),
  ...row("free", "XPHB", "Action Surge"),
]);

/** The kind of action a feature takes, or undefined where the curated table does not list it. */
export const featureActionType = (ref: ContentRef): ActionType | undefined =>
  FEATURE_ACTIONS.get(refKey(ref));
