import type { FeatureMechanics, Mechanic } from "./featureMechanics.ts";
import type { FeatureKey } from "./refs.ts";

const subclassFeature = (
  [className, classSource]: [string, string],
  [shortName, source]: [string, string],
  [name, featureSource]: [string, string],
  level: number,
  mechanics: Mechanic[],
): FeatureMechanics => ({
  ref: {
    name,
    source: featureSource,
    className,
    classSource,
    subclass: { shortName, source },
    level,
  } satisfies FeatureKey,
  mechanics,
});

const classFeature = (
  [className, classSource]: [string, string],
  [name, source]: [string, string],
  level: number,
  mechanics: Mechanic[],
): FeatureMechanics => ({
  ref: { name, source, className, classSource, level } satisfies FeatureKey,
  mechanics,
});

const bard: [string, string] = ["Bard", "PHB"];
const rogue: [string, string] = ["Rogue", "PHB"];
const fighter: [string, string] = ["Fighter", "PHB"];
const cleric: [string, string] = ["Cleric", "PHB"];
const warlock: [string, string] = ["Warlock", "PHB"];
const artificer: [string, string] = ["Artificer", "TCE"];
const DAMAGE_TYPES_BUT_PSYCHIC = [
  "acid",
  "bludgeoning",
  "cold",
  "fire",
  "force",
  "lightning",
  "necrotic",
  "piercing",
  "poison",
  "radiant",
  "slashing",
  "thunder",
];
const expertiseIn = (count: number): Mechanic[] => [{ kind: "pick", fields: ["expertise"], count }];
const skillsOf = (count: number, from?: string[], expertise?: true): Mechanic => ({
  kind: "pick",
  fields: ["skills"],
  count,
  ...(from && { from }),
  ...(expertise && { expertise }),
});
const grants = (grant: Omit<Extract<Mechanic, { kind: "proficiency" }>, "kind">): Mechanic[] => [
  { kind: "proficiency", ...grant },
];
const narrative = (ref: FeatureMechanics["ref"]): FeatureMechanics => ({ ref, narrative: true });
const barbarian: [string, string] = ["Barbarian", "PHB"];
const barbarian24: [string, string] = ["Barbarian", "XPHB"];
const fighter24: [string, string] = ["Fighter", "XPHB"];
const paladin: [string, string] = ["Paladin", "PHB"];
const paladin24: [string, string] = ["Paladin", "XPHB"];
const ranger: [string, string] = ["Ranger", "PHB"];
const ALL_SAVES = grants({ savingThrows: ["str", "dex", "con", "int", "wis", "cha"] });
const raging: Mechanic[] = [
  { kind: "roll", roll: "check", abilities: ["str"], advantage: true, while: "raging" },
  { kind: "roll", roll: "save", abilities: ["str"], advantage: true, while: "raging" },
  { kind: "defense", resist: ["bludgeoning", "piercing", "slashing"], while: "raging" },
];
const saveAdvantage = (against?: string): Mechanic => ({
  kind: "roll",
  roll: "save",
  advantage: true,
  ...(against && { against }),
});
const CHARMED_OR_FRIGHTENED = "against being charmed or frightened";
const critical = (value: number): Mechanic[] => [{ kind: "attack", critical: value }];
const POWER_ATTACK = "chosen before the attack; the damage lands on a hit";
const ON_A_HIT = "on a weapon hit";
const SUPERIORITY_DIE = "expending a superiority die on a maneuver that adds it to the damage";
const rogue24: [string, string] = ["Rogue", "XPHB"];
const cleric24: [string, string] = ["Cleric", "XPHB"];
const druid24: [string, string] = ["Druid", "XPHB"];
const monk: [string, string] = ["Monk", "PHB"];
const monk24: [string, string] = ["Monk", "XPHB"];
const ranger24: [string, string] = ["Ranger", "XPHB"];
const druid: [string, string] = ["Druid", "PHB"];
const sorcerer: [string, string] = ["Sorcerer", "PHB"];
const wizard: [string, string] = ["Wizard", "PHB"];
const INDOMITABLE_USES: Mechanic = {
  kind: "uses",
  count: 1,
  reset: "long",
  scales: [
    { level: 13, count: 2 },
    { level: 17, count: 3 },
  ],
};
const PROFICIENCY_USES: Mechanic = { kind: "uses", count: "proficiency", reset: "long" };
const sneakAttack = (option: string): Mechanic[] => [
  {
    kind: "extraDamage",
    dice: { column: "sneak_attack" },
    weapons: "finesseOrRanged",
    oncePerTurn: true,
    option,
  },
];

const ALL_BUT_FORCE = [...DAMAGE_TYPES_BUT_PSYCHIC.filter((type) => type !== "force"), "psychic"];
const sorcerer24: [string, string] = ["Sorcerer", "XPHB"];
const SACRED_WEAPON = "with the weapon Sacred Weapon imbues";

/**
 * Effects the player starts and ends, and what holds while each runs. A cost the start spends
 * past one use of the feature or its pool is the player's to spend.
 */
const ONGOING_EFFECTS: FeatureMechanics[] = [
  classFeature(paladin24, ["Divine Sense", "XPHB"], 3, [
    { kind: "active", endsOn: ["incapacitated"] },
  ]),
  subclassFeature(paladin, ["Devotion", "PHB"], ["Sacred Weapon", "PHB"], 3, [
    { kind: "active", endsOn: ["incapacitated"] },
    { kind: "attack", attack: "cha", option: SACRED_WEAPON, while: "active" },
  ]),
  subclassFeature(paladin24, ["Devotion", "XPHB"], ["Sacred Weapon", "XPHB"], 3, [
    { kind: "active" },
    { kind: "attack", attack: "cha", option: SACRED_WEAPON, while: "active" },
  ]),
  subclassFeature(paladin, ["Vengeance", "PHB"], ["Vow of Enmity", "PHB"], 3, [
    { kind: "active" },
    {
      kind: "attack",
      advantage: true,
      option: "against the creature vowed against",
      while: "active",
    },
  ]),
  classFeature(monk, ["Empty Body", "PHB"], 18, [
    { kind: "active" },
    { kind: "defense", resist: ALL_BUT_FORCE, while: "active" },
  ]),
  classFeature(monk24, ["Superior Defense", "XPHB"], 18, [
    { kind: "active", endsOn: ["incapacitated"] },
    { kind: "defense", resist: ALL_BUT_FORCE, while: "active" },
  ]),
  classFeature(sorcerer24, ["Innate Sorcery", "XPHB"], 1, [{ kind: "active" }]),
  subclassFeature(sorcerer, ["Draconic", "PHB"], ["Dragon Wings", "PHB"], 14, [
    { kind: "active" },
    { kind: "speed", equalToWalk: ["fly"], while: "active" },
  ]),
  subclassFeature(sorcerer24, ["Draconic", "XPHB"], ["Dragon Wings", "XPHB"], 14, [
    { kind: "active" },
    { kind: "speed", fly: 60, while: "active" },
  ]),
  subclassFeature(["Wizard", "PHB"], ["Bladesinging", "TCE"], ["Bladesong", "TCE"], 2, [
    { kind: "uses", count: "proficiency", reset: "long" },
    { kind: "active", endsOn: ["incapacitated", "medium", "heavy", "shield"] },
    { kind: "armorClass", value: "int", while: "active" },
    { kind: "speed", bonus: 10, while: "active" },
    { kind: "roll", roll: "check", skills: ["acrobatics"], advantage: true, while: "active" },
    {
      kind: "roll",
      roll: "save",
      abilities: ["con"],
      bonus: "int",
      against: "to maintain concentration",
      while: "active",
    },
  ]),
  // Persistent Rage restores uses on initiative; Elemental Affinity's resistance follows the
  // ancestry the sheet does not hold; the others lay an area or spend a spell slot.
  narrative({
    name: "Persistent Rage",
    source: "XPHB",
    className: "Barbarian",
    classSource: "XPHB",
    level: 15,
  }),
  narrative({
    name: "Primeval Awareness",
    source: "PHB",
    className: "Ranger",
    classSource: "PHB",
    level: 3,
  }),
  narrative({
    name: "Elemental Affinity",
    source: "PHB",
    className: "Sorcerer",
    classSource: "PHB",
    subclass: { shortName: "Draconic", source: "PHB" },
    level: 6,
  }),
  narrative({
    name: "Nature's Sanctuary",
    source: "XPHB",
    className: "Druid",
    classSource: "XPHB",
    subclass: { shortName: "Land", source: "XPHB" },
    level: 14,
  }),
];

/**
 * Uses whose count the content build cannot read from the text: tied to a modifier, raised
 * at a level, or one limit among several parts.
 */
const LIMITED_USES: FeatureMechanics[] = [
  ...(["PHB", "XPHB"] as const).map((source) =>
    classFeature(["Fighter", source], ["Action Surge", source], 2, [
      { kind: "uses", count: 1, reset: "short", scales: [{ level: 17, count: 2 }] },
    ]),
  ),
  // Font of Inspiration is the short-rest reset scaled on Bardic Inspiration.
  ...(["PHB", "XPHB"] as const).flatMap((source) => [
    classFeature(["Bard", source], ["Bardic Inspiration", source], 1, [
      { kind: "uses", count: "cha", reset: "long", scales: [{ level: 5, reset: "short" }] },
    ]),
    narrative({
      name: "Font of Inspiration",
      source,
      className: "Bard",
      classSource: source,
      level: 5,
    }),
  ]),
  classFeature(paladin, ["Divine Sense", "PHB"], 1, [
    { kind: "uses", count: "cha", plus: 1, minimum: 0, reset: "long" },
    { kind: "active" },
  ]),
  classFeature(paladin, ["Cleansing Touch", "PHB"], 14, [
    { kind: "uses", count: "cha", reset: "long" },
  ]),
  classFeature(ranger24, ["Nature's Veil", "XPHB"], 14, [
    { kind: "uses", count: "wis", reset: "long" },
  ]),
  subclassFeature(["Warlock", "XPHB"], ["Fiend", "XPHB"], ["Dark One's Own Luck", "XPHB"], 6, [
    { kind: "uses", count: "cha", reset: "long" },
  ]),
  subclassFeature(cleric, ["Light", "PHB"], ["Warding Flare", "PHB"], 1, [
    { kind: "uses", count: "wis", reset: "long" },
  ]),
  subclassFeature(["Wizard", "PHB"], ["Divination", "PHB"], ["Portent", "PHB"], 2, [
    { kind: "uses", count: 2, reset: "long", scales: [{ level: 14, count: 3 }] },
  ]),
  { ref: { name: "Lucky", source: "PHB" }, mechanics: [{ kind: "uses", count: 3, reset: "long" }] },
  // Nature Magician is the part a long rest limits.
  classFeature(druid24, ["Archdruid", "XPHB"], 20, [{ kind: "uses", count: 1, reset: "long" }]),
  classFeature(["Warlock", "XPHB"], ["Contact Patron", "XPHB"], 9, [
    { kind: "uses", count: 1, reset: "long" },
  ]),
  // Rolling initiative also restores it.
  {
    ref: { name: "Boon of Fate", source: "XPHB" },
    mechanics: [{ kind: "uses", count: 1, reset: "short" }],
  },
  // The level 2 row counts the use this repeat adds.
  narrative({
    name: "Action Surge",
    source: "XPHB",
    className: "Fighter",
    classSource: "XPHB",
    level: 17,
  }),
  // Portent's row counts the roll this adds.
  narrative({
    name: "Greater Portent",
    source: "PHB",
    className: "Wizard",
    classSource: "PHB",
    subclass: { shortName: "Divination", source: "PHB" },
    level: 14,
  }),
  // Each restores or locks a count on something other than one rest: initiative, 7 days after a
  // success, or 2d4 long rests.
  narrative({
    name: "Superior Inspiration",
    source: "XPHB",
    className: "Bard",
    classSource: "XPHB",
    level: 18,
  }),
  narrative({
    name: "Divine Intervention",
    source: "PHB",
    className: "Cleric",
    classSource: "PHB",
    level: 10,
  }),
  narrative({
    name: "Greater Divine Intervention",
    source: "XPHB",
    className: "Cleric",
    classSource: "XPHB",
    level: 20,
  }),
  // Each spell is cast free once, a count per spell rather than one for the feature.
  ...(["PHB", "XPHB"] as const).map((source) =>
    narrative({
      name: "Signature Spells",
      source,
      className: "Wizard",
      classSource: source,
      level: 20,
    }),
  ),
  // A later use costs damage rather than waiting on a rest.
  narrative({
    name: "Overchannel",
    source: "PHB",
    className: "Wizard",
    classSource: "PHB",
    subclass: { shortName: "Evocation", source: "PHB" },
    level: 14,
  }),
  narrative({
    name: "Overchannel",
    source: "XPHB",
    className: "Wizard",
    classSource: "XPHB",
    subclass: { shortName: "Evoker", source: "XPHB" },
    level: 14,
  }),
  // Peerless Aim's limit is a turn, and the pact weapon's is one at a time.
  narrative({ name: "Boon of Combat Prowess", source: "XPHB" }),
  narrative({ name: "Pact of the Blade", source: "PHB" }),
  // Accursed Specter, Call the Hunt, Cauterizing Flames, Defensive Field and Restorative
  // Reagents give hit points or temporary hit points no heal or tempHp term records yet, so
  // they count their uses alone.
  ...(
    [
      [artificer, "Restorative Reagents", ["Alchemist", "TCE"], "TCE", 9, "int"],
      [artificer, "Defensive Field", ["Armorer", "TCE"], "TCE", 3, "proficiency"],
      [artificer, "Guardian", ["Armorer", "TCE"], "TCE", 15, "proficiency"],
      [barbarian, "Magic Awareness", ["Wild Magic", "TCE"], "TCE", 3, "proficiency"],
      [barbarian, "Bolstering Magic", ["Wild Magic", "TCE"], "TCE", 6, "proficiency"],
      [barbarian, "Infectious Fury", ["Beast", "TCE"], "TCE", 10, "proficiency"],
      [barbarian, "Call the Hunt", ["Beast", "TCE"], "TCE", 14, "proficiency"],
      [bard, "Infectious Inspiration", ["Eloquence", "TCE"], "TCE", 14, "cha"],
      [cleric, "Eyes of the Grave", ["Grave", "XGE"], "XGE", 1, "wis"],
      [cleric, "Sentinel at Death's Door", ["Grave", "XGE"], "XGE", 6, "wis"],
      [cleric, "Embodiment of the Law", ["Order", "TCE"], "TCE", 6, "wis"],
      [cleric, "Emboldening Bond", ["Peace", "TCE"], "TCE", 1, "proficiency"],
      [cleric, "Wrath of the Storm", ["Tempest", "PHB"], "PHB", 1, "wis"],
      [cleric, "Steps of Night", ["Twilight", "TCE"], "TCE", 6, "proficiency"],
      [cleric, "War Priest", ["War", "PHB"], "PHB", 1, "wis"],
      [druid, "Hidden Paths", ["Dreams", "XGE"], "XGE", 10, "wis"],
      [druid, "Fungal Infestation", ["Spores", "TCE"], "TCE", 6, "wis"],
      [druid, "Star Map", ["Stars", "TCE"], "TCE", 2, "proficiency"],
      [druid, "Cosmic Omen", ["Stars", "TCE"], "TCE", 6, "proficiency"],
      [druid, "Cauterizing Flames", ["Wildfire", "TCE"], "TCE", 10, "proficiency"],
      [fighter, "Warding Maneuver", ["Cavalier", "XGE"], "XGE", 7, "con"],
      [fighter, "Runic Shield", ["Rune Knight", "TCE"], "TCE", 7, "proficiency"],
      [paladin, "Glorious Defense", ["Glory", "TCE"], "TCE", 15, "cha"],
      [ranger, "Fey Reinforcements", ["Fey Wanderer", "TCE"], "TCE", 11, 1],
      [ranger, "Misty Wanderer", ["Fey Wanderer", "TCE"], "TCE", 15, "wis"],
      [ranger, "Hunter's Sense", ["Monster Slayer", "XGE"], "XGE", 3, "wis"],
      [ranger, "Writhing Tide", ["Swarmkeeper", "TCE"], "TCE", 7, "proficiency"],
      [ranger, "Swarming Dispersal", ["Swarmkeeper", "TCE"], "TCE", 15, "proficiency"],
      [rogue, "Unerring Eye", ["Inquisitive", "XGE"], "XGE", 13, "wis"],
      [rogue, "Wails from the Grave", ["Phantom", "TCE"], "TCE", 3, "proficiency"],
      // Destroying a soul trinket also restores it.
      [rogue, "Ghost Walk", ["Phantom", "TCE"], "TCE", 13, 1],
      [sorcerer, "Restore Balance", ["Clockwork Soul", "TCE"], "TCE", 1, "proficiency"],
      [warlock, "Tentacle of the Deeps", ["Fathomless", "TCE"], "TCE", 1, "proficiency"],
      [warlock, "Bottled Respite", ["Genie", "TCE"], "TCE", 1, 1],
      [warlock, "Elemental Gift", ["Genie", "TCE"], "TCE", 6, "proficiency"],
      [warlock, "Accursed Specter", ["Hexblade", "XGE"], "XGE", 6, 1],
      // The conjuring is the other limit, once a long rest unless a spell slot pays for it.
      [wizard, "Manifest Mind", ["Scribes", "TCE"], "TCE", 6, "proficiency"],
    ] as const
  ).map(([owner, name, [shortName, subclassSource], source, level, count]) =>
    subclassFeature(owner, [shortName, subclassSource], [name, source], level, [
      { kind: "uses", count, reset: "long" },
    ]),
  ),
  subclassFeature(wizard, ["Divination", "PHB"], ["The Third Eye", "PHB"], 10, [
    { kind: "uses", count: 1, reset: "short" },
  ]),
  subclassFeature(bard, ["Whispers", "XGE"], ["Mantle of Whispers", "XGE"], 6, [
    { kind: "uses", count: 1, reset: "short" },
  ]),
  // Twice the proficiency bonus in Psionic Energy dice; the bonus action that regains one is
  // limited by a short rest of its own.
  ...(["Psi Warrior", "Soulknife"] as const).map((shortName) =>
    subclassFeature(
      shortName === "Psi Warrior" ? fighter : rogue,
      [shortName, "TCE"],
      ["Psionic Power", "TCE"],
      3,
      [{ kind: "uses", count: "proficiency", times: 2, reset: "long" }],
    ),
  ),
  classFeature(artificer, ["Flash of Genius", "TCE"], 7, [
    { kind: "uses", count: "int", reset: "long" },
  ]),
  ...(
    [
      [cleric, 2, 6, 18],
      [paladin, 3, 7, 15],
    ] as const
  ).map(([owner, level, twice, thrice]) => ({
    ...classFeature(owner, ["Channel Divinity: Harness Divine Power", "TCE"], level, [
      { kind: "convert", pool: "channel_divinity", costs: [1, 1, 1], upTo: "halfProficiency" },
      {
        kind: "uses",
        count: 1,
        reset: "long",
        scales: [
          { level: twice, count: 2 },
          { level: thrice, count: 3 },
        ],
      },
    ]),
    houseRule: "optionalClassFeatures" as const,
  })),
  {
    ...classFeature(ranger, ["Nature's Veil", "TCE"], 10, [PROFICIENCY_USES]),
    houseRule: "optionalClassFeatures",
  },
  ...["Pact of the Talisman", "Bond of the Talisman", "Protection of the Talisman"].map((name) => ({
    ref: { name, source: "TCE" },
    mechanics: [PROFICIENCY_USES],
  })),
  ...[
    { name: "Undying Servitude", source: "TCE" },
    { name: "Gift of the Depths", source: "XGE" },
    { name: "Trickster's Escape", source: "XGE" },
    { name: "Magic Initiate", source: "PHB" },
    { name: "Artificer Initiate", source: "TCE" },
    { name: "Telepathic", source: "TCE" },
  ].map(
    (ref): FeatureMechanics => ({ ref, mechanics: [{ kind: "uses", count: 1, reset: "long" }] }),
  ),
  {
    ref: { name: "Fey Teleportation", source: "XGE" },
    mechanics: [{ kind: "uses", count: 1, reset: "short" }],
  },
  // Rolling initiative also restores it.
  {
    ref: { name: "Second Chance", source: "XGE" },
    mechanics: [{ kind: "uses", count: 1, reset: "short" }],
  },
  // Its free casts are a count per spell, left to the spells a feature grants.
  subclassFeature(artificer, ["Alchemist", "TCE"], ["Chemical Mastery", "TCE"], 15, [
    { kind: "defense", resist: ["acid", "poison"], conditionImmune: ["poisoned"] },
  ]),
  // Each casts each of its spells free once a long rest, a count per spell.
  ...[
    { name: "Fey Touched", source: "TCE" },
    { name: "Shadow Touched", source: "TCE" },
    { name: "Drow High Magic", source: "XGE" },
    { name: "Wood Elf Magic", source: "XGE" },
  ].map(narrative),
  {
    ...narrative({
      name: "Primal Awareness",
      source: "TCE",
      className: "Ranger",
      classSource: "PHB",
      level: 3,
    }),
    houseRule: "optionalClassFeatures",
  },
  // Each restores on something other than a rest, or counts per rune or per stored spell.
  narrative({
    name: "Limited Wish",
    source: "TCE",
    className: "Warlock",
    classSource: "PHB",
    subclass: { shortName: "Genie", source: "TCE" },
    level: 14,
  }),
  narrative({
    name: "Master of Runes",
    source: "TCE",
    className: "Fighter",
    classSource: "PHB",
    subclass: { shortName: "Rune Knight", source: "TCE" },
    level: 15,
  }),
  narrative({
    name: "Spell-Storing Item",
    source: "TCE",
    className: "Artificer",
    classSource: "TCE",
    level: 11,
  }),
];

/** Mechanics only, never rules text; the SRD credit that covers the drafting is in `NOTICE`. */
export const FEATURE_MECHANICS: FeatureMechanics[] = [
  {
    ref: { name: "Alert", source: "PHB" },
    mechanics: [{ kind: "bonus", target: "initiative", value: 5 }],
  },
  {
    ref: { name: "Alert", source: "XPHB" },
    mechanics: [{ kind: "bonus", target: "initiative", value: "proficiency" }],
  },
  {
    ref: { name: "Tough", source: "PHB" },
    mechanics: [{ kind: "bonus", target: "hitPointsPerLevel", value: 2 }],
  },
  {
    ref: { name: "Tough", source: "XPHB" },
    mechanics: [{ kind: "bonus", target: "hitPointsPerLevel", value: 2 }],
  },
  {
    ref: { name: "Mobile", source: "PHB" },
    mechanics: [{ kind: "bonus", target: "walk", value: 10 }],
  },
  {
    ref: { name: "Speedy", source: "XPHB" },
    mechanics: [{ kind: "bonus", target: "walk", value: 10 }],
  },
  {
    ref: { name: "Defense", source: "PHB" },
    mechanics: [{ kind: "armorClass", value: 1, when: "armor" }],
  },
  {
    ref: { name: "Defense", source: "XPHB" },
    mechanics: [{ kind: "armorClass", value: 1, when: "armor" }],
  },
  {
    ref: { name: "Dual Wielder", source: "PHB" },
    mechanics: [{ kind: "armorClass", value: 1, when: "dualWield" }],
  },
  {
    ref: { name: "Medium Armor Master", source: "PHB" },
    mechanics: [{ kind: "mediumArmorDexterity", cap: 3, minimum: 16 }],
  },
  {
    ref: { name: "Dragon Hide", source: "XGE" },
    mechanics: [{ kind: "unarmoredBase", value: 3 }],
  },
  classFeature(["Barbarian", "PHB"], ["Unarmored Defense", "PHB"], 1, [
    { kind: "unarmoredBase", value: "con" },
  ]),
  classFeature(["Barbarian", "XPHB"], ["Unarmored Defense", "XPHB"], 1, [
    { kind: "unarmoredBase", value: "con" },
  ]),
  classFeature(["Monk", "PHB"], ["Unarmored Defense", "PHB"], 1, [
    { kind: "unarmoredBase", value: "wis", unlessShield: true },
  ]),
  classFeature(["Monk", "XPHB"], ["Unarmored Defense", "XPHB"], 1, [
    { kind: "unarmoredBase", value: "wis", unlessShield: true },
  ]),
  subclassFeature(["Bard", "XPHB"], ["Dance", "XPHB"], ["Unarmored Defense", "XPHB"], 3, [
    { kind: "unarmoredBase", value: "cha", unlessShield: true },
  ]),
  {
    ref: {
      name: "Multiattack Defense",
      source: "PHB",
      className: "Ranger",
      classSource: "PHB",
      subclass: { shortName: "Hunter", source: "PHB" },
      level: 7,
    },
    narrative: true,
  },
  {
    ref: {
      name: "Soul of the Forge",
      source: "XGE",
      className: "Cleric",
      classSource: "PHB",
      subclass: { shortName: "Forge", source: "XGE" },
      level: 6,
    },
    mechanics: [{ kind: "armorClass", value: 1, when: "heavyArmor" }],
  },
  {
    ref: { name: "Blind Fighting", source: "TCE" },
    mechanics: [{ kind: "sense", name: "blindsight", range: 10 }],
  },
  {
    ref: { name: "Devil's Sight", source: "PHB" },
    mechanics: [{ kind: "sense", name: "darkvision", range: 120 }],
  },
  subclassFeature(cleric, ["Twilight", "TCE"], ["Eyes of Night", "TCE"], 1, [
    { kind: "sense", name: "darkvision", range: 300 },
  ]),
  subclassFeature(["Sorcerer", "PHB"], ["Shadow", "XGE"], ["Eyes of the Dark", "XGE"], 1, [
    { kind: "sense", name: "darkvision", range: 120 },
  ]),
  subclassFeature(["Ranger", "PHB"], ["Gloom Stalker", "XGE"], ["Umbral Sight", "XGE"], 3, [
    { kind: "sense", name: "darkvision", range: 60, raceBonus: 30 },
  ]),
  // Recorded on the model a character takes, which Powered Steps arrives with. A model's
  // benefits hold while its Arcane Armor is worn, and the sheet takes any armor worn for it.
  {
    ...subclassFeature(artificer, ["Armorer", "TCE"], ["Infiltrator", "TCE"], 3, [
      { kind: "speed", bonus: 5, whileArmored: true, label: "Powered Steps" },
    ]),
    offeredBy: {
      name: "Armor Model",
      source: "TCE",
      className: "Artificer",
      classSource: "TCE",
      subclass: { shortName: "Armorer", source: "TCE" },
      level: 3,
    },
  },
  classFeature(["Barbarian", "PHB"], ["Fast Movement", "PHB"], 5, [
    { kind: "speed", bonus: 10, unlessHeavyArmor: true },
  ]),
  subclassFeature(rogue, ["Scout", "XGE"], ["Superior Mobility", "XGE"], 9, [
    { kind: "speed", bonus: 10, alsoOn: ["climb", "swim"] },
  ]),
  {
    ...classFeature(["Ranger", "PHB"], ["Deft Explorer Improvement", "TCE"], 6, [
      { kind: "speed", bonus: 5, equalToWalk: ["climb", "swim"], label: "Roving" },
    ]),
    houseRule: "optionalClassFeatures",
  },
  subclassFeature(["Paladin", "PHB"], ["Glory", "TCE"], ["Aura of Alacrity", "TCE"], 7, [
    { kind: "bonus", target: "walk", value: 10 },
  ]),
  {
    ref: {
      name: "Purity of Body",
      source: "PHB",
      className: "Monk",
      classSource: "PHB",
      level: 10,
    },
    mechanics: [{ kind: "defense", immune: ["poison"], conditionImmune: ["disease", "poisoned"] }],
  },
  {
    ref: {
      name: "Bear",
      source: "PHB",
      className: "Barbarian",
      classSource: "PHB",
      subclass: { shortName: "Totem Warrior", source: "PHB" },
      level: 3,
    },
    offeredBy: {
      name: "Totem Spirit",
      source: "PHB",
      className: "Barbarian",
      classSource: "PHB",
      subclass: { shortName: "Totem Warrior", source: "PHB" },
      level: 3,
    },
    mechanics: [{ kind: "defense", resist: DAMAGE_TYPES_BUT_PSYCHIC, while: "raging" }],
  },
  {
    ref: {
      name: "Totem Spirit",
      source: "PHB",
      className: "Barbarian",
      classSource: "PHB",
      subclass: { shortName: "Totem Warrior", source: "PHB" },
      level: 3,
    },
    narrative: true,
  },
  {
    ref: { name: "Dungeon Delver", source: "PHB" },
    mechanics: [
      {
        kind: "roll",
        roll: "check",
        skills: ["perception", "investigation"],
        advantage: true,
        against: "to find a secret door",
      },
      saveAdvantage("against a trap"),
    ],
  },
  subclassFeature(["Sorcerer", "PHB"], ["Storm", "XGE"], ["Heart of the Storm", "XGE"], 6, [
    { kind: "defense", resist: ["lightning", "thunder"] },
  ]),
  subclassFeature(["Wizard", "PHB"], ["Necromancy", "PHB"], ["Inured to Undeath", "PHB"], 10, [
    { kind: "defense", resist: ["necrotic"] },
  ]),
  {
    ref: { name: "Dwarven Toughness", source: "PHB" },
    mechanics: [{ kind: "bonus", target: "hitPointsPerLevel", value: 1 }],
  },
  {
    ref: {
      name: "Draconic Resilience",
      source: "PHB",
      className: "Sorcerer",
      classSource: "PHB",
      subclass: { shortName: "Draconic", source: "PHB" },
      level: 1,
    },
    mechanics: [
      { kind: "bonus", target: "hitPointsPerLevel", value: 1 },
      { kind: "unarmoredBase", value: 3 },
    ],
  },
  subclassFeature(["Sorcerer", "XPHB"], ["Draconic", "XPHB"], ["Draconic Resilience", "XPHB"], 3, [
    { kind: "bonus", target: "hitPointsPerLevel", value: 1 },
    { kind: "unarmoredBase", value: "cha" },
  ]),

  {
    ref: {
      name: "Jack of All Trades",
      source: "PHB",
      className: "Bard",
      classSource: "PHB",
      level: 2,
    },
    mechanics: [
      {
        kind: "halfProficiency",
        abilities: ["str", "dex", "con", "int", "wis", "cha"],
        rounding: "down",
      },
    ],
  },
  subclassFeature(["Fighter", "PHB"], ["Champion", "PHB"], ["Remarkable Athlete", "PHB"], 7, [
    { kind: "halfProficiency", abilities: ["str", "dex", "con"], rounding: "up" },
  ]),
  subclassFeature(
    cleric,
    ["Life", "PHB"],
    ["Bonus Proficiency", "PHB"],
    1,
    grants({ armor: ["heavy"] }),
  ),
  subclassFeature(
    cleric,
    ["Nature", "PHB"],
    ["Bonus Proficiency", "PHB"],
    1,
    grants({ armor: ["heavy"] }),
  ),
  subclassFeature(
    cleric,
    ["Tempest", "PHB"],
    ["Bonus Proficiencies", "PHB"],
    1,
    grants({ armor: ["heavy"], weapons: ["martial"] }),
  ),
  subclassFeature(
    cleric,
    ["War", "PHB"],
    ["Bonus Proficiencies", "PHB"],
    1,
    grants({ armor: ["heavy"], weapons: ["martial"] }),
  ),
  subclassFeature(cleric, ["Order", "TCE"], ["Bonus Proficiencies", "TCE"], 1, [
    ...grants({ armor: ["heavy"] }),
    skillsOf(1, ["intimidation", "persuasion"]),
  ]),
  subclassFeature(
    cleric,
    ["Twilight", "TCE"],
    ["Bonus Proficiencies", "TCE"],
    1,
    grants({ armor: ["heavy"], weapons: ["martial"] }),
  ),
  subclassFeature(
    cleric,
    ["Forge", "XGE"],
    ["Bonus Proficiency", "XGE"],
    1,
    grants({ armor: ["heavy"], tools: ["smith's tools"] }),
  ),
  subclassFeature(
    ["Bard", "PHB"],
    ["Valor", "PHB"],
    ["Bonus Proficiencies", "PHB"],
    3,
    grants({ armor: ["medium", "shield"], weapons: ["martial"] }),
  ),
  subclassFeature(
    ["Bard", "PHB"],
    ["Swords", "XGE"],
    ["Bonus Proficiencies", "XGE"],
    3,
    grants({ armor: ["medium"], weapons: ["scimitar"] }),
  ),
  subclassFeature(
    ["Fighter", "PHB"],
    ["Rune Knight", "TCE"],
    ["Bonus Proficiencies", "TCE"],
    3,
    grants({ tools: ["smith's tools"] }),
  ),
  subclassFeature(
    ["Fighter", "PHB"],
    ["Samurai", "XGE"],
    ["Elegant Courtier", "XGE"],
    7,
    grants({ savingThrows: ["wis"] }),
  ),
  subclassFeature(
    ["Monk", "PHB"],
    ["Mercy", "TCE"],
    ["Implements of Mercy", "TCE"],
    3,
    grants({ skills: ["insight", "medicine"], tools: ["herbalism kit"] }),
  ),
  subclassFeature(
    ["Monk", "PHB"],
    ["Drunken Master", "XGE"],
    ["Bonus Proficiencies", "XGE"],
    3,
    grants({ skills: ["performance"], tools: ["brewer's supplies"] }),
  ),
  subclassFeature(
    ["Rogue", "PHB"],
    ["Assassin", "PHB"],
    ["Bonus Proficiencies", "PHB"],
    3,
    grants({ tools: ["disguise kit", "poisoner's kit"] }),
  ),
  subclassFeature(["Rogue", "PHB"], ["Mastermind", "XGE"], ["Master of Intrigue", "XGE"], 3, [
    ...grants({ tools: ["disguise kit", "forgery kit"] }),
    { kind: "pick", fields: ["tools"], count: 1, types: ["gaming"] },
    { kind: "pick", fields: ["languages"], count: 2 },
  ]),
  subclassFeature(
    ["Rogue", "PHB"],
    ["Scout", "XGE"],
    ["Survivalist", "XGE"],
    3,
    grants({ skills: ["nature", "survival"], expertise: ["nature", "survival"] }),
  ),
  subclassFeature(
    ["Ranger", "PHB"],
    ["Gloom Stalker", "XGE"],
    ["Iron Mind", "XGE"],
    7,
    grants({ savingThrows: ["wis"] }),
  ),
  subclassFeature(
    ["Warlock", "PHB"],
    ["Hexblade", "XGE"],
    ["Hex Warrior", "XGE"],
    1,
    grants({ armor: ["medium", "shield"], weapons: ["martial"] }),
  ),
  subclassFeature(
    ["Wizard", "PHB"],
    ["Bladesinging", "TCE"],
    ["Training in War and Song (Bladesinging)", "TCE"],
    2,
    grants({ armor: ["light"] }),
  ),
  subclassFeature(
    artificer,
    ["Alchemist", "TCE"],
    ["Tool Proficiency", "TCE"],
    3,
    grants({ tools: ["alchemist's supplies"] }),
  ),
  subclassFeature(
    artificer,
    ["Artillerist", "TCE"],
    ["Tool Proficiency", "TCE"],
    3,
    grants({ tools: ["woodcarver's tools"] }),
  ),
  subclassFeature(
    artificer,
    ["Battle Smith", "TCE"],
    ["Tool Proficiency", "TCE"],
    3,
    grants({ tools: ["smith's tools"] }),
  ),
  subclassFeature(
    artificer,
    ["Battle Smith", "TCE"],
    ["Battle Ready", "TCE"],
    3,
    grants({ weapons: ["martial"] }),
  ),
  subclassFeature(
    artificer,
    ["Armorer", "TCE"],
    ["Tools of the Trade", "TCE"],
    3,
    grants({ armor: ["heavy"], tools: ["smith's tools"] }),
  ),
  classFeature(bard, ["Expertise", "PHB"], 3, expertiseIn(2)),
  classFeature(bard, ["Expertise", "PHB"], 10, expertiseIn(2)),
  classFeature(rogue, ["Expertise", "PHB"], 1, expertiseIn(2)),
  classFeature(rogue, ["Expertise", "PHB"], 6, expertiseIn(2)),
  subclassFeature(bard, ["Lore", "PHB"], ["Bonus Proficiencies", "PHB"], 3, [skillsOf(3)]),
  subclassFeature(cleric, ["Knowledge", "PHB"], ["Blessings of Knowledge", "PHB"], 1, [
    { kind: "pick", fields: ["languages"], count: 2 },
    skillsOf(2, ["arcana", "history", "nature", "religion"], true),
  ]),
  subclassFeature(fighter, ["Cavalier", "XGE"], ["Bonus Proficiency", "XGE"], 3, [
    skillsOf(1, ["animal handling", "history", "insight", "performance", "persuasion"]),
  ]),
  subclassFeature(fighter, ["Samurai", "XGE"], ["Bonus Proficiency", "XGE"], 3, [
    skillsOf(1, ["history", "insight", "performance", "persuasion"]),
  ]),
  subclassFeature(fighter, ["Arcane Archer", "XGE"], ["Arcane Archer Lore", "XGE"], 3, [
    skillsOf(1, ["arcana", "nature"]),
  ]),
  classFeature(barbarian, ["Rage", "PHB"], 1, raging),
  classFeature(barbarian24, ["Rage", "XPHB"], 1, raging),
  classFeature(barbarian, ["Danger Sense", "PHB"], 2, [
    {
      kind: "roll",
      roll: "save",
      abilities: ["dex"],
      advantage: true,
      against: "against an effect you can see",
    },
  ]),
  classFeature(barbarian24, ["Danger Sense", "XPHB"], 2, [
    { kind: "roll", roll: "save", abilities: ["dex"], advantage: true },
  ]),
  classFeature(paladin, ["Aura of Protection", "PHB"], 6, [
    { kind: "roll", roll: "save", bonus: "cha" },
  ]),
  classFeature(paladin24, ["Aura of Protection", "XPHB"], 6, [
    { kind: "roll", roll: "save", bonus: "cha" },
  ]),
  classFeature(fighter24, ["Indomitable", "XPHB"], 9, [
    { kind: "roll", roll: "save", bonus: "level", against: "on the reroll of a failed save" },
    INDOMITABLE_USES,
  ]),
  classFeature(["Monk", "PHB"], ["Diamond Soul", "PHB"], 14, ALL_SAVES),
  classFeature(["Monk", "XPHB"], ["Disciplined Survivor", "XPHB"], 14, ALL_SAVES),
  classFeature(bard, ["Countercharm", "PHB"], 6, [
    saveAdvantage(`${CHARMED_OR_FRIGHTENED}, while you perform`),
  ]),
  classFeature(["Bard", "XPHB"], ["Countercharm", "XPHB"], 7, [
    saveAdvantage(`on the reroll of a save ${CHARMED_OR_FRIGHTENED}`),
  ]),
  classFeature(ranger, ["Favored Enemy", "PHB"], 1, [
    {
      kind: "roll",
      roll: "check",
      skills: ["survival"],
      advantage: true,
      against: "to track a favored enemy",
    },
    {
      kind: "roll",
      roll: "check",
      abilities: ["int"],
      advantage: true,
      against: "to recall information about a favored enemy",
    },
    { kind: "pick", fields: ["languages"], count: 1 },
  ]),
  classFeature(ranger, ["Land's Stride", "PHB"], 8, [
    saveAdvantage("against magical plants that impede movement"),
  ]),
  subclassFeature(["Druid", "PHB"], ["Land", "PHB"], ["Land's Stride", "PHB"], 6, [
    saveAdvantage("against magical plants that impede movement"),
  ]),
  classFeature(ranger, ["Hide in Plain Sight", "PHB"], 10, [
    {
      kind: "roll",
      roll: "check",
      skills: ["stealth"],
      bonus: 10,
      against: "while camouflaged and still",
    },
  ]),
  {
    ...subclassFeature(ranger, ["Hunter", "PHB"], ["Steel Will", "PHB"], 7, [
      saveAdvantage("against being frightened"),
    ]),
    offeredBy: {
      name: "Defensive Tactics",
      source: "PHB",
      className: "Ranger",
      classSource: "PHB",
      subclass: { shortName: "Hunter", source: "PHB" },
      level: 7,
    },
  },
  subclassFeature(rogue, ["Thief", "PHB"], ["Supreme Sneak", "PHB"], 9, [
    {
      kind: "roll",
      roll: "check",
      skills: ["stealth"],
      advantage: true,
      against: "after moving no more than half your speed this turn",
    },
  ]),
  subclassFeature(paladin, ["Devotion", "PHB"], ["Holy Nimbus", "PHB"], 20, [
    saveAdvantage("against a spell a fiend or undead casts, while Holy Nimbus lasts"),
  ]),
  subclassFeature(paladin24, ["Devotion", "XPHB"], ["Holy Nimbus", "XPHB"], 20, [
    saveAdvantage("against a fiend or undead, while Holy Nimbus lasts"),
  ]),
  subclassFeature(fighter24, ["Champion", "XPHB"], ["Remarkable Athlete", "XPHB"], 3, [
    { kind: "roll", roll: "initiative", advantage: true },
    { kind: "roll", roll: "check", skills: ["athletics"], advantage: true },
  ]),
  subclassFeature(fighter24, ["Champion", "XPHB"], ["Survivor", "XPHB"], 18, [
    { kind: "roll", roll: "deathSave", advantage: true },
    { kind: "heal", bonus: [5, "con"] },
  ]),
  {
    ...classFeature(["Cleric", "XPHB"], ["Thaumaturge", "XPHB"], 1, [
      { kind: "roll", roll: "check", skills: ["arcana", "religion"], bonus: "wis" },
    ]),
    offeredBy: {
      name: "Divine Order",
      source: "XPHB",
      className: "Cleric",
      classSource: "XPHB",
      level: 1,
    },
  },
  {
    ...classFeature(["Druid", "XPHB"], ["Magician", "XPHB"], 1, [
      { kind: "roll", roll: "check", skills: ["arcana", "nature"], bonus: "wis" },
    ]),
    offeredBy: {
      name: "Primal Order",
      source: "XPHB",
      className: "Druid",
      classSource: "XPHB",
      level: 1,
    },
  },
  {
    ref: { name: "Extended Spell", source: "XPHB" },
    mechanics: [
      {
        kind: "roll",
        roll: "save",
        abilities: ["con"],
        advantage: true,
        against: "to keep concentration on an extended spell",
      },
    ],
  },
  {
    ref: { name: "Fey Ancestry", source: "PHB" },
    mechanics: [saveAdvantage("against being charmed")],
  },
  {
    ref: { name: "Gnome Cunning", source: "PHB" },
    mechanics: [
      {
        kind: "roll",
        roll: "save",
        abilities: ["int", "wis", "cha"],
        advantage: true,
        against: "against magic",
      },
    ],
  },
  {
    ref: { name: "Brave", source: "PHB" },
    mechanics: [saveAdvantage("against being frightened")],
  },
  {
    ref: { name: "Archery", source: "PHB" },
    mechanics: [{ kind: "attack", weapons: "ranged", attack: 2 }],
  },
  {
    ref: { name: "Archery", source: "XPHB" },
    mechanics: [{ kind: "attack", weapons: "ranged", attack: 2 }],
  },
  {
    ref: { name: "Dueling", source: "PHB" },
    mechanics: [{ kind: "attack", weapons: "oneHandedMelee", damage: 2 }],
  },
  {
    ref: { name: "Dueling", source: "XPHB" },
    mechanics: [{ kind: "attack", weapons: "oneHandedMelee", damage: 2 }],
  },
  {
    ref: { name: "Sharpshooter", source: "PHB" },
    mechanics: [
      {
        kind: "attack",
        weapons: "ranged",
        proficient: true,
        attack: -5,
        damage: 10,
        option: POWER_ATTACK,
      },
    ],
  },
  {
    ref: { name: "Great Weapon Master", source: "PHB" },
    mechanics: [
      {
        kind: "attack",
        weapons: "heavyMelee",
        proficient: true,
        attack: -5,
        damage: 10,
        option: POWER_ATTACK,
      },
    ],
  },
  {
    ref: { name: "Grappler", source: "PHB" },
    mechanics: [
      { kind: "attack", advantage: true, option: "against a creature you are grappling" },
    ],
  },
  {
    ref: { name: "Grappler", source: "XPHB" },
    mechanics: [
      { kind: "attack", advantage: true, option: "against a creature you are grappling" },
    ],
  },
  classFeature(barbarian, ["Reckless Attack", "PHB"], 2, [
    {
      kind: "attack",
      advantage: true,
      ability: "str",
      option: "on a melee weapon attack, while attacking recklessly",
    },
  ]),
  classFeature(barbarian24, ["Reckless Attack", "XPHB"], 2, [
    { kind: "attack", advantage: true, ability: "str", option: "while attacking recklessly" },
  ]),
  classFeature(["Ranger", "XPHB"], ["Precise Hunter", "XPHB"], 17, [
    {
      kind: "attack",
      advantage: true,
      option: "against the creature marked by your Hunter's Mark",
    },
  ]),
  subclassFeature(fighter, ["Champion", "PHB"], ["Improved Critical", "PHB"], 3, critical(19)),
  subclassFeature(fighter, ["Champion", "PHB"], ["Superior Critical", "PHB"], 15, critical(18)),
  subclassFeature(fighter24, ["Champion", "XPHB"], ["Improved Critical", "XPHB"], 3, critical(19)),
  subclassFeature(fighter24, ["Champion", "XPHB"], ["Superior Critical", "XPHB"], 15, critical(18)),
  // A die rerolled or raised after it lands is not a number the damage roll's notation holds.
  narrative({ name: "Great Weapon Fighting", source: "PHB" }),
  narrative({ name: "Great Weapon Fighting", source: "XPHB" }),
  // A reroll changes no modifier on the roll it repeats; only the 2024 Indomitable adds one.
  classFeature(fighter, ["Indomitable", "PHB"], 9, [INDOMITABLE_USES]),
  // The level 9 row counts the uses each repeat of the feature adds.
  narrative({
    name: "Indomitable",
    source: "XPHB",
    className: "Fighter",
    classSource: "XPHB",
    level: 13,
  }),
  narrative({
    name: "Indomitable",
    source: "XPHB",
    className: "Fighter",
    classSource: "XPHB",
    level: 17,
  }),
  // Each adds a die from a pool the feature spends, or falls on another creature's roll.
  narrative({
    name: "Tactical Mind",
    source: "XPHB",
    className: "Fighter",
    classSource: "XPHB",
    level: 2,
  }),
  narrative({
    name: "Peerless Skill",
    source: "PHB",
    className: "Bard",
    classSource: "PHB",
    subclass: { shortName: "Lore", source: "PHB" },
    level: 14,
  }),
  narrative({ name: "Heightened Spell", source: "PHB" }),
  narrative({
    name: "Improved Brutal Strike",
    source: "XPHB",
    className: "Barbarian",
    classSource: "XPHB",
    level: 13,
  }),
  narrative({
    name: "Improved Brutal Strike",
    source: "XPHB",
    className: "Barbarian",
    classSource: "XPHB",
    level: 17,
  }),
  classFeature(
    rogue,
    ["Sneak Attack", "PHB"],
    1,
    sneakAttack(
      "with advantage, or with another enemy of the target within 5 feet of it and no disadvantage",
    ),
  ),
  classFeature(
    rogue24,
    ["Sneak Attack", "XPHB"],
    1,
    sneakAttack("with advantage, or with an ally within 5 feet of the target and no disadvantage"),
  ),
  classFeature(paladin, ["Divine Smite", "PHB"], 2, [
    {
      kind: "extraDamage",
      dice: "2d8",
      type: "radiant",
      weapons: "melee",
      unarmed: true,
      option: "on a melee weapon hit",
      slot: { max: 5, versus: "an undead or a fiend" },
    },
  ]),
  classFeature(paladin, ["Improved Divine Smite", "PHB"], 11, [
    { kind: "extraDamage", dice: "1d8", type: "radiant", weapons: "melee" },
  ]),
  classFeature(paladin24, ["Radiant Strikes", "XPHB"], 11, [
    { kind: "extraDamage", dice: "1d8", type: "radiant", weapons: "melee", unarmed: true },
  ]),
  subclassFeature(cleric, ["Life", "PHB"], ["Divine Strike", "PHB"], 8, [
    {
      kind: "extraDamage",
      dice: "1d8",
      scales: [{ level: 14, dice: "2d8" }],
      type: "radiant",
      unarmed: true,
      oncePerTurn: true,
      option: ON_A_HIT,
    },
  ]),
  {
    ...classFeature(cleric24, ["Divine Strike", "XPHB"], 7, [
      {
        kind: "extraDamage",
        dice: "1d8",
        scales: [{ level: 14, dice: "2d8" }],
        type: "necrotic or radiant",
        oncePerTurn: true,
        option: ON_A_HIT,
      },
    ]),
    offeredBy: {
      name: "Blessed Strikes",
      source: "XPHB",
      className: "Cleric",
      classSource: "XPHB",
      level: 7,
    },
  },
  {
    ...classFeature(druid24, ["Primal Strike", "XPHB"], 7, [
      {
        kind: "extraDamage",
        dice: "1d8",
        scales: [{ level: 15, dice: "2d8" }],
        type: "cold, fire, lightning or thunder",
        oncePerTurn: true,
        option: ON_A_HIT,
      },
    ]),
    offeredBy: {
      name: "Elemental Fury",
      source: "XPHB",
      className: "Druid",
      classSource: "XPHB",
      level: 7,
    },
  },
  // The dice each improves are the scale its option records.
  narrative({
    name: "Improved Blessed Strikes",
    source: "XPHB",
    className: "Cleric",
    classSource: "XPHB",
    level: 14,
  }),
  narrative({
    name: "Improved Elemental Fury",
    source: "XPHB",
    className: "Druid",
    classSource: "XPHB",
    level: 15,
  }),
  {
    ...subclassFeature(ranger, ["Hunter", "PHB"], ["Colossus Slayer", "PHB"], 3, [
      {
        kind: "extraDamage",
        dice: "1d8",
        unarmed: true,
        oncePerTurn: true,
        option: "against a creature below its hit point maximum",
      },
    ]),
    offeredBy: {
      name: "Hunter's Prey",
      source: "PHB",
      className: "Ranger",
      classSource: "PHB",
      subclass: { shortName: "Hunter", source: "PHB" },
      level: 3,
    },
  },
  subclassFeature(ranger24, ["Hunter", "XPHB"], ["Hunter's Prey", "XPHB"], 3, [
    {
      kind: "extraDamage",
      dice: "1d8",
      oncePerTurn: true,
      option: "with Colossus Slayer chosen, against a creature missing any of its hit points",
    },
  ]),
  classFeature(barbarian24, ["Brutal Strike", "XPHB"], 9, [
    {
      kind: "extraDamage",
      dice: "1d10",
      scales: [{ level: 17, dice: "2d10" }],
      unarmed: true,
      oncePerTurn: true,
      option: "forgoing Reckless Attack's advantage on a Strength attack",
    },
  ]),
  subclassFeature(barbarian24, ["Berserker", "XPHB"], ["Frenzy", "XPHB"], 3, [
    {
      kind: "extraDamage",
      dice: { column: "rage_damage", die: 6 },
      unarmed: true,
      oncePerTurn: true,
      while: "raging",
      option: "attacking recklessly, on the first target hit with a Strength attack",
    },
  ]),
  {
    ref: { name: "Lifedrinker", source: "PHB" },
    mechanics: [
      { kind: "extraDamage", dice: "cha", type: "necrotic", option: "with your pact weapon" },
    ],
  },
  {
    ref: { name: "Lifedrinker", source: "XPHB" },
    mechanics: [
      {
        kind: "extraDamage",
        dice: "1d6",
        type: "necrotic, psychic or radiant",
        oncePerTurn: true,
        option: "with your pact weapon",
      },
    ],
  },
  {
    ...classFeature(ranger, ["Favored Foe", "TCE"], 1, [
      {
        kind: "extraDamage",
        dice: "1d4",
        scales: [
          { level: 6, dice: "1d6" },
          { level: 14, dice: "1d8" },
        ],
        unarmed: true,
        oncePerTurn: true,
        option: "against your favored enemy",
      },
      PROFICIENCY_USES,
    ]),
    houseRule: "optionalClassFeatures",
  },
  ...(
    [
      ["Nature", "PHB", "cold, fire or lightning"],
      ["Tempest", "PHB", "thunder"],
      ["Trickery", "PHB", "poison"],
      ["War", "PHB", undefined],
      ["Order", "TCE", "psychic"],
      ["Twilight", "TCE", "radiant"],
      ["Forge", "XGE", "fire"],
    ] as const
  ).map(([domain, source, type]) =>
    subclassFeature(cleric, [domain, source], ["Divine Strike", source], 8, [
      {
        kind: "extraDamage",
        dice: "1d8",
        scales: [{ level: 14, dice: "2d8" }],
        ...(type && { type }),
        unarmed: true,
        oncePerTurn: true,
        option: ON_A_HIT,
      },
    ]),
  ),
  ...(
    [
      ["Life", "PHB"],
      ["Nature", "PHB"],
      ["Tempest", "PHB"],
      ["Trickery", "PHB"],
      ["War", "PHB"],
      ["Knowledge", "PHB"],
      ["Light", "PHB"],
      ["Forge", "XGE"],
      ["Grave", "XGE"],
      ["Order", "TCE"],
      ["Peace", "TCE"],
      ["Twilight", "TCE"],
    ] as const
  ).map(([domain, domainSource]) => ({
    ...subclassFeature(cleric, [domain, domainSource], ["Blessed Strikes", "TCE"], 8, [
      {
        kind: "extraDamage",
        dice: "1d8",
        type: "radiant",
        unarmed: true,
        oncePerTurn: true,
        option: ON_A_HIT,
      },
    ]),
    houseRule: "optionalClassFeatures" as const,
  })),
  subclassFeature(barbarian, ["Zealot", "XGE"], ["Divine Fury", "XGE"], 3, [
    {
      kind: "extraDamage",
      dice: "1d6",
      plus: "halfLevel",
      type: "necrotic or radiant",
      unarmed: true,
      oncePerTurn: true,
      while: "raging",
      option: "on the first creature you hit this turn",
    },
  ]),
  subclassFeature(bard, ["Whispers", "XGE"], ["Psychic Blades", "XGE"], 3, [
    {
      kind: "extraDamage",
      dice: "2d6",
      scales: [
        { level: 5, dice: "3d6" },
        { level: 10, dice: "5d6" },
        { level: 15, dice: "8d6" },
      ],
      type: "psychic",
      unarmed: true,
      oncePerTurn: true,
      option: "expending a use of Bardic Inspiration",
    },
  ]),
  subclassFeature(bard, ["Swords", "XGE"], ["Blade Flourish", "XGE"], 3, [
    {
      kind: "extraDamage",
      dice: "1d6",
      scales: [
        { level: 5, dice: "1d8" },
        { level: 10, dice: "1d10" },
        { level: 15, dice: "1d12" },
      ],
      unarmed: true,
      oncePerTurn: true,
      option: "expending a use of Bardic Inspiration on a flourish",
    },
  ]),
  // Its heal is the alternative to this damage on a use, so a `heal` would land on every use.
  subclassFeature(artificer, ["Battle Smith", "TCE"], ["Arcane Jolt", "TCE"], 9, [
    {
      kind: "extraDamage",
      dice: "2d6",
      scales: [{ level: 15, dice: "4d6" }],
      type: "force",
      oncePerTurn: true,
      option: "with a magic weapon, spending a use",
    },
    { kind: "uses", count: "int", reset: "long" },
  ]),
  subclassFeature(["Druid", "PHB"], ["Spores", "TCE"], ["Symbiotic Entity", "TCE"], 2, [
    { kind: "tempHp", bonus: ["level"], times: 4 },
    {
      kind: "extraDamage",
      dice: "1d6",
      type: "necrotic",
      weapons: "melee",
      unarmed: true,
      option: "while Symbiotic Entity is active",
    },
  ]),
  subclassFeature(fighter, ["Rune Knight", "TCE"], ["Giant's Might", "TCE"], 3, [
    {
      kind: "extraDamage",
      dice: "1d6",
      scales: [
        { level: 10, dice: "1d8" },
        { level: 18, dice: "1d10" },
      ],
      unarmed: true,
      oncePerTurn: true,
      option: "while Giant's Might is active",
    },
    PROFICIENCY_USES,
  ]),
  subclassFeature(fighter, ["Cavalier", "XGE"], ["Unwavering Mark", "XGE"], 3, [
    {
      kind: "extraDamage",
      dice: "halfLevel",
      weapons: "melee",
      unarmed: true,
      option: "on the bonus action attack against a creature you marked",
    },
    { kind: "uses", count: "str", reset: "long" },
  ]),
  subclassFeature(fighter, ["Psi Warrior", "TCE"], ["Psionic Strike", "TCE"], 3, [
    {
      kind: "extraDamage",
      dice: "1d6",
      scales: [
        { level: 5, dice: "1d8" },
        { level: 11, dice: "1d10" },
        { level: 17, dice: "1d12" },
      ],
      plus: "int",
      type: "force",
      oncePerTurn: true,
      option: "expending a Psionic Energy die, against a target within 30 feet",
    },
  ]),
  subclassFeature(fighter, ["Arcane Archer", "XGE"], ["Arcane Shot", "XGE"], 3, [
    {
      kind: "extraDamage",
      dice: "2d6",
      scales: [{ level: 18, dice: "4d6" }],
      type: "force, necrotic, poison or psychic",
      weapons: "ranged",
      oncePerTurn: true,
      option: "with an Arcane Shot option that adds damage to the arrow's target",
    },
    { kind: "uses", count: 2, reset: "short" },
  ]),
  subclassFeature(fighter, ["Battle Master", "PHB"], ["Combat Superiority", "PHB"], 3, [
    {
      kind: "extraDamage",
      dice: "1d8",
      scales: [
        { level: 10, dice: "1d10" },
        { level: 18, dice: "1d12" },
      ],
      unarmed: true,
      option: SUPERIORITY_DIE,
    },
    {
      kind: "pool",
      key: "superiority_dice",
      count: 4,
      die: 8,
      scales: [
        { level: 7, count: 5 },
        { level: 10, die: 10 },
        { level: 15, count: 6 },
        { level: 18, die: 12 },
      ],
    },
  ]),
  ...[
    { name: "Martial Adept", source: "PHB" },
    { name: "Superior Technique", source: "TCE" },
  ].map(
    (ref): FeatureMechanics => ({
      ref,
      mechanics: [{ kind: "extraDamage", dice: "1d6", unarmed: true, option: SUPERIORITY_DIE }],
    }),
  ),
  subclassFeature(monk, ["Astral Self", "TCE"], ["Body of the Astral Self", "TCE"], 11, [
    {
      kind: "extraDamage",
      dice: { column: "martial_arts" },
      weapons: "unarmed",
      oncePerTurn: true,
      option: "with the arms of your astral self, while your astral body is present",
    },
  ]),
  subclassFeature(monk, ["Mercy", "TCE"], ["Hand of Harm", "TCE"], 3, [
    {
      kind: "extraDamage",
      dice: { column: "martial_arts" },
      plus: "wis",
      type: "necrotic",
      weapons: "unarmed",
      oncePerTurn: true,
      option: "spending 1 ki point",
    },
  ]),
  subclassFeature(monk, ["Kensei", "XGE"], ["Kensei's Shot", "XGE"], 3, [
    {
      kind: "extraDamage",
      dice: "1d4",
      weapons: "ranged",
      option: "with a kensei weapon, after the bonus action this turn",
    },
  ]),
  subclassFeature(monk, ["Kensei", "XGE"], ["One with the Blade", "XGE"], 6, [
    {
      kind: "extraDamage",
      dice: { column: "martial_arts" },
      oncePerTurn: true,
      option: "with a kensei weapon, spending 1 ki point",
    },
  ]),
  {
    ref: { name: "Fangs of the Fire Snake", source: "PHB" },
    mechanics: [
      {
        kind: "extraDamage",
        dice: "1d10",
        type: "fire",
        weapons: "unarmed",
        option: "spending 1 ki point on the hit",
      },
    ],
  },
  subclassFeature(ranger, ["Fey Wanderer", "TCE"], ["Dreadful Strikes", "TCE"], 3, [
    {
      kind: "extraDamage",
      dice: "1d4",
      scales: [{ level: 11, dice: "1d6" }],
      type: "psychic",
      oncePerTurn: true,
      option: ON_A_HIT,
    },
  ]),
  subclassFeature(ranger, ["Gloom Stalker", "XGE"], ["Dread Ambusher", "XGE"], 3, [
    {
      kind: "extraDamage",
      dice: "1d8",
      unarmed: true,
      option: "on the additional attack of your first turn in combat",
    },
  ]),
  subclassFeature(ranger, ["Horizon Walker", "XGE"], ["Planar Warrior", "XGE"], 3, [
    {
      kind: "extraDamage",
      dice: "1d8",
      scales: [{ level: 11, dice: "2d8" }],
      type: "force",
      unarmed: true,
      oncePerTurn: true,
      option: "against the creature chosen with a bonus action this turn",
    },
  ]),
  subclassFeature(ranger, ["Monster Slayer", "XGE"], ["Slayer's Prey", "XGE"], 3, [
    {
      kind: "extraDamage",
      dice: "1d6",
      unarmed: true,
      oncePerTurn: true,
      option: "against the creature you designated",
    },
  ]),
  subclassFeature(ranger, ["Swarmkeeper", "TCE"], ["Gathered Swarm", "TCE"], 3, [
    {
      kind: "extraDamage",
      dice: "1d6",
      scales: [{ level: 11, dice: "1d8" }],
      type: "piercing",
      unarmed: true,
      oncePerTurn: true,
      option: "choosing the swarm's damage",
    },
  ]),
  subclassFeature(warlock, ["Genie", "TCE"], ["Genie's Wrath", "TCE"], 1, [
    {
      kind: "extraDamage",
      dice: "proficiency",
      type: "bludgeoning, cold, fire or thunder",
      unarmed: true,
      oncePerTurn: true,
      option: ON_A_HIT,
    },
  ]),
  // Its critical range against the cursed target is no `attack` mechanic, which always holds,
  // and its heal lands when the target dies, which a `heal` would move to the use that curses it.
  subclassFeature(warlock, ["Hexblade", "XGE"], ["Hexblade's Curse", "XGE"], 1, [
    {
      kind: "extraDamage",
      dice: "proficiency",
      unarmed: true,
      option: "against your cursed target",
    },
  ]),
  {
    ref: { name: "Eldritch Smite", source: "XGE" },
    mechanics: [
      {
        kind: "extraDamage",
        dice: "2d8",
        type: "force",
        oncePerTurn: true,
        option: "with your pact weapon",
        slot: { max: 6, pact: true },
      },
    ],
  },
  subclassFeature(["Wizard", "PHB"], ["Bladesinging", "TCE"], ["Song of Victory", "TCE"], 14, [
    {
      kind: "extraDamage",
      dice: "int",
      weapons: "melee",
      unarmed: true,
      option: "while your Bladesong is active",
    },
  ]),
  {
    ref: { name: "Fire Rune", source: "TCE" },
    mechanics: [
      { kind: "extraDamage", dice: "2d6", type: "fire", option: "invoking the fire rune" },
    ],
  },
  // The die each adds is the one recorded on the feature it improves or is an option of.
  ...(
    [
      [
        bard,
        ["Swords", "XGE"],
        "XGE",
        ["Defensive Flourish", "Mobile Flourish", "Slashing Flourish"],
        3,
      ],
      [bard, ["Swords", "XGE"], "XGE", ["Master's Flourish"], 14],
      [artificer, ["Battle Smith", "TCE"], "TCE", ["Improved Defender"], 15],
      [fighter, ["Battle Master", "PHB"], "PHB", ["Improved Combat Superiority (d10)"], 10],
      [fighter, ["Battle Master", "PHB"], "PHB", ["Improved Combat Superiority (d12)"], 18],
      [fighter, ["Rune Knight", "TCE"], "TCE", ["Great Stature"], 10],
      [fighter, ["Rune Knight", "TCE"], "TCE", ["Runic Juggernaut"], 18],
      [ranger, ["Swarmkeeper", "TCE"], "TCE", ["Mighty Swarm"], 11],
    ] as const
  ).flatMap(
    ([[className, classSource], [shortName, subclassSource], source, featureNames, level]) =>
      featureNames.map((name) =>
        narrative({
          name,
          source,
          className,
          classSource,
          subclass: { shortName, source: subclassSource },
          level,
        }),
      ),
  ),
  ...[
    ...["Brace", "Quick Toss"].map((name) => ({ name, source: "TCE" })),
    ...[
      "Disarming Attack",
      "Distracting Strike",
      "Feinting Attack",
      "Goading Attack",
      "Lunging Attack",
      "Maneuvering Attack",
      "Menacing Attack",
      "Pushing Attack",
      "Riposte",
      "Trip Attack",
    ].map((name) => ({ name, source: "PHB" })),
    ...[
      "Banishing Arrow",
      "Beguiling Arrow",
      "Bursting Arrow",
      "Enfeebling Arrow",
      "Grasping Arrow",
      "Piercing Arrow",
      "Seeking Arrow",
      "Shadow Arrow",
    ].map((name) => ({ name, source: "XGE" })),
  ].map(narrative),
  // The launcher is no weapon the inventory holds, and the glimmer's damage lands on any attack.
  ...(
    [
      ["Lightning Launcher", 3],
      ["Infiltrator", 15],
    ] as const
  ).map(([name, level]) =>
    narrative({
      name,
      source: "TCE",
      className: "Artificer",
      classSource: "TCE",
      subclass: { shortName: "Armorer", source: "TCE" },
      level,
    }),
  ),
  // Orcish Fury rolls one of the weapon's own dice again, and Piercer rerolls one or adds one
  // on a critical hit, which doubles every die the roll holds.
  narrative({ name: "Orcish Fury", source: "XGE" }),
  narrative({ name: "Piercer", source: "TCE" }),
  classFeature(monk, ["Martial Arts", "PHB"], 1, [
    { kind: "martialArts", monkWeapons: "classic", die: "martial_arts", dexterity: true },
  ]),
  classFeature(monk24, ["Martial Arts Die", "XPHB"], 1, [
    { kind: "martialArts", monkWeapons: "one", die: "martial_arts" },
  ]),
  classFeature(monk24, ["Dexterous Attacks", "XPHB"], 1, [
    { kind: "martialArts", monkWeapons: "one", dexterity: true },
  ]),
  // A critical hit doubles every die the roll holds, so it cannot add dice it does not double.
  ...(
    [
      ["Brutal Critical (1 die)", 9],
      ["Brutal Critical (2 dice)", 13],
      ["Brutal Critical (3 dice)", 17],
    ] as const
  ).map(([name, level]) =>
    narrative({ name, source: "PHB", className: "Barbarian", classSource: "PHB", level }),
  ),
  // Each lands on another creature, or on a roll of 20 for an amount the boon's pick sets.
  narrative({
    name: "Superior Hunter's Prey",
    source: "XPHB",
    className: "Ranger",
    classSource: "XPHB",
    subclass: { shortName: "Hunter", source: "XPHB" },
    level: 11,
  }),
  narrative({ name: "Boon of Irresistible Offense", source: "XPHB" }),
  classFeature(fighter, ["Second Wind", "PHB"], 1, [
    { kind: "heal", dice: "1d10", bonus: ["level"] },
  ]),
  classFeature(fighter24, ["Second Wind", "XPHB"], 1, [
    { kind: "heal", dice: "1d10", bonus: ["level"] },
  ]),
  subclassFeature(fighter, ["Champion", "PHB"], ["Survivor", "PHB"], 18, [
    { kind: "heal", bonus: [5, "con"] },
  ]),
  subclassFeature(fighter, ["Samurai", "XGE"], ["Fighting Spirit", "XGE"], 3, [
    {
      kind: "tempHp",
      bonus: [5],
      scales: [
        { level: 10, bonus: 10 },
        { level: 15, bonus: 15 },
      ],
    },
    { kind: "attack", advantage: true, option: "on the turn you use Fighting Spirit" },
  ]),
  ...(
    [
      [cleric, "Channel Divinity: Preserve Life", "PHB", 2],
      [cleric24, "Channel Divinity: Preserve Life", "PHB", 3],
      [cleric24, "Preserve Life", "XPHB", 3],
    ] as const
  ).map(([owner, name, source, level]) =>
    subclassFeature(owner, ["Life", source], [name, source], level, [
      { kind: "heal", bonus: ["level"], times: 5, others: true },
    ]),
  ),
  classFeature(cleric24, ["Divine Spark", "XPHB"], 2, [
    {
      kind: "heal",
      dice: "1d8",
      bonus: ["wis"],
      scales: [
        { level: 7, dice: "2d8" },
        { level: 13, dice: "3d8" },
        { level: 18, dice: "4d8" },
      ],
      others: true,
    },
  ]),
  subclassFeature(druid24, ["Land", "XPHB"], ["Land's Aid", "XPHB"], 3, [
    {
      kind: "heal",
      dice: "2d6",
      scales: [
        { level: 10, dice: "3d6" },
        { level: 14, dice: "4d6" },
      ],
      others: true,
    },
  ]),
  classFeature(druid24, ["Wild Shape", "XPHB"], 2, [{ kind: "tempHp", bonus: ["level"] }]),
  subclassFeature(monk, ["Open Hand", "PHB"], ["Wholeness of Body", "PHB"], 6, [
    { kind: "heal", bonus: ["level"], times: 3 },
  ]),
  subclassFeature(monk24, ["Open Hand", "XPHB"], ["Wholeness of Body", "XPHB"], 6, [
    { kind: "heal", dice: { column: "martial_arts" }, bonus: ["wis"] },
  ]),
  classFeature(monk24, ["Uncanny Metabolism", "XPHB"], 2, [
    { kind: "heal", dice: { column: "martial_arts" }, bonus: ["level"] },
  ]),
  classFeature(ranger24, ["Tireless", "XPHB"], 10, [
    { kind: "tempHp", dice: "1d8", bonus: ["wis"] },
  ]),
  subclassFeature(["Warlock", "PHB"], ["Fiend", "PHB"], ["Dark One's Blessing", "PHB"], 1, [
    { kind: "tempHp", bonus: ["cha", "level"] },
  ]),
  subclassFeature(["Warlock", "XPHB"], ["Fiend", "XPHB"], ["Dark One's Blessing", "XPHB"], 3, [
    { kind: "tempHp", bonus: ["cha", "level"] },
  ]),
  {
    ref: { name: "Relentless Endurance", source: "PHB" },
    mechanics: [{ kind: "heal", bonus: [1] }],
  },
  // Each heals through another source, a spell, a rest's hit dice or a pool the player divides,
  // not on a use of its own.
  ...(
    [
      [cleric, "Disciple of Life", "PHB", 1],
      [cleric24, "Disciple of Life", "XPHB", 3],
      [cleric, "Blessed Healer", "PHB", 6],
      [cleric24, "Blessed Healer", "XPHB", 6],
      [cleric, "Supreme Healing", "PHB", 17],
      [cleric24, "Supreme Healing", "XPHB", 17],
    ] as const
  ).map(([[className, classSource], name, source, level]) =>
    narrative({
      name,
      source,
      className,
      classSource,
      subclass: { shortName: "Life", source },
      level,
    }),
  ),
  narrative({
    name: "Song of Rest (d6)",
    source: "PHB",
    className: "Bard",
    classSource: "PHB",
    level: 2,
  }),
  narrative({
    name: "Lay on Hands",
    source: "PHB",
    className: "Paladin",
    classSource: "PHB",
    level: 1,
  }),
  narrative({
    name: "Lay on Hands",
    source: "XPHB",
    className: "Paladin",
    classSource: "XPHB",
    level: 1,
  }),
  narrative({
    name: "Restoring Touch",
    source: "XPHB",
    className: "Paladin",
    classSource: "XPHB",
    level: 14,
  }),
  // Each rides on another source: Patient Defense's focus point, or a spell cast.
  narrative({
    name: "Heightened Focus",
    source: "XPHB",
    className: "Monk",
    classSource: "XPHB",
    level: 10,
  }),
  narrative({ name: "Fiendish Vigor", source: "XPHB" }),
  ...(
    [
      [cleric, 2],
      [cleric24, 3],
    ] as const
  ).flatMap(([owner, level]) => [
    subclassFeature(owner, ["Peace", "TCE"], ["Channel Divinity: Balm of Peace", "TCE"], level, [
      { kind: "heal", dice: "2d6", bonus: ["wis"], others: true },
    ]),
    subclassFeature(
      owner,
      ["Twilight", "TCE"],
      ["Channel Divinity: Twilight Sanctuary", "TCE"],
      level,
      [{ kind: "tempHp", dice: "1d6", bonus: ["level"] }],
    ),
  ]),
  subclassFeature(monk, ["Mercy", "TCE"], ["Hand of Healing", "TCE"], 3, [
    { kind: "heal", dice: { column: "martial_arts" }, bonus: ["wis"], others: true },
  ]),
  subclassFeature(monk, ["Mercy", "TCE"], ["Hand of Ultimate Mercy", "TCE"], 17, [
    { kind: "heal", dice: "4d10", bonus: ["wis"], others: true },
  ]),
  {
    ...classFeature(monk, ["Quickened Healing", "TCE"], 4, [
      { kind: "heal", dice: { column: "martial_arts" }, bonus: ["proficiency"] },
    ]),
    houseRule: "optionalClassFeatures",
  },
  {
    ...classFeature(ranger, ["Deft Explorer Improvement", "TCE"], 10, [
      { kind: "tempHp", dice: "1d8", bonus: ["wis"] },
      PROFICIENCY_USES,
    ]),
    houseRule: "optionalClassFeatures",
  },
  subclassFeature(bard, ["Glamour", "XGE"], ["Mantle of Inspiration", "XGE"], 3, [
    {
      kind: "tempHp",
      bonus: [5],
      scales: [
        { level: 5, bonus: 8 },
        { level: 10, bonus: 11 },
        { level: 15, bonus: 14 },
      ],
      others: true,
    },
  ]),
  subclassFeature(["Sorcerer", "PHB"], ["Divine Soul", "XGE"], ["Unearthly Recovery", "XGE"], 18, [
    { kind: "heal", bonus: ["halfMaximum"] },
  ]),
  subclassFeature(warlock, ["Celestial", "XGE"], ["Searing Vengeance", "XGE"], 14, [
    { kind: "heal", bonus: ["halfMaximum"] },
  ]),
  subclassFeature(["Druid", "PHB"], ["Wildfire", "TCE"], ["Blazing Revival", "TCE"], 14, [
    { kind: "heal", bonus: ["halfMaximum"] },
  ]),
  subclassFeature(paladin, ["Ancients", "PHB"], ["Undying Sentinel", "PHB"], 15, [
    { kind: "heal", bonus: [1] },
  ]),
  subclassFeature(["Sorcerer", "PHB"], ["Shadow", "XGE"], ["Strength of the Grave", "XGE"], 1, [
    { kind: "heal", bonus: [1] },
  ]),
  classFeature(artificer, ["Soul of Artifice", "TCE"], 20, [{ kind: "heal", bonus: [1] }]),
  // Lands when the character finishes a rest, not on a use.
  subclassFeature(warlock, ["Celestial", "XGE"], ["Celestial Resilience", "XGE"], 10, [
    { kind: "tempHp", bonus: ["level", "cha"] },
  ]),
  // The use is the free cast of Evard's black tentacles.
  subclassFeature(warlock, ["Fathomless", "TCE"], ["Grasping Tentacles", "TCE"], 10, [
    { kind: "tempHp", bonus: ["level"] },
    { kind: "uses", count: 1, reset: "long" },
  ]),
  // A creature gains these once between rests, so the use counts the character's own.
  {
    ref: { name: "Inspiring Leader", source: "PHB" },
    mechanics: [
      { kind: "tempHp", bonus: ["level", "cha"] },
      { kind: "uses", count: 1, reset: "short" },
    ],
  },
  // Each narrative record from here to the limited uses heals on an event rather than a use,
  // restores another creature, a pool the player divides, a ward or a summon's hit points, or
  // heals through a spell, a rest's hit dice, a random table, an option picked as it lands, or
  // an amount no restore term records.
  ...(
    [
      [cleric, "Circle of Mortality", ["Grave", "XGE"], "XGE", 1],
      [cleric, "Keeper of Souls", ["Grave", "XGE"], "XGE", 17],
      [["Druid", "PHB"], "Combat Wild Shape", ["Moon", "PHB"], "PHB", 2],
      [["Druid", "PHB"], "Balm of the Summer Court", ["Dreams", "XGE"], "XGE", 2],
      [["Druid", "PHB"], "Spirit Totem", ["Shepherd", "XGE"], "XGE", 2],
      [["Druid", "PHB"], "Guardian Spirit", ["Shepherd", "XGE"], "XGE", 10],
      [["Druid", "PHB"], "Chalice", ["Stars", "TCE"], "TCE", 2],
      [["Druid", "PHB"], "Enhanced Bond", ["Wildfire", "TCE"], "TCE", 6],
      [paladin, "Elder Champion", ["Ancients", "PHB"], "PHB", 20],
      [paladin, "Protective Spirit", ["Redemption", "XGE"], "XGE", 15],
      [paladin, "Inspiring Smite", ["Glory", "TCE"], "TCE", 3],
      [warlock, "Healing Light", ["Celestial", "XGE"], "XGE", 1],
      [["Sorcerer", "PHB"], "Wild Magic Surge", ["Wild", "PHB"], "PHB", 1],
      [["Sorcerer", "PHB"], "Hound of Ill Omen", ["Shadow", "XGE"], "XGE", 6],
      [["Sorcerer", "PHB"], "Clockwork Cavalcade", ["Clockwork Soul", "TCE"], "TCE", 18],
      [["Wizard", "PHB"], "Arcane Ward", ["Abjuration", "PHB"], "PHB", 2],
      [["Wizard", "PHB"], "Grim Harvest", ["Necromancy", "PHB"], "PHB", 2],
      [["Wizard", "PHB"], "Master Transmuter", ["Transmutation", "PHB"], "PHB", 14],
      [["Wizard", "PHB"], "Durable Summons", ["Conjuration", "PHB"], "PHB", 14],
      [barbarian, "Form of the Beast", ["Beast", "TCE"], "TCE", 3],
      [barbarian, "Wild Surge", ["Wild Magic", "TCE"], "TCE", 3],
      [barbarian, "Tundra", ["Storm Herald", "XGE"], "XGE", 3],
      [bard, "Mote of Potential", ["Creation", "TCE"], "TCE", 3],
      [artificer, "Experimental Elixir", ["Alchemist", "TCE"], "TCE", 3],
      [artificer, "Alchemical Savant", ["Alchemist", "TCE"], "TCE", 5],
      [artificer, "Eldritch Cannon", ["Artillerist", "TCE"], "TCE", 3],
      [artificer, "Steel Defender", ["Battle Smith", "TCE"], "TCE", 3],
      [warlock, "Sanctuary Vessel", ["Genie", "TCE"], "TCE", 10],
    ] as const
  ).map(([[className, classSource], name, [shortName, subclassSource], source, level]) =>
    narrative({
      name,
      source,
      className,
      classSource,
      subclass: { shortName, source: subclassSource },
      level,
    }),
  ),
  narrative({
    name: "Magical Inspiration",
    source: "TCE",
    className: "Bard",
    classSource: "PHB",
    level: 2,
  }),
  ...[
    { name: "Healer", source: "PHB" },
    { name: "Durable", source: "PHB" },
    { name: "Dwarven Fortitude", source: "XGE" },
    { name: "Chef", source: "TCE" },
    { name: "Rally", source: "PHB" },
    { name: "Gift of the Ever-Living Ones", source: "XGE" },
    { name: "Gift of the Protectors", source: "TCE" },
    { name: "Homunculus Servant", source: "TCE" },
    { name: "Tomb of Levistus", source: "XGE" },
  ].map(narrative),
  classFeature(sorcerer, ["Font of Magic", "PHB"], 2, [
    { kind: "convert", pool: "sorcery_points", costs: [2, 3, 5, 6, 7], refund: true },
  ]),
  // Its conversion is recorded on Font of Magic, the feature whose row the sheet lists.
  narrative({
    name: "Flexible Casting",
    source: "PHB",
    className: "Sorcerer",
    classSource: "PHB",
    level: 2,
  }),
  ...LIMITED_USES,
  ...ONGOING_EFFECTS,
];
