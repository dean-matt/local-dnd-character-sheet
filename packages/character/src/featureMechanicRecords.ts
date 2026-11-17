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
  {
    ref: {
      name: "Dread Ambusher",
      source: "XGE",
      className: "Ranger",
      classSource: "PHB",
      subclass: { shortName: "Gloom Stalker", source: "XGE" },
      level: 3,
    },
    narrative: true,
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
    narrative: true,
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
    mechanics: [{ kind: "bonus", target: "hitPointsPerLevel", value: 1 }],
  },

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
];
