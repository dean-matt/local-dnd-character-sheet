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
  narrative({
    name: "Indomitable",
    source: "PHB",
    className: "Fighter",
    classSource: "PHB",
    level: 9,
  }),
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
    name: "Bardic Inspiration",
    source: "PHB",
    className: "Bard",
    classSource: "PHB",
    level: 1,
  }),
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
];
