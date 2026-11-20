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
    "Combat Wild Shape",
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
  ...row("bonus action", "TCE", "Channel Divinity: Harness Divine Power"),
  ...row("bonus action", "XGE", "Fighting Spirit", "Mantle of Inspiration", "Unearthly Recovery"),
  ...row("reaction", "PHB", "Deflect Missiles", "Uncanny Dodge"),
  ...row("reaction", "TCE", "Soul of Artifice"),
  ...row("reaction", "XPHB", "Deflect Attacks", "Uncanny Dodge"),
  ...row("free", "PHB", "Action Surge"),
  ...row("free", "XPHB", "Action Surge", "Sacred Weapon"),
]);

/**
 * The kind of action a feature takes, or undefined where the curated table does not list it.
 * A feature that spends from a pool and takes no listed action is a free one.
 */
export const featureActionType = (ref: ContentRef): ActionType | undefined =>
  FEATURE_ACTIONS.get(refKey(ref)) ?? (FEATURE_COSTS.has(refKey(ref)) ? "free" : undefined);

/** The turn mark an action type spends; a free action spends none. */
export const ACTION_TURN_MARK: Record<ActionType, TurnMark | undefined> = {
  action: "action",
  "bonus action": "bonusAction",
  reaction: "reaction",
  free: undefined,
};

/**
 * What a use of a feature costs: `min` from the class pool keyed `pool`, or from the uses of the
 * feature named `feature` in the same group, which is how the Psionic Energy dice are counted.
 * A cost that varies with the use spends from `min` up to `max`, or up to what is left where
 * `max` is null.
 */
export type FeatureCost = (
  | { pool: string; feature?: undefined }
  | { feature: string; pool?: undefined }
) & { min: number; max?: number | null };

type Source = ({ pool: string } | { feature: string }) & { min?: number; max?: number | null };

/** Each row prices `names` of one `source` the same. */
const COST_ROWS: [Source, string, string[]][] = [
  [{ pool: "rages" }, "PHB", ["Rage"]],
  [{ pool: "rages" }, "XPHB", ["Rage"]],
  [{ pool: "second_wind" }, "XPHB", ["Second Wind"]],
  [{ pool: "wild_shape" }, "XPHB", ["Wild Shape", "Land's Aid"]],
  [{ pool: "focus_points" }, "XPHB", ["Flurry of Blows"]],
  [{ pool: "favored_enemy" }, "XPHB", ["Favored Enemy"]],
  [
    { pool: "channel_divinity" },
    "XPHB",
    ["Channel Divinity", "Divine Spark", "Divine Sense", "Preserve Life", "Sacred Weapon"],
  ],
  [
    { pool: "channel_divinity" },
    "PHB",
    [
      "Channel Divinity: Turn Undead",
      "Channel Divinity: Knowledge of the Ages",
      "Channel Divinity: Read Thoughts",
      "Channel Divinity: Preserve Life",
      "Channel Divinity: Radiance of the Dawn",
      "Channel Divinity: Charm Animals and Plants",
      "Channel Divinity: Destructive Wrath",
      "Channel Divinity: Invoke Duplicity",
      "Channel Divinity: Cloak of Shadows",
      "Channel Divinity: Guided Strike",
      "Channel Divinity: War God's Blessing",
      "Nature's Wrath",
      "Turn the Faithless",
      "Sacred Weapon",
      "Turn the Unholy",
      "Abjure Enemy",
      "Vow of Enmity",
    ],
  ],
  [
    { pool: "channel_divinity" },
    "TCE",
    [
      "Channel Divinity: Order's Demand",
      "Channel Divinity: Balm of Peace",
      "Channel Divinity: Twilight Sanctuary",
      "Inspiring Smite",
      "Peerless Athlete",
      "Abjure the Extraplanar",
      "Watcher's Will",
    ],
  ],
  [
    { pool: "channel_divinity" },
    "XGE",
    [
      "Channel Divinity: Artisan's Blessing",
      "Channel Divinity: Path to the Grave",
      "Conquering Presence",
      "Guided Strike",
      "Emissary of Peace",
      "Rebuke the Violent",
    ],
  ],
  [
    { pool: "ki_points" },
    "PHB",
    ["Flurry of Blows", "Patient Defense", "Step of the Wind", "Stunning Strike", "Diamond Soul"],
  ],
  [{ pool: "ki_points", min: 2 }, "PHB", ["Shadow Arts"]],
  [{ pool: "ki_points", min: 3 }, "PHB", ["Quivering Palm"]],
  [{ pool: "ki_points", min: 4, max: 8 }, "PHB", ["Empty Body"]],
  [
    { pool: "ki_points" },
    "TCE",
    ["Hand of Healing", "Hand of Harm", "Arms of the Astral Self", "Visage of the Astral Self"],
  ],
  [{ pool: "ki_points", min: 2 }, "TCE", ["Quickened Healing"]],
  [{ pool: "ki_points", min: 5 }, "TCE", ["Awakened Astral Self", "Hand of Ultimate Mercy"]],
  [{ pool: "ki_points", max: 3 }, "TCE", ["Focused Aim"]],
  [{ pool: "ki_points" }, "XGE", ["Redirect Attack", "Radiant Sun Bolt"]],
  [{ pool: "ki_points", min: 2 }, "XGE", ["Drunkard's Luck"]],
  [{ pool: "ki_points", max: 3 }, "XGE", ["Sharpen the Blade"]],
  [{ pool: "ki_points", min: 2, max: null }, "XGE", ["Searing Arc Strike"]],
  [{ pool: "ki_points" }, "PHB", ["Shape the Flowing River"]],
  [{ pool: "ki_points", max: 2 }, "PHB", ["Fangs of the Fire Snake"]],
  [
    { pool: "ki_points", min: 2 },
    "PHB",
    ["Fist of Four Thunders", "Rush of the Gale Spirits", "Sweeping Cinder Strike"],
  ],
  [{ pool: "ki_points", min: 2, max: null }, "PHB", ["Unbroken Air", "Water Whip"]],
  [{ pool: "ki_points", min: 3 }, "PHB", ["Clench of the North Wind", "Gong of the Summit"]],
  [{ pool: "ki_points", min: 4 }, "PHB", ["Flames of the Phoenix", "Mist Stance", "Ride the Wind"]],
  [{ pool: "ki_points", min: 5 }, "PHB", ["Eternal Mountain Defense", "River of Hungry Flame"]],
  [{ pool: "ki_points", min: 6 }, "PHB", ["Breath of Winter", "Wave of Rolling Earth"]],
  [
    { pool: "sorcery_points" },
    "PHB",
    [
      "Careful Spell",
      "Distant Spell",
      "Empowered Spell",
      "Extended Spell",
      "Subtle Spell",
      "Elemental Affinity",
    ],
  ],
  [{ pool: "sorcery_points", min: 2 }, "PHB", ["Quickened Spell", "Bend Luck"]],
  [{ pool: "sorcery_points", min: 3 }, "PHB", ["Heightened Spell"]],
  [{ pool: "sorcery_points", min: 5 }, "PHB", ["Draconic Presence"]],
  [{ pool: "sorcery_points", max: 9 }, "PHB", ["Twinned Spell"]],
  [{ pool: "sorcery_points" }, "TCE", ["Transmuted Spell", "Magical Guidance"]],
  [{ pool: "sorcery_points", min: 2 }, "TCE", ["Seeking Spell"]],
  [{ pool: "sorcery_points", max: 5 }, "TCE", ["Bastion of Law"]],
  [{ pool: "sorcery_points", max: null }, "TCE", ["Revelation in Flesh"]],
  [{ pool: "sorcery_points" }, "XGE", ["Empowered Healing"]],
  [{ pool: "sorcery_points", min: 3 }, "XGE", ["Hound of Ill Omen"]],
  [{ pool: "sorcery_points", min: 6 }, "XGE", ["Umbral Form"]],
  [
    { pool: "superiority_dice" },
    "PHB",
    [
      "Commander's Strike",
      "Disarming Attack",
      "Distracting Strike",
      "Evasive Footwork",
      "Feinting Attack",
      "Goading Attack",
      "Lunging Attack",
      "Maneuvering Attack",
      "Menacing Attack",
      "Parry",
      "Precision Attack",
      "Pushing Attack",
      "Rally",
      "Riposte",
      "Sweeping Attack",
      "Trip Attack",
    ],
  ],
  [
    { pool: "superiority_dice" },
    "TCE",
    [
      "Ambush",
      "Bait and Switch",
      "Brace",
      "Commanding Presence",
      "Grappling Strike",
      "Quick Toss",
      "Tactical Assessment",
    ],
  ],
  [
    { feature: "Psionic Power" },
    "TCE",
    [
      "Protective Field",
      "Psionic Strike",
      "Psi-Bolstered Knack",
      "Guarded Mind",
      "Homing Strikes",
      "Psychic Teleportation",
    ],
  ],
];

/**
 * The features whose pool cost the sheet leaves to the player, each checked against its text:
 * a cost that only restores a use or rides on an option, or one a conversion spends.
 */
const COST_NOTES: [string, string[]][] = [
  ["PHB", ["Deflect Missiles", "Disciple of the Elements"]],
  [
    "TCE",
    [
      "Ki-Fueled Attack",
      "Flurry of Healing and Harm",
      "Psionic Sorcery",
      "Channel Divinity: Harness Divine Power",
      "Telekinetic Movement",
      "Psi-Powered Leap",
      "Bulwark of Force",
      "Telekinetic Master",
      "Psychic Veil",
      "Rend Mind",
      "Warping Implosion",
      "Trance of Order",
      "Clockwork Cavalcade",
    ],
  ],
  ["XGE", ["One with the Blade", "Searing Sunburst"]],
];

/** Every feature the curated table prices, beside its cost. */
export const FEATURE_COST_ENTRIES: readonly { ref: ContentRef; cost: FeatureCost }[] =
  COST_ROWS.flatMap(([cost, source, names]) =>
    names.map((name) => ({
      ref: { name, source },
      cost: { ...cost, min: cost.min ?? 1 } as FeatureCost,
    })),
  );

const FEATURE_COSTS: ReadonlyMap<string, FeatureCost> = new Map(
  FEATURE_COST_ENTRIES.map(({ ref, cost }) => [refKey(ref), cost]),
);

const COST_NOTED: ReadonlySet<string> = new Set(
  COST_NOTES.flatMap(([source, names]) => names.map((name) => refKey({ name, source }))),
);

/** What a use of the feature costs, keyed `(name, source)`, or undefined where the table prices none. */
export const featureCost = (ref: ContentRef): FeatureCost | undefined =>
  FEATURE_COSTS.get(refKey(ref));

/** Whether the table prices the feature or records that its cost is the player's to spend. */
export const featureCostRecorded = (ref: ContentRef): boolean =>
  FEATURE_COSTS.has(refKey(ref)) || COST_NOTED.has(refKey(ref));

/**
 * The class table's `resource_key` a feature spends from, keyed `(name, source)`. A feature
 * absent here spends no class pool; its own limited uses, if the catalog states any, are
 * what it spends.
 */
export const featurePoolKey = (ref: ContentRef): string | undefined => featureCost(ref)?.pool;
