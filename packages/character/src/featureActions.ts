import { refKey } from "./keys.ts";
import type { ContentRef } from "./refs.ts";
import type { TurnMark } from "./state.ts";

export const ACTION_TYPES = ["action", "bonus action", "reaction", "free"] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

const row = (type: ActionType, source: string, ...names: string[]): [string, ActionType][] =>
  names.map((name) => [refKey({ name, source }), type]);

/**
 * The features that take an action of their own, keyed `(name, source)`. The catalog states no
 * action type for a feature, so a feature absent here is listed nowhere on the Actions card.
 */
const FEATURE_ACTIONS: ReadonlyMap<string, ActionType> = new Map([
  ...row(
    "action",
    "PHB",
    "Channel Divinity",
    "Channel Divinity: Preserve Life",
    "Divine Sense",
    "Lay on Hands",
    "Wholeness of Body",
    "Wild Shape",
  ),
  ...row(
    "action",
    "XPHB",
    "Channel Divinity",
    "Divine Spark",
    "Land's Aid",
    "Lay on Hands",
    "Preserve Life",
    "Tireless",
  ),
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
    "Favored Enemy",
    "Flurry of Blows",
    "Font of Magic",
    "Patient Defense",
    "Rage",
    "Second Wind",
    "Step of the Wind",
    "Wholeness of Body",
    "Wild Shape",
  ),
  ...row(
    "action",
    "TCE",
    "Channel Divinity: Balm of Peace",
    "Channel Divinity: Twilight Sanctuary",
    "Hand of Healing",
    "Hand of Ultimate Mercy",
    "Quickened Healing",
    "Symbiotic Entity",
  ),
  ...row("bonus action", "XGE", "Fighting Spirit", "Mantle of Inspiration", "Unearthly Recovery"),
  ...row("reaction", "PHB", "Deflect Missiles", "Uncanny Dodge"),
  ...row("reaction", "TCE", "Soul of Artifice"),
  ...row("reaction", "XPHB", "Deflect Attacks", "Uncanny Dodge"),
  ...row("free", "PHB", "Action Surge"),
  ...row("free", "XPHB", "Action Surge", "Sacred Weapon"),
]);

/** The kind of action a feature takes, or undefined where the curated table does not list it. */
export const featureActionType = (ref: ContentRef): ActionType | undefined =>
  FEATURE_ACTIONS.get(refKey(ref));

/** The turn mark an action type spends; a free action spends none. */
export const ACTION_TURN_MARK: Record<ActionType, TurnMark | undefined> = {
  action: "action",
  "bonus action": "bonusAction",
  reaction: "reaction",
  free: undefined,
};

const POOL_ROWS: [string, string, string[]][] = [
  ["rages", "PHB", ["Rage"]],
  ["rages", "XPHB", ["Rage"]],
  ["second_wind", "XPHB", ["Second Wind"]],
  ["channel_divinity", "PHB", ["Channel Divinity", "Channel Divinity: Preserve Life"]],
  [
    "channel_divinity",
    "TCE",
    ["Channel Divinity: Balm of Peace", "Channel Divinity: Twilight Sanctuary"],
  ],
  [
    "channel_divinity",
    "XPHB",
    ["Channel Divinity", "Divine Spark", "Preserve Life", "Sacred Weapon"],
  ],
  ["wild_shape", "PHB", ["Wild Shape"]],
  ["wild_shape", "TCE", ["Symbiotic Entity"]],
  ["wild_shape", "XPHB", ["Wild Shape", "Land's Aid"]],
  ["ki_points", "PHB", ["Flurry of Blows", "Patient Defense", "Step of the Wind"]],
  ["ki_points", "TCE", ["Hand of Healing"]],
  ["focus_points", "XPHB", ["Flurry of Blows"]],
  ["favored_enemy", "XPHB", ["Favored Enemy"]],
];

const FEATURE_POOLS: ReadonlyMap<string, string> = new Map(
  POOL_ROWS.flatMap(([key, source, names]) => names.map((name) => [refKey({ name, source }), key])),
);

/**
 * The class table's `resource_key` a feature spends a use of, keyed `(name, source)`. A feature
 * absent here spends nothing from a class pool; its own limited uses, if the catalog states
 * any, are what it spends.
 */
export const featurePoolKey = (ref: ContentRef): string | undefined =>
  FEATURE_POOLS.get(refKey(ref));
