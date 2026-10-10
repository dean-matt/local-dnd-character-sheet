import type { HitDie } from "@dnd/rules";
import { type CharacterDefinition, type CharacterState, entryKey } from "../index.ts";

export const WARLOCK = { name: "Warlock", source: "XPHB" };
export const ROGUE = { name: "Rogue", source: "XPHB" };

/** Upstream writes each of the eighteen skills twice, once per ruleset. */
export const DECEPTION = { name: "Deception", source: "XPHB" };
export const STEALTH = { name: "Stealth", source: "XPHB" };
export const PERCEPTION = { name: "Perception", source: "XPHB" };

/** The `subclasses` row's own name; its features and tags spell `Fiend`. */
export const FIEND_PATRON = { name: "Fiend Patron", source: "XPHB" };

/** The background grants the Origin feat it names: `Charlatan` (XPHB) grants `Skilled`. */
export const CHARLATAN = { name: "Charlatan", source: "XPHB" };
export const SKILLED = { name: "Skilled", source: "XPHB" };

/** What the Half-Elf row supplies: Medium, 30 feet, and no second movement mode. */
const raceTraits = {
  size: { computed: "medium" },
  speed: { computed: { walk: 30 } },
} as const;

/** Every ability at no proficiency, for a test that cares about something else entirely. */
const noSavingThrows = Object.fromEntries(
  (["str", "dex", "con", "int", "wis", "cha"] as const).map((ability) => [
    ability,
    { computed: 0 },
  ]),
);

/** The derived tree as the endpoint assembles it, with the traits under test swapped in. */
export const derivedInput = (traits: object = {}) => ({
  abilityScores: Object.fromEntries(
    Object.entries(definition.abilityScores).map(([ability, score]) => [
      ability,
      { computed: score },
    ]),
  ),
  abilityModifiers: noSavingThrows,
  hitPointMaximum: { computed: 37 },
  hitDice: [],
  proficiencyBonus: { computed: 2 },
  savingThrows: noSavingThrows,
  skills: [],
  armorClass: { computed: 10 },
  initiative: { computed: 0 },
  spellcasting: [],
  spellSlots: [],
  pactSlots: null,
  carryingCapacity: { computed: 120 },
  carriedWeight: 0,
  encumbrance: null,
  attunementSlots: { computed: 3 },
  attacks: [],
  defenses: {
    computed: {
      resistances: [],
      damageImmunities: [],
      conditionImmunities: [],
      resistanceChoice: null,
    },
  },
  ...raceTraits,
  ...traits,
});

/** Both d8 upstream, in both editions. */
export const hitDice = new Map<string, HitDie>([
  [entryKey(WARLOCK), 8],
  [entryKey(ROGUE), 8],
]);

export const definition: CharacterDefinition = {
  name: "Vex",
  edition: "one",
  levels: [
    { class: WARLOCK },
    { class: WARLOCK, rolled: 6 },
    { class: WARLOCK, subclass: FIEND_PATRON },
    { class: ROGUE, rolled: 3 },
    { class: ROGUE },
  ],
  leveling: "xp",
  experience: 6500,
  race: { name: "Half-Elf", source: "XPHB" },
  background: CHARLATAN,
  abilityScores: { str: 8, dex: 16, con: 14, int: 10, wis: 12, cha: 17 },
  abilityIncreases: [],
  proficiencies: {
    savingThrows: ["wis", "cha"],
    skills: [
      { ref: DECEPTION, level: "proficient" },
      { ref: STEALTH, level: "expertise" },
    ],
    armor: ["Light"],
    weapons: ["Simple"],
    tools: [{ name: "Thieves' Tools", level: "expertise" }],
    languages: [
      { name: "Common", source: "XPHB" },
      { name: "Infernal", source: "XPHB" },
    ],
  },
  inventory: [
    {
      ref: { name: "Dagger", source: "XPHB" },
      quantity: 2,
      carried: true,
      equipped: true,
      attuned: false,
    },
    {
      ref: { homebrewId: "hb_01" },
      quantity: 1,
      carried: true,
      equipped: false,
      attuned: true,
    },
  ],
  spells: [
    {
      ref: { name: "Eldritch Blast", source: "XPHB" },
      prepared: true,
      origin: WARLOCK,
    },
  ],
  feats: [{ ref: SKILLED, grantedBy: { kind: "background", ref: CHARLATAN } }],
  optionalFeatures: [
    {
      ref: { name: "Agonizing Blast", source: "XPHB" },
      featureType: "EI",
      grantedBy: { kind: "class", ref: WARLOCK },
    },
  ],
  featureChoices: [],
  money: { copper: 7, silver: 0, electrum: 0, gold: 41, platinum: 2 },
  appearance: { age: "24", height: "5'6\"", eyes: "green" },
  houseRules: { encumbrance: true },
  overrides: {},
  departures: [],
  notes: "Owes the Clasp a favor.",
};

export const state: CharacterState = {
  hitPoints: { current: 21, temporary: 5 },
  hitDice: [{ die: 8, total: 5, remaining: 1 }],
  spellSlots: [],
  pactSlots: { level: 2, total: 2, expended: 1 },
  conditions: [{ name: "Prone", source: "XPHB" }],
  resources: [{ name: "Superiority Dice", current: 3, maximum: 4, resetsOn: "short" }],
  deathSaves: { successes: 0, failures: 0 },
  exhaustion: 1,
};

export const withSkills = (skills: unknown) => ({
  ...definition,
  proficiencies: { ...definition.proficiencies, skills },
});

/** Classic throughout, because upstream ships no subrace in the 2024 ruleset. */
export const elf: CharacterDefinition = {
  ...definition,
  edition: "classic",
  levels: [{ class: { name: "Wizard", source: "PHB" } }],
  race: { name: "Elf", source: "PHB" },
  subrace: { name: "High", source: "PHB" },
  background: { name: "Sage", source: "PHB" },
  inventory: [],
  spells: [],
  feats: [],
  optionalFeatures: [],
};
