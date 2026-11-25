import {
  type BonusActionAction,
  type FeatureMechanics,
  featureMechanicsKey,
  type Mechanic,
} from "./featureMechanics.ts";
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

/** Invoking a rune once, twice from Master of Runes, which only a fighter's own levels reach. */
const RUNE_USES: Mechanic = {
  kind: "uses",
  count: 1,
  reset: "short",
  levelsIn: { name: "Fighter", source: "PHB" },
  scales: [{ level: 15, count: 2 }],
};
const SPELLS: Mechanic = { kind: "spells" };
const SPELLS_BY_SLOT: Mechanic = { kind: "spells", casting: "slot" };
const SPELLS_AT_WILL: Mechanic = { kind: "spells", casting: "atWill" };
/** Each spell cast once without a slot between long rests, which upstream's `known` or `innate` list omits. */
const SPELLS_ONCE_PER_LONG_REST: Mechanic = {
  kind: "spells",
  casts: { count: 1, reset: "long" },
};
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
const PRECISION_ATTACK = "with Precision Attack, expending a superiority die on a miss";
const GUIDED_STRIKE: Mechanic = {
  kind: "attack",
  attack: 10,
  afterRoll: true,
  option: "after the roll, using Channel Divinity",
};
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

const advantageOn = (option: string): Mechanic => ({ kind: "attack", advantage: true, option });
const KI_POINTS = [1, 2, 3].map((ki) => `${ki} ki point${ki === 1 ? "" : "s"}`);
const INFUSED = "with the weapon you infused";
const KI_DC: Mechanic = { kind: "dc", ability: "wis", label: "Ki" };
const CHOSEN_CASTING_DC: Mechanic = { kind: "dc", ability: ["int", "wis", "cha"] };
const WINGS: Mechanic[] = [
  { kind: "active" },
  { kind: "speed", equalToWalk: ["fly"], while: "active" },
];

/**
 * What PHB, XGE and TCE features outside the SRD change about the character's own attacks. A
 * bonus the player picks the size of, as ki spent or an artificer's level, is one option per
 * size. A die or a bonus added after the roll lands is offered once the attack has rolled,
 * since a trade is taken before it.
 */
const ATTACK_CHANGES: FeatureMechanics[] = [
  ...(
    [
      [cleric, 2],
      [cleric24, 3],
    ] as const
  ).flatMap(([owner, level]) => [
    subclassFeature(owner, ["War", "PHB"], ["Channel Divinity: Guided Strike", "PHB"], level, [
      GUIDED_STRIKE,
    ]),
    subclassFeature(
      owner,
      ["Trickery", "PHB"],
      ["Channel Divinity: Invoke Duplicity", "PHB"],
      level,
      [advantageOn("against a creature within 5 feet of both you and your illusion")],
    ),
  ]),
  subclassFeature(paladin, ["Conquest", "XGE"], ["Guided Strike", "XGE"], 3, [GUIDED_STRIKE]),
  // Its armor's +1 is no `armorClass` mechanic, which always holds.
  subclassFeature(cleric, ["Forge", "XGE"], ["Blessing of the Forge", "XGE"], 1, [
    {
      kind: "attack",
      weapons: "any",
      attack: 1,
      damage: 1,
      option: "with the weapon Blessing of the Forge imbues",
    },
  ]),
  // A hit against a surprised creature is a critical hit whatever the d20 shows, which no
  // threshold holds.
  subclassFeature(rogue, ["Assassin", "PHB"], ["Assassinate", "PHB"], 3, [
    advantageOn("against a creature that hasn't taken a turn in the combat yet"),
  ]),
  subclassFeature(rogue, ["Scout", "XGE"], ["Ambush Master", "XGE"], 13, [
    advantageOn(
      "against the first creature you hit in a combat's first round, until your next turn",
    ),
  ]),
  subclassFeature(rogue, ["Swashbuckler", "XGE"], ["Master Duelist", "XGE"], 17, [
    advantageOn("on the reroll of an attack you missed"),
  ]),
  subclassFeature(rogue, ["Arcane Trickster", "PHB"], ["Versatile Trickster", "PHB"], 13, [
    advantageOn("against the creature your mage hand distracts, this turn"),
  ]),
  {
    ...classFeature(rogue, ["Steady Aim", "TCE"], 3, [
      advantageOn("on your next attack this turn, not having moved"),
    ]),
    houseRule: "optionalClassFeatures",
  },
  subclassFeature(monk, ["Shadow", "PHB"], ["Shadow Step", "PHB"], 6, [
    advantageOn("on your first melee attack this turn after Shadow Step"),
  ]),
  subclassFeature(
    monk,
    ["Kensei", "XGE"],
    ["Sharpen the Blade", "XGE"],
    11,
    KI_POINTS.map((spent, index) => ({
      kind: "attack",
      weapons: "any",
      attack: index + 1,
      damage: index + 1,
      option: `with the kensei weapon you spent ${spent} on, unless magic already gives it a bonus`,
    })),
  ),
  {
    ...classFeature(
      monk,
      ["Focused Aim", "TCE"],
      5,
      KI_POINTS.map((spent, index) => ({
        kind: "attack",
        attack: (index + 1) * 2,
        afterRoll: true,
        option: `after a miss, spending ${spent}`,
      })),
    ),
    houseRule: "optionalClassFeatures",
  },
  subclassFeature(sorcerer, ["Divine Soul", "XGE"], ["Favored by the Gods", "XGE"], 1, [
    { kind: "attack", dice: "2d4", afterRoll: true, option: "after a miss" },
  ]),
  subclassFeature(rogue, ["Soulknife", "TCE"], ["Homing Strikes", "TCE"], 9, [
    {
      kind: "attack",
      dice: "1d6",
      scales: [
        { level: 5, dice: "1d8" },
        { level: 11, dice: "1d10" },
        { level: 17, dice: "1d12" },
      ],
      afterRoll: true,
      option: "with your Psychic Blades after a miss, expending the Psionic Energy die if it hits",
    },
  ]),
  subclassFeature(paladin, ["Conquest", "XGE"], ["Invincible Conqueror", "XGE"], 20, [
    { kind: "active" },
    { kind: "turn", more: 1, while: "active" },
    {
      kind: "attack",
      weapons: "melee",
      unarmed: true,
      critical: 19,
      option: "while Invincible Conqueror lasts",
    },
  ]),
  subclassFeature(paladin, ["Watchers", "TCE"], ["Mortal Bulwark", "TCE"], 20, [
    advantageOn(
      "against an aberration, celestial, elemental, fey or fiend, while Mortal Bulwark lasts",
    ),
  ]),
  subclassFeature(sorcerer, ["Wild", "PHB"], ["Tides of Chaos", "PHB"], 1, [
    advantageOn("spending Tides of Chaos"),
  ]),
  subclassFeature(warlock, ["Great Old One", "PHB"], ["Entropic Ward", "PHB"], 6, [
    advantageOn("against the creature Entropic Ward made miss, until the end of your next turn"),
  ]),
  {
    ref: { name: "Improved Pact Weapon", source: "XGE" },
    mechanics: [
      {
        kind: "attack",
        weapons: "any",
        attack: 1,
        damage: 1,
        option: "with your pact weapon, unless magic already gives it a bonus",
      },
    ],
  },
  {
    ref: { name: "Charger", source: "PHB" },
    mechanics: [
      {
        kind: "attack",
        weapons: "melee",
        unarmed: true,
        damage: 5,
        option: "on the bonus action attack after you Dash 10 feet in a straight line",
      },
    ],
  },
  {
    ref: { name: "Thrown Weapon Fighting", source: "TCE" },
    mechanics: [{ kind: "attack", weapons: "thrown", damage: 2, option: "on a ranged attack" }],
  },
  {
    ref: { name: "Mounted Combatant", source: "PHB" },
    mechanics: [
      advantageOn("on a melee attack against an unmounted creature smaller than your mount"),
    ],
  },
  {
    ref: { name: "Crusher", source: "TCE" },
    mechanics: [
      advantageOn(
        "against a creature you dealt a bludgeoning critical hit, until the start of your next turn",
      ),
    ],
  },
  {
    ref: { name: "Feinting Attack", source: "PHB" },
    mechanics: [advantageOn("on your next attack this turn against the creature you feint")],
  },
  {
    ref: { name: "Storm Rune", source: "TCE" },
    mechanics: [
      advantageOn("spending your reaction while the rune's prophetic state lasts"),
      RUNE_USES,
    ],
  },
  // An optional feature knows only the character's total level, so the player takes the size
  // the artificer's own level gives.
  {
    ref: { name: "Enhanced Weapon", source: "TCE" },
    mechanics: [
      {
        kind: "attack",
        weapons: "any",
        attack: 1,
        damage: 1,
        option: `${INFUSED}, below artificer level 10`,
      },
      {
        kind: "attack",
        weapons: "any",
        attack: 2,
        damage: 2,
        option: `${INFUSED}, from artificer level 10`,
      },
    ],
  },
  ...(
    [
      ["Radiant Weapon", "any"],
      ["Returning Weapon", "thrown"],
    ] as const
  ).map(
    ([name, weapons]): FeatureMechanics => ({
      ref: { name, source: "TCE" },
      mechanics: [{ kind: "attack", weapons, attack: 1, damage: 1, option: INFUSED }],
    }),
  ),
  {
    ref: { name: "Repeating Shot", source: "TCE" },
    mechanics: [{ kind: "attack", weapons: "ranged", attack: 1, damage: 1, option: INFUSED }],
  },
  // Its die is the one Combat Superiority and the feats that grant maneuvers record.
  narrative({ name: "Precision Attack", source: "PHB" }),
];

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
    { kind: "attack", weapons: "any", attack: "cha", option: SACRED_WEAPON, while: "active" },
  ]),
  subclassFeature(paladin24, ["Devotion", "XPHB"], ["Sacred Weapon", "XPHB"], 3, [
    { kind: "active" },
    { kind: "attack", weapons: "any", attack: "cha", option: SACRED_WEAPON, while: "active" },
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
  subclassFeature(sorcerer, ["Draconic", "PHB"], ["Dragon Wings", "PHB"], 14, WINGS),
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

const attacks = (count: number): Mechanic[] => [{ kind: "turn", attacks: count }];
const asBonusAction = (...bonusAction: BonusActionAction[]): Mechanic[] => [
  { kind: "turn", bonusAction },
];

/**
 * What a feature changes about a turn: the attacks the Attack action allows, or the standard
 * actions it lets the character take as a bonus action. Invincible Conqueror is recorded with
 * its attack, where it is an effect the player starts. Action Surge adds its action from
 * `LIMITED_USES`, where its uses are recorded.
 */
const TURN_ECONOMY: FeatureMechanics[] = [
  ...(["PHB", "XPHB"] as const).flatMap((source) =>
    ["Barbarian", "Fighter", "Monk", "Paladin", "Ranger"].map((className) =>
      classFeature([className, source], ["Extra Attack", source], 5, attacks(2)),
    ),
  ),
  classFeature(fighter, ["Extra Attack (2)", "PHB"], 11, attacks(3)),
  classFeature(fighter, ["Extra Attack (3)", "PHB"], 20, attacks(4)),
  classFeature(fighter24, ["Two Extra Attacks", "XPHB"], 11, attacks(3)),
  classFeature(fighter24, ["Three Extra Attacks", "XPHB"], 20, attacks(4)),
  subclassFeature(artificer, ["Armorer", "TCE"], ["Extra Attack", "TCE"], 5, attacks(2)),
  subclassFeature(artificer, ["Battle Smith", "TCE"], ["Extra Attack", "TCE"], 5, attacks(2)),
  subclassFeature(bard, ["Valor", "PHB"], ["Extra Attack", "PHB"], 6, attacks(2)),
  subclassFeature(bard, ["Swords", "XGE"], ["Extra Attack", "XGE"], 6, attacks(2)),
  subclassFeature(wizard, ["Bladesinging", "TCE"], ["Extra Attack", "TCE"], 6, attacks(2)),
  ...(["PHB", "XPHB"] as const).map((source) => ({
    ref: { name: "Thirsting Blade", source },
    mechanics: [{ kind: "turn", attacks: 2, pact: true }] satisfies Mechanic[],
  })),
  ...(["PHB", "XPHB"] as const).map((source) =>
    classFeature(
      ["Rogue", source],
      ["Cunning Action", source],
      2,
      asBonusAction("Dash", "Disengage", "Hide"),
    ),
  ),
  subclassFeature(
    rogue,
    ["Thief", "PHB"],
    ["Fast Hands", "PHB"],
    3,
    asBonusAction("Use an Object"),
  ),
  subclassFeature(
    rogue,
    ["Mastermind", "XGE"],
    ["Master of Tactics", "XGE"],
    3,
    asBonusAction("Help"),
  ),
  {
    ref: {
      name: "Eagle",
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
    mechanics: [{ kind: "turn", bonusAction: ["Dash"], while: "raging" }],
  },
  subclassFeature(monk, ["Astral Self", "TCE"], ["Awakened Astral Self", "TCE"], 17, [
    {
      kind: "turn",
      attacks: 3,
      option: "when every attack is made with your astral arms",
    },
  ]),
  subclassFeature(ranger, ["Horizon Walker", "XGE"], ["Distant Strike", "XGE"], 11, [
    {
      kind: "turn",
      more: 1,
      option: "against a third creature, after attacking two different ones",
    },
  ]),
  classFeature(ranger, ["Vanish", "PHB"], 14, asBonusAction("Hide")),
  classFeature(monk, ["Patient Defense", "PHB"], 2, asBonusAction("Dodge")),
  classFeature(monk, ["Step of the Wind", "PHB"], 2, asBonusAction("Disengage", "Dash")),
  // The second action of each comes with a focus point spent.
  classFeature(monk24, ["Patient Defense", "XPHB"], 2, asBonusAction("Disengage", "Dodge")),
  classFeature(monk24, ["Step of the Wind", "XPHB"], 2, asBonusAction("Dash", "Disengage")),
];

/**
 * Uses whose count the content build cannot read from the text: tied to a modifier, raised
 * at a level, or one limit among several parts.
 */
const LIMITED_USES: FeatureMechanics[] = [
  ...(["PHB", "XPHB"] as const).map((source) =>
    classFeature(["Fighter", source], ["Action Surge", source], 2, [
      { kind: "uses", count: 1, reset: "short", scales: [{ level: 17, count: 2 }] },
      { kind: "turn", action: true },
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
  narrative({
    name: "Signature Spells",
    source: "XPHB",
    className: "Wizard",
    classSource: "XPHB",
    level: 20,
  }),
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
  // Accursed Specter, Cauterizing Flames, Defensive Field and Restorative
  // Reagents give hit points or temporary hit points no heal or tempHp term records yet, so
  // they count their uses alone.
  ...(
    [
      [artificer, "Restorative Reagents", ["Alchemist", "TCE"], "TCE", 9, "int"],
      [artificer, "Defensive Field", ["Armorer", "TCE"], "TCE", 3, "proficiency"],
      [artificer, "Guardian", ["Armorer", "TCE"], "TCE", 15, "proficiency"],
      [barbarian, "Magic Awareness", ["Wild Magic", "TCE"], "TCE", 3, "proficiency"],
      [barbarian, "Infectious Fury", ["Beast", "TCE"], "TCE", 10, "proficiency"],
      [bard, "Infectious Inspiration", ["Eloquence", "TCE"], "TCE", 14, "cha"],
      [cleric, "Eyes of the Grave", ["Grave", "XGE"], "XGE", 1, "wis"],
      [cleric, "Sentinel at Death's Door", ["Grave", "XGE"], "XGE", 6, "wis"],
      [cleric, "Embodiment of the Law", ["Order", "TCE"], "TCE", 6, "wis"],
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
      [sorcerer, "Restore Balance", ["Clockwork Soul", "TCE"], "TCE", 1, "proficiency"],
      [warlock, "Tentacle of the Deeps", ["Fathomless", "TCE"], "TCE", 1, "proficiency"],
      [warlock, "Bottled Respite", ["Genie", "TCE"], "TCE", 1, 1],
      [warlock, "Elemental Gift", ["Genie", "TCE"], "TCE", 6, "proficiency"],
      [warlock, "Accursed Specter", ["Hexblade", "XGE"], "XGE", 6, 1],
    ] as const
  ).map(([owner, name, [shortName, subclassSource], source, level, count]) =>
    subclassFeature(owner, [shortName, subclassSource], [name, source], level, [
      { kind: "uses", count, reset: "long" },
    ]),
  ),
  subclassFeature(rogue, ["Phantom", "TCE"], ["Ghost Walk", "TCE"], 13, [
    { kind: "uses", count: 1, reset: "long", restoredBy: "soulTrinket" },
  ]),
  subclassFeature(wizard, ["Scribes", "TCE"], ["Manifest Mind", "TCE"], 6, [
    { kind: "uses", count: "proficiency", reset: "long" },
    { kind: "uses", count: 1, reset: "long", part: "conjuring" },
  ]),
  subclassFeature(barbarian, ["Wild Magic", "TCE"], ["Bolstering Magic", "TCE"], 6, [
    { kind: "uses", count: "proficiency", reset: "long" },
    {
      kind: "attack",
      dice: "1d3",
      option: "for the 10 minutes Bolstering Magic lasts on you",
    },
  ]),
  subclassFeature(cleric, ["Peace", "TCE"], ["Emboldening Bond", "TCE"], 1, [
    { kind: "uses", count: "proficiency", reset: "long" },
    {
      kind: "attack",
      dice: "1d4",
      oncePerTurn: true,
      option: "once a turn while a bonded creature is within 30 feet",
    },
  ]),
  subclassFeature(wizard, ["Divination", "PHB"], ["The Third Eye", "PHB"], 10, [
    { kind: "uses", count: 1, reset: "short" },
  ]),
  subclassFeature(bard, ["Whispers", "XGE"], ["Mantle of Whispers", "XGE"], 6, [
    { kind: "uses", count: 1, reset: "short" },
  ]),
  // Twice the proficiency bonus in Psionic Energy dice; the bonus action that regains one is
  // the `recovery` count, restored by a short rest.
  ...(["Psi Warrior", "Soulknife"] as const).map((shortName) =>
    subclassFeature(
      shortName === "Psi Warrior" ? fighter : rogue,
      [shortName, "TCE"],
      ["Psionic Power", "TCE"],
      3,
      [
        { kind: "uses", count: "proficiency", times: 2, reset: "long" },
        { kind: "regain", target: "uses", count: 1 },
        { kind: "uses", count: 1, reset: "short", part: "recovery" },
      ],
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
    { name: "Telepathic", source: "TCE" },
  ].map(
    (ref): FeatureMechanics => ({
      ref,
      mechanics: [{ kind: "uses", count: 1, reset: "long" }, SPELLS],
    }),
  ),
  ...[
    { name: "Magic Initiate", source: "PHB" },
    { name: "Artificer Initiate", source: "TCE" },
  ].map(
    (ref): FeatureMechanics => ({
      ref,
      mechanics: [{ kind: "uses", count: 1, reset: "long" }, SPELLS],
    }),
  ),
  {
    ref: { name: "Fey Teleportation", source: "XGE" },
    mechanics: [{ kind: "uses", count: 1, reset: "short" }, SPELLS],
  },
  {
    ref: { name: "Second Chance", source: "XGE" },
    mechanics: [{ kind: "uses", count: 1, reset: "short", restoredBy: "initiative" }],
  },
  // Its free casts are a count per spell, left to the spells a feature grants.
  subclassFeature(artificer, ["Alchemist", "TCE"], ["Chemical Mastery", "TCE"], 15, [
    { kind: "defense", resist: ["acid", "poison"], conditionImmune: ["poisoned"] },
  ]),
  // Each casts each of its spells free once a long rest, a count per spell, so it counts no uses.
  ...[
    { name: "Fey Touched", source: "TCE" },
    { name: "Shadow Touched", source: "TCE" },
    { name: "Drow High Magic", source: "XGE" },
    { name: "Wood Elf Magic", source: "XGE" },
  ].map((ref): FeatureMechanics => ({ ref, mechanics: [SPELLS] })),
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
  // A use the player restores once the 1d4 long rests have passed, which no rest does.
  {
    ref: {
      name: "Limited Wish",
      source: "TCE",
      className: "Warlock",
      classSource: "PHB",
      subclass: { shortName: "Genie", source: "TCE" },
      level: 14,
    },
    mechanics: [{ kind: "uses", count: 1, reset: "manual" }],
  },
  // The stored spell's uses; a long rest is when a new spell replaces it.
  {
    ref: {
      name: "Spell-Storing Item",
      source: "TCE",
      className: "Artificer",
      classSource: "TCE",
      level: 11,
    },
    mechanics: [{ kind: "uses", count: "int", times: 2, minimum: 2, reset: "long" }],
  },
  // Its twice per rune is each rune's own count, which RUNE_USES scales.
  narrative({
    name: "Master of Runes",
    source: "TCE",
    className: "Fighter",
    classSource: "PHB",
    subclass: { shortName: "Rune Knight", source: "TCE" },
    level: 15,
  }),
];

/** The runes whose records carry only their uses. */
const RUNES_INVOKED: FeatureMechanics[] = [
  "Cloud Rune",
  "Frost Rune",
  "Hill Rune",
  "Stone Rune",
].map((name) => ({ ref: { name, source: "TCE" }, mechanics: [RUNE_USES] }));

/**
 * The feats, optional features and race traits that grant spells outright or leave them to
 * the player's pick, and count no uses.
 */
const SPELLS_GRANTED: FeatureMechanics[] = [
  { name: "Telekinetic", source: "TCE" },
  { name: "Ritual Caster", source: "PHB" },
  { name: "Spell Sniper", source: "PHB" },
  { name: "Blessed Warrior", source: "TCE" },
  { name: "Druidic Warrior", source: "TCE" },
  ...[
    "Armor of Shadows",
    "Ascendant Step",
    "Beast Speech",
    "Eldritch Sight",
    "Fiendish Vigor",
    "Mask of Many Faces",
    "Master of Myriad Forms",
    "Misty Visions",
    "Otherworldly Leap",
    "Pact of the Chain",
    "Pact of the Tome",
    "Book of Ancient Secrets",
    "Visions of Distant Realms",
    "Whispers of the Grave",
    "Breath of Winter",
    "Clench of the North Wind",
    "Eternal Mountain Defense",
    "Fist of Four Thunders",
    "Flames of the Phoenix",
    "Gong of the Summit",
    "Mist Stance",
    "Ride the Wind",
    "River of Hungry Flame",
    "Rush of the Gale Spirits",
    "Sweeping Cinder Strike",
    "Wave of Rolling Earth",
  ].map((name) => ({ name, source: "PHB" })),
  { name: "Shroud of Shadow", source: "XGE" },
  { name: "Far Scribe", source: "TCE" },
].map((ref) => ({ ref, mechanics: [SPELLS] }));

/**
 * The PHB invocations whose spell the text has cast "using a warlock spell slot", once a long
 * rest, and Chains of Carceri, which casts its spell at will and limits only its use on one
 * creature, which the sheet leaves to the player.
 */
const SPELLS_BY_INVOCATION: FeatureMechanics[] = [
  ...[
    "Bewitching Whispers",
    "Dreadful Word",
    "Minions of Chaos",
    "Mire the Mind",
    "Sculptor of Flesh",
    "Sign of Ill Omen",
    "Thief of Five Fates",
  ].map((name) => ({ ref: { name, source: "PHB" }, mechanics: [SPELLS_BY_SLOT] })),
  {
    ref: { name: "Chains of Carceri", source: "PHB" },
    mechanics: [SPELLS_AT_WILL],
  },
];

/** The one arcanum spell a PHB feature gives, cast once without a slot between long rests. */
const ARCANUM_USES: Mechanic = { kind: "uses", count: 1, reset: "long" };

const spellPicks = (...picks: { count: number; level?: number; from: string }[]): Mechanic[] => [
  { kind: "spells", picks },
];

/** The class and subclass features that have the player pick spells no `additionalSpells` lists. */
const SPELLS_PICKED: FeatureMechanics[] = [
  ...[10, 14, 18].map((level) =>
    classFeature(bard, ["Magical Secrets", "PHB"], level, spellPicks({ count: 2, from: "any" })),
  ),
  subclassFeature(
    bard,
    ["Lore", "PHB"],
    ["Additional Magical Secrets", "PHB"],
    6,
    spellPicks({ count: 2, from: "any" }),
  ),
  ...[
    [11, 6],
    [13, 7],
    [15, 8],
    [17, 9],
  ].map(([level, spell]) =>
    classFeature(warlock, [`Mystic Arcanum (${spell}th level)`, "PHB"], level as number, [
      ...spellPicks({ count: 1, level: spell as number, from: "Warlock" }),
      ARCANUM_USES,
    ]),
  ),
  classFeature(
    wizard,
    ["Spell Mastery", "PHB"],
    18,
    spellPicks({ count: 1, level: 1, from: "book" }, { count: 1, level: 2, from: "book" }),
  ),
  classFeature(
    wizard,
    ["Signature Spells", "PHB"],
    20,
    spellPicks({ count: 2, level: 3, from: "book" }),
  ),
];

type GrantingFeature = [
  className: string,
  subclass: [shortName: string, source: string] | undefined,
  name: string,
  source: string,
  level: number,
];

/** The classic class and subclass features that grant spells outright, domain and oath lists included. */
const FEATURES_GRANTING_SPELLS: GrantingFeature[] = [
  ["Cleric", undefined, "Divine Domain", "PHB", 1],
  ["Paladin", undefined, "Sacred Oath", "PHB", 3],
  ["Artificer", ["Alchemist", "TCE"], "Alchemist Spells", "TCE", 3],
  ["Artificer", ["Armorer", "TCE"], "Armorer Spells", "TCE", 3],
  ["Artificer", ["Artillerist", "TCE"], "Artillerist Spells", "TCE", 3],
  ["Artificer", ["Battle Smith", "TCE"], "Battle Smith Spells", "TCE", 3],
  ["Barbarian", ["Ancestral Guardian", "XGE"], "Consult the Spirits", "XGE", 10],
  ["Barbarian", ["Totem Warrior", "PHB"], "Spirit Seeker", "PHB", 3],
  ["Barbarian", ["Totem Warrior", "PHB"], "Spirit Walker", "PHB", 10],
  ["Bard", ["Glamour", "XGE"], "Mantle of Majesty", "XGE", 6],
  ["Cleric", ["Death", "DMG"], "Death Domain", "DMG", 1],
  ["Cleric", ["Forge", "XGE"], "Forge Domain", "XGE", 1],
  ["Cleric", ["Grave", "XGE"], "Grave Domain", "XGE", 1],
  ["Cleric", ["Knowledge", "PHB"], "Knowledge Domain", "PHB", 1],
  ["Cleric", ["Life", "PHB"], "Life Domain", "PHB", 1],
  ["Cleric", ["Light", "PHB"], "Bonus Cantrip", "PHB", 1],
  ["Cleric", ["Light", "PHB"], "Light Domain", "PHB", 1],
  ["Cleric", ["Nature", "PHB"], "Nature Domain", "PHB", 1],
  ["Cleric", ["Order", "TCE"], "Order Domain", "TCE", 1],
  ["Cleric", ["Peace", "TCE"], "Peace Domain", "TCE", 1],
  ["Cleric", ["Tempest", "PHB"], "Tempest Domain", "PHB", 1],
  ["Cleric", ["Trickery", "PHB"], "Trickery Domain", "PHB", 1],
  ["Cleric", ["Twilight", "TCE"], "Twilight Domain", "TCE", 1],
  ["Cleric", ["War", "PHB"], "War Domain", "PHB", 1],
  ["Druid", ["Land", "PHB"], "Circle Spells", "PHB", 2],
  ["Druid", ["Moon", "PHB"], "Thousand Forms", "PHB", 14],
  ["Druid", ["Spores", "TCE"], "Circle Spells", "TCE", 2],
  ["Druid", ["Wildfire", "TCE"], "Circle Spells", "TCE", 2],
  ["Fighter", ["Psi Warrior", "TCE"], "Telekinetic Master", "TCE", 18],
  ["Monk", ["Open Hand", "PHB"], "Tranquility", "PHB", 11],
  ["Monk", ["Shadow", "PHB"], "Shadow Arts", "PHB", 3],
  ["Monk", ["Sun Soul", "XGE"], "Searing Arc Strike", "XGE", 6],
  ["Paladin", ["Ancients", "PHB"], "Oath Spells", "PHB", 3],
  ["Paladin", ["Conquest", "XGE"], "Oath Spells", "XGE", 3],
  ["Paladin", ["Devotion", "PHB"], "Oath Spells", "PHB", 3],
  ["Paladin", ["Glory", "TCE"], "Oath Spells", "TCE", 3],
  ["Paladin", ["Oathbreaker", "DMG"], "Oathbreaker Spells", "DMG", 3],
  ["Paladin", ["Redemption", "XGE"], "Oath Spells", "XGE", 3],
  ["Paladin", ["Vengeance", "PHB"], "Oath Spells", "PHB", 3],
  ["Paladin", ["Watchers", "TCE"], "Oath Spells", "TCE", 3],
  ["Ranger", ["Fey Wanderer", "TCE"], "Fey Wanderer Magic", "TCE", 3],
  ["Ranger", ["Gloom Stalker", "XGE"], "Gloom Stalker Magic", "XGE", 3],
  ["Ranger", ["Horizon Walker", "XGE"], "Horizon Walker Magic", "XGE", 3],
  ["Ranger", ["Monster Slayer", "XGE"], "Monster Slayer Magic", "XGE", 3],
  ["Ranger", ["Swarmkeeper", "TCE"], "Swarmkeeper Magic", "TCE", 3],
  ["Sorcerer", ["Aberrant Mind", "TCE"], "Psionic Spells", "TCE", 1],
  ["Sorcerer", ["Clockwork Soul", "TCE"], "Clockwork Magic", "TCE", 1],
  ["Sorcerer", ["Divine Soul", "XGE"], "Divine Magic", "XGE", 1],
  ["Warlock", ["Archfey", "PHB"], "The Archfey", "PHB", 1],
  ["Warlock", ["Celestial", "XGE"], "Bonus Cantrips", "XGE", 1],
  ["Warlock", ["Celestial", "XGE"], "The Celestial", "XGE", 1],
  ["Warlock", ["Fathomless", "TCE"], "The Fathomless", "TCE", 1],
  ["Warlock", ["Fiend", "PHB"], "The Fiend", "PHB", 1],
  ["Warlock", ["Genie", "TCE"], "The Genie", "TCE", 1],
  ["Warlock", ["Great Old One", "PHB"], "The Great Old One", "PHB", 1],
  ["Warlock", ["Hexblade", "XGE"], "The Hexblade", "XGE", 1],
  ["Wizard", ["Illusion", "PHB"], "Improved Minor Illusion", "PHB", 2],
];

const SPELLS_FROM_CLASS_FEATURES: FeatureMechanics[] = FEATURES_GRANTING_SPELLS.map(
  ([className, subclass, name, source, level]) => {
    const owner: [string, string] = [className, className === "Artificer" ? "TCE" : "PHB"];
    return subclass
      ? subclassFeature(owner, subclass, [name, source], level, [SPELLS])
      : classFeature(owner, [name, source], level, [SPELLS]);
  },
);

/** The XPHB (2024) feats and invocations that grant spells, and so count no uses. */
const SPELLS_GRANTED_2024: FeatureMechanics[] = [
  "Armor of Shadows",
  "Ascendant Step",
  "Magic Initiate",
  "Magic Initiate; Cleric",
  "Magic Initiate; Druid",
  "Magic Initiate; Wizard",
  "Mask of Many Faces",
  "Master of Myriad Forms",
  "Misty Visions",
  "One with Shadows",
  "Otherworldly Leap",
  "Pact of the Chain",
  "Pact of the Tome",
  "Visions of Distant Realms",
  "Whispers of the Grave",
].map((name) => ({ ref: { name, source: "XPHB" }, mechanics: [SPELLS] }));

const SPELLS_FROM_CLASS_FEATURES_2024: FeatureMechanics[] = [
  classFeature(cleric24, ["Divine Intervention", "XPHB"], 10, [SPELLS]),
  classFeature(druid24, ["Druidic", "XPHB"], 1, [SPELLS]),
  classFeature(paladin24, ["Faithful Steed", "XPHB"], 5, [SPELLS]),
  classFeature(ranger24, ["Favored Enemy", "XPHB"], 1, [SPELLS]),
  classFeature(paladin24, ["Paladin's Smite", "XPHB"], 2, [SPELLS]),
  classFeature(["Bard", "XPHB"], ["Words of Creation", "XPHB"], 20, [SPELLS]),
  classFeature(["Warlock", "XPHB"], ["Mystic Arcanum", "XPHB"], 11, [
    SPELLS,
    {
      kind: "uses",
      count: 1,
      reset: "long",
      scales: [
        { level: 13, count: 2 },
        { level: 15, count: 3 },
        { level: 17, count: 4 },
      ],
    },
  ]),
  classFeature(["Wizard", "XPHB"], ["Spell Mastery", "XPHB"], 18, [SPELLS]),
  subclassFeature(sorcerer24, ["Draconic", "XPHB"], ["Draconic Spells", "XPHB"], 3, [SPELLS]),
  subclassFeature(["Warlock", "XPHB"], ["Fiend", "XPHB"], ["Fiend Spells", "XPHB"], 3, [SPELLS]),
  subclassFeature(cleric24, ["Life", "XPHB"], ["Life Domain Spells", "XPHB"], 3, [SPELLS]),
  subclassFeature(paladin24, ["Devotion", "XPHB"], ["Oath of Devotion Spells", "XPHB"], 3, [
    SPELLS,
  ]),
  subclassFeature(["Bard", "XPHB"], ["Lore", "XPHB"], ["Magical Discoveries", "XPHB"], 6, [SPELLS]),
  subclassFeature(druid24, ["Land", "XPHB"], ["Natural Recovery", "XPHB"], 6, [SPELLS]),
];

/** Mechanics only, never rules text; the SRD credit that covers the drafting is in `NOTICE`. */
/**
 * Each feature that forces a save and prints its DC, or the feature it is an option of does:
 * an ability's modifier, the higher of two, or a class's spell save DC. A feature that does
 * not state its DC, or states a fixed one, is not here.
 */
const SAVE_DCS: FeatureMechanics[] = [
  ...(
    [
      ["Cleric", "PHB", "Channel Divinity", "PHB", 2],
      ["Cleric", "PHB", "Channel Divinity: Turn Undead", "PHB", 2],
    ] as const
  ).map(([className, classSource, name, source, level]) =>
    classFeature([className, classSource], [name, source], level, [
      { kind: "dc", spell: "Cleric" },
    ]),
  ),
  ...([["Paladin", "PHB", "Channel Divinity", "PHB", 3]] as const).map(
    ([className, classSource, name, source, level]) =>
      classFeature([className, classSource], [name, source], level, [
        { kind: "dc", spell: "Paladin" },
      ]),
  ),
  ...(
    [
      ["Cleric", "PHB", "Knowledge", "PHB", "Channel Divinity: Read Thoughts", "PHB", 6],
      ["Cleric", "PHB", "Light", "PHB", "Channel Divinity: Radiance of the Dawn", "PHB", 2],
      ["Cleric", "PHB", "Nature", "PHB", "Channel Divinity: Charm Animals and Plants", "PHB", 2],
      ["Cleric", "PHB", "Order", "TCE", "Channel Divinity: Order's Demand", "TCE", 2],
    ] as const
  ).map(([className, classSource, shortName, subclassSource, name, source, level]) =>
    subclassFeature([className, classSource], [shortName, subclassSource], [name, source], level, [
      { kind: "dc", spell: "Cleric" },
    ]),
  ),
  ...(
    [
      ["Paladin", "PHB", "Ancients", "PHB", "Turn the Faithless", "PHB", 3],
      ["Paladin", "PHB", "Ancients", "PHB", "Nature's Wrath", "PHB", 3],
      ["Paladin", "PHB", "Devotion", "PHB", "Turn the Unholy", "PHB", 3],
      ["Paladin", "PHB", "Vengeance", "PHB", "Abjure Enemy", "PHB", 3],
      ["Paladin", "PHB", "Watchers", "TCE", "Abjure the Extraplanar", "TCE", 3],
      ["Paladin", "PHB", "Watchers", "TCE", "Mortal Bulwark", "TCE", 20],
      ["Paladin", "PHB", "Conquest", "XGE", "Conquering Presence", "XGE", 3],
      ["Paladin", "PHB", "Redemption", "XGE", "Rebuke the Violent", "XGE", 3],
    ] as const
  ).map(([className, classSource, shortName, subclassSource, name, source, level]) =>
    subclassFeature([className, classSource], [shortName, subclassSource], [name, source], level, [
      { kind: "dc", spell: "Paladin" },
    ]),
  ),
  ...(
    [
      ["Artificer", "TCE", "Armorer", "TCE", "Guardian", "TCE", 3],
      ["Artificer", "TCE", "Armorer", "TCE", "Guardian", "TCE", 15],
      ["Artificer", "TCE", "Artillerist", "TCE", "Eldritch Cannon", "TCE", 3],
      ["Artificer", "TCE", "Artillerist", "TCE", "Explosive Cannon", "TCE", 9],
    ] as const
  ).map(([className, classSource, shortName, subclassSource, name, source, level]) =>
    subclassFeature([className, classSource], [shortName, subclassSource], [name, source], level, [
      { kind: "dc", spell: "Artificer" },
    ]),
  ),
  ...(
    [
      ["Bard", "PHB", "Creation", "TCE", "Mote of Potential", "TCE", 3],
      ["Bard", "PHB", "Glamour", "XGE", "Enthralling Performance", "XGE", 3],
      ["Bard", "PHB", "Glamour", "XGE", "Unbreakable Majesty", "XGE", 14],
      ["Bard", "PHB", "Whispers", "XGE", "Words of Terror", "XGE", 3],
      ["Bard", "PHB", "Whispers", "XGE", "Shadow Lore", "XGE", 14],
    ] as const
  ).map(([className, classSource, shortName, subclassSource, name, source, level]) =>
    subclassFeature([className, classSource], [shortName, subclassSource], [name, source], level, [
      { kind: "dc", spell: "Bard" },
    ]),
  ),
  ...(
    [
      ["Druid", "PHB", "Land", "PHB", "Nature's Sanctuary", "PHB", 14],
      ["Druid", "PHB", "Spores", "TCE", "Halo of Spores", "TCE", 2],
      ["Druid", "PHB", "Spores", "TCE", "Spreading Spores", "TCE", 10],
      ["Druid", "PHB", "Wildfire", "TCE", "Summon Wildfire Spirit", "TCE", 2],
    ] as const
  ).map(([className, classSource, shortName, subclassSource, name, source, level]) =>
    subclassFeature([className, classSource], [shortName, subclassSource], [name, source], level, [
      { kind: "dc", spell: "Druid" },
    ]),
  ),
  ...(
    [
      ["Ranger", "PHB", "Fey Wanderer", "TCE", "Beguiling Twist", "TCE", 7],
      ["Ranger", "PHB", "Swarmkeeper", "TCE", "Gathered Swarm", "TCE", 3],
      ["Ranger", "PHB", "Monster Slayer", "XGE", "Magic-User's Nemesis", "XGE", 11],
    ] as const
  ).map(([className, classSource, shortName, subclassSource, name, source, level]) =>
    subclassFeature([className, classSource], [shortName, subclassSource], [name, source], level, [
      { kind: "dc", spell: "Ranger" },
    ]),
  ),
  ...([["Rogue", "PHB", "Arcane Trickster", "PHB", "Spell Thief", "PHB", 17]] as const).map(
    ([className, classSource, shortName, subclassSource, name, source, level]) =>
      subclassFeature(
        [className, classSource],
        [shortName, subclassSource],
        [name, source],
        level,
        [{ kind: "dc", spell: "Rogue" }],
      ),
  ),
  ...(
    [
      ["Sorcerer", "PHB", "Aberrant Mind", "TCE", "Warping Implosion", "TCE", 18],
      ["Sorcerer", "PHB", "Storm", "XGE", "Storm's Fury", "XGE", 14],
    ] as const
  ).map(([className, classSource, shortName, subclassSource, name, source, level]) =>
    subclassFeature([className, classSource], [shortName, subclassSource], [name, source], level, [
      { kind: "dc", spell: "Sorcerer" },
    ]),
  ),
  ...(
    [
      ["Warlock", "PHB", "Archfey", "PHB", "Fey Presence", "PHB", 1],
      ["Warlock", "PHB", "Archfey", "PHB", "Beguiling Defenses", "PHB", 10],
      ["Warlock", "PHB", "Archfey", "PHB", "Dark Delirium", "PHB", 14],
    ] as const
  ).map(([className, classSource, shortName, subclassSource, name, source, level]) =>
    subclassFeature([className, classSource], [shortName, subclassSource], [name, source], level, [
      { kind: "dc", spell: "Warlock" },
    ]),
  ),
  ...(
    [
      ["Wizard", "PHB", "Enchantment", "PHB", "Hypnotic Gaze", "PHB", 2],
      ["Wizard", "PHB", "Enchantment", "PHB", "Instinctive Charm", "PHB", 6],
      ["Wizard", "PHB", "Enchantment", "PHB", "Alter Memories", "PHB", 14],
      ["Wizard", "PHB", "Necromancy", "PHB", "Command Undead", "PHB", 14],
    ] as const
  ).map(([className, classSource, shortName, subclassSource, name, source, level]) =>
    subclassFeature([className, classSource], [shortName, subclassSource], [name, source], level, [
      { kind: "dc", spell: "Wizard" },
    ]),
  ),
  ...([["Investment of the Chain Master", "TCE"]] as const).map(
    ([name, source]): FeatureMechanics => ({
      ref: { name, source },
      mechanics: [{ kind: "dc", spell: "Warlock" }],
    }),
  ),
  ...([["Radiant Weapon", "TCE"]] as const).map(
    ([name, source]): FeatureMechanics => ({
      ref: { name, source },
      mechanics: [{ kind: "dc", spell: "Artificer" }],
    }),
  ),
  ...(
    [
      ["Monk", "PHB", "Ki", "PHB", 2],
      ["Monk", "PHB", "Stunning Strike", "PHB", 5],
    ] as const
  ).map(([className, classSource, name, source, level]) =>
    classFeature([className, classSource], [name, source], level, [KI_DC]),
  ),
  ...(
    [
      ["Monk", "PHB", "Open Hand", "PHB", "Open Hand Technique", "PHB", 3],
      ["Monk", "PHB", "Open Hand", "PHB", "Quivering Palm", "PHB", 17],
      ["Monk", "PHB", "Sun Soul", "XGE", "Searing Sunburst", "XGE", 11],
      ["Monk", "PHB", "Astral Self", "TCE", "Arms of the Astral Self", "TCE", 3],
    ] as const
  ).map(([className, classSource, shortName, subclassSource, name, source, level]) =>
    subclassFeature([className, classSource], [shortName, subclassSource], [name, source], level, [
      KI_DC,
    ]),
  ),
  ...([["Monk", "PHB", "Open Hand", "PHB", "Tranquility", "PHB", 11]] as const).map(
    ([className, classSource, shortName, subclassSource, name, source, level]) =>
      subclassFeature(
        [className, classSource],
        [shortName, subclassSource],
        [name, source],
        level,
        [{ kind: "dc", ability: "wis" }],
      ),
  ),
  ...([["Barbarian", "PHB", "Berserker", "PHB", "Intimidating Presence", "PHB", 10]] as const).map(
    ([className, classSource, shortName, subclassSource, name, source, level]) =>
      subclassFeature(
        [className, classSource],
        [shortName, subclassSource],
        [name, source],
        level,
        [{ kind: "dc", ability: "cha" }],
      ),
  ),
  ...(
    [
      ["Barbarian", "PHB", "Beast", "TCE", "Infectious Fury", "TCE", 10],
      ["Barbarian", "PHB", "Wild Magic", "TCE", "Wild Surge", "TCE", 3],
      ["Barbarian", "PHB", "Storm Herald", "XGE", "Storm Aura", "XGE", 3],
    ] as const
  ).map(([className, classSource, shortName, subclassSource, name, source, level]) =>
    subclassFeature([className, classSource], [shortName, subclassSource], [name, source], level, [
      { kind: "dc", ability: "con" },
    ]),
  ),
  ...(
    [
      ["Barbarian", "PHB", "Storm Herald", "XGE", "Sea", "XGE", 3],
      ["Barbarian", "PHB", "Storm Herald", "XGE", "Sea", "XGE", 6],
      ["Barbarian", "PHB", "Storm Herald", "XGE", "Sea", "XGE", 14],
      ["Barbarian", "PHB", "Storm Herald", "XGE", "Desert", "XGE", 3],
      ["Barbarian", "PHB", "Storm Herald", "XGE", "Desert", "XGE", 6],
      ["Barbarian", "PHB", "Storm Herald", "XGE", "Desert", "XGE", 14],
      ["Barbarian", "PHB", "Storm Herald", "XGE", "Tundra", "XGE", 3],
      ["Barbarian", "PHB", "Storm Herald", "XGE", "Tundra", "XGE", 6],
      ["Barbarian", "PHB", "Storm Herald", "XGE", "Tundra", "XGE", 14],
    ] as const
  ).map(([className, classSource, shortName, subclassSource, name, source, level]) =>
    subclassFeature([className, classSource], [shortName, subclassSource], [name, source], level, [
      { kind: "dc", ability: "con", label: "Storm Aura" },
    ]),
  ),
  ...([["Fighter", "PHB", "Battle Master", "PHB", "Combat Superiority", "PHB", 3]] as const).map(
    ([className, classSource, shortName, subclassSource, name, source, level]) =>
      subclassFeature(
        [className, classSource],
        [shortName, subclassSource],
        [name, source],
        level,
        [{ kind: "dc", ability: ["str", "dex"], label: "Maneuver" }],
      ),
  ),
  ...(
    [
      ["Disarming Attack", "PHB"],
      ["Goading Attack", "PHB"],
      ["Menacing Attack", "PHB"],
      ["Pushing Attack", "PHB"],
      ["Trip Attack", "PHB"],
      ["Superior Technique", "TCE"],
    ] as const
  ).map(
    ([name, source]): FeatureMechanics => ({
      ref: { name, source },
      mechanics: [{ kind: "dc", ability: ["str", "dex"], label: "Maneuver" }],
    }),
  ),
  ...([["Martial Adept", "PHB"]] as const).map(
    ([name, source]): FeatureMechanics => ({
      ref: { name, source },
      mechanics: [{ kind: "dc", ability: ["str", "dex"], label: "Maneuver" }],
    }),
  ),
  ...([["Fighter", "PHB", "Psi Warrior", "TCE", "Telekinetic Thrust", "TCE", 7]] as const).map(
    ([className, classSource, shortName, subclassSource, name, source, level]) =>
      subclassFeature(
        [className, classSource],
        [shortName, subclassSource],
        [name, source],
        level,
        [{ kind: "dc", ability: "int" }],
      ),
  ),
  ...([["Fighter", "PHB", "Rune Knight", "TCE", "Rune Carver", "TCE", 3]] as const).map(
    ([className, classSource, shortName, subclassSource, name, source, level]) =>
      subclassFeature(
        [className, classSource],
        [shortName, subclassSource],
        [name, source],
        level,
        [{ kind: "dc", ability: "con", label: "Rune Magic" }],
      ),
  ),
  ...(
    [
      ["Fire Rune", "TCE"],
      ["Stone Rune", "TCE"],
    ] as const
  ).map(
    ([name, source]): FeatureMechanics => ({
      ref: { name, source },
      mechanics: [{ kind: "dc", ability: "con", label: "Rune Magic" }],
    }),
  ),
  ...([["Fighter", "PHB", "Arcane Archer", "XGE", "Arcane Shot Options", "XGE", 3]] as const).map(
    ([className, classSource, shortName, subclassSource, name, source, level]) =>
      subclassFeature(
        [className, classSource],
        [shortName, subclassSource],
        [name, source],
        level,
        [{ kind: "dc", ability: "int", label: "Arcane Shot" }],
      ),
  ),
  ...(
    [
      ["Banishing Arrow", "XGE"],
      ["Beguiling Arrow", "XGE"],
      ["Enfeebling Arrow", "XGE"],
      ["Grasping Arrow", "XGE"],
      ["Piercing Arrow", "XGE"],
      ["Seeking Arrow", "XGE"],
      ["Shadow Arrow", "XGE"],
    ] as const
  ).map(
    ([name, source]): FeatureMechanics => ({
      ref: { name, source },
      mechanics: [{ kind: "dc", ability: "int", label: "Arcane Shot" }],
    }),
  ),
  ...(
    [
      ["Rogue", "PHB", "Assassin", "PHB", "Death Strike", "PHB", 17],
      ["Rogue", "PHB", "Soulknife", "TCE", "Rend Mind", "TCE", 17],
    ] as const
  ).map(([className, classSource, shortName, subclassSource, name, source, level]) =>
    subclassFeature([className, classSource], [shortName, subclassSource], [name, source], level, [
      { kind: "dc", ability: "dex" },
    ]),
  ),
  ...([["Fighter", "PHB", "Cavalier", "XGE", "Ferocious Charger", "XGE", 15]] as const).map(
    ([className, classSource, shortName, subclassSource, name, source, level]) =>
      subclassFeature(
        [className, classSource],
        [shortName, subclassSource],
        [name, source],
        level,
        [{ kind: "dc", ability: "str" }],
      ),
  ),
  ...([["Dragon Fear", "XGE"]] as const).map(
    ([name, source]): FeatureMechanics => ({
      ref: { name, source },
      mechanics: [{ kind: "dc", ability: "cha" }],
    }),
  ),
];

/** A save DC joins the record its feature already holds, which it takes off the narrative mark, or opens one. */
function withSaveDcs(records: FeatureMechanics[], dcs: FeatureMechanics[]): FeatureMechanics[] {
  const pending = new Map(dcs.map((entry) => [featureMechanicsKey(entry), entry]));
  const merged = records.map((entry) => {
    const key = featureMechanicsKey(entry);
    const dc = pending.get(key);
    if (!dc) return entry;
    pending.delete(key);
    const { narrative: _narrative, ...rest } = entry;
    return { ...rest, mechanics: [...(entry.mechanics ?? []), ...(dc.mechanics ?? [])] };
  });
  return [...merged, ...pending.values()];
}

const ambition: [string, string] = ["Ambition (PSA)", "PSA"];
const knowledge: [string, string] = ["Knowledge (PSA)", "PSA"];
const solidarity: [string, string] = ["Solidarity (PSA)", "PSA"];
const strength: [string, string] = ["Strength (PSA)", "PSA"];
const zeal: [string, string] = ["Zeal (PSA)", "PSA"];
/** A subclass feature of a classic class from `source`, narrative where it carries no mechanics. */
const bookFeature =
  (source: string) =>
  (
    owner: [string, string],
    subclass: [string, string],
    name: string,
    level: number,
    mechanics?: Mechanic[],
  ) =>
    mechanics
      ? subclassFeature(owner, subclass, [name, source], level, mechanics)
      : narrative({
          name,
          source,
          className: owner[0],
          classSource: owner[1],
          subclass: { shortName: subclass[0], source: subclass[1] },
          level,
        });
/** A race trait from `source`, narrative where it carries no mechanics. */
const bookTrait =
  (source: string) =>
  (name: string, races: string[], mechanics?: Mechanic[], level?: number): FeatureMechanics => ({
    ref: { name, source },
    races,
    ...(level && { level }),
    ...(mechanics ? { mechanics } : { narrative: true }),
  });
const domainFeature = bookFeature("PSA");
const amonkhetTrait = bookTrait("PSA");

/**
 * The Amonkhet domains of the Cleric and the races and backgrounds of Plane Shift: Amonkhet.
 * A race trait whose effect the race row already gives, such as a skill, a speed or an
 * immunity, is the narrative mark. Avatar of Battle resists only nonmagical damage, which a
 * defense cannot say, and Oketra's and Rhonas's Blessings lay their bonus on another creature.
 */
const PLANE_SHIFT_AMONKHET: FeatureMechanics[] = [
  ...(
    [
      [cleric, 1, 2],
      [cleric24, 3, 3],
    ] as const
  ).flatMap(([owner, domainLevel, divinityLevel]) => [
    ...(
      [
        [ambition, "Ambition Domain (PSA)"],
        [knowledge, "Knowledge Domain (PSA)"],
        [solidarity, "Solidarity Domain (PSA)"],
        [strength, "Strength Domain (PSA)"],
        [zeal, "Zeal Domain (PSA)"],
      ] as const
    ).map(([domain, name]) => domainFeature(owner, domain, name, domainLevel, [SPELLS])),
    domainFeature(owner, ambition, "Channel Divinity: Invoke Duplicity", divinityLevel, [
      advantageOn("against a creature within 5 feet of both you and your illusion"),
    ]),
    domainFeature(owner, solidarity, "Channel Divinity: Preserve Life", divinityLevel, [
      { kind: "heal", bonus: ["level"], times: 5, others: true },
    ]),
    domainFeature(owner, strength, "Channel Divinity: Feat of Strength", divinityLevel, [
      {
        kind: "attack",
        attack: 10,
        afterRoll: true,
        option: "after a Strength attack roll, using Channel Divinity",
      },
      {
        kind: "roll",
        roll: "save",
        abilities: ["str"],
        bonus: 10,
        against: "using Channel Divinity",
      },
      {
        kind: "roll",
        roll: "check",
        skills: ["athletics"],
        bonus: 10,
        against: "using Channel Divinity",
      },
    ]),
    domainFeature(owner, zeal, "Channel Divinity: Consuming Fervor", divinityLevel),
  ]),
  domainFeature(cleric, ambition, "Warding Flare", 1, [
    { kind: "uses", count: "wis", reset: "long" },
  ]),
  domainFeature(cleric, ambition, "Channel Divinity: Cloak of Shadows", 6),
  domainFeature(cleric, ambition, "Potent Spellcasting", 8),
  domainFeature(cleric, ambition, "Improved Duplicity", 17),
  domainFeature(cleric, solidarity, "Bonus Proficiency", 1, grants({ armor: ["heavy"] })),
  domainFeature(cleric, strength, "Bonus Proficiency", 1, grants({ armor: ["heavy"] })),
  domainFeature(
    cleric,
    zeal,
    "Bonus Proficiencies",
    1,
    grants({ armor: ["heavy"], weapons: ["martial"] }),
  ),
  domainFeature(cleric, solidarity, "Solidarity's Action", 1, [
    { kind: "uses", count: "wis", reset: "long" },
  ]),
  domainFeature(cleric, zeal, "Priest of Zeal", 1, [{ kind: "uses", count: "wis", reset: "long" }]),
  domainFeature(cleric, strength, "Acolyte of Strength", 1, [
    skillsOf(1, ["animal handling", "athletics", "nature", "survival"]),
    ...spellPicks({ count: 1, level: 0, from: "Druid" }),
  ]),
  domainFeature(cleric, solidarity, "Oketra's Blessing", 6),
  domainFeature(cleric, strength, "Rhonas's Blessing", 6),
  domainFeature(cleric, zeal, "Resounding Strike", 6),
  ...[solidarity, strength, zeal].map((domain) =>
    domainFeature(cleric, domain, "Divine Strike", 8, [
      {
        kind: "extraDamage",
        dice: "1d8",
        scales: [{ level: 14, dice: "2d8" }],
        unarmed: true,
        oncePerTurn: true,
        option: ON_A_HIT,
      },
    ]),
  ),
  domainFeature(cleric, solidarity, "Supreme Healing", 17),
  domainFeature(cleric, strength, "Avatar of Battle", 17),
  // Its one use is the catalog's.
  domainFeature(cleric, zeal, "Blaze of Glory", 17),
  amonkhetTrait("Flight", ["Aven|PSA"]),
  amonkhetTrait("Hawkeyed", ["Aven|PSA|Hawk-Headed|PSA"]),
  amonkhetTrait(
    "Kefnet's Blessing",
    ["Aven|PSA|Ibis-Headed|PSA"],
    [{ kind: "halfProficiency", abilities: ["int"], rounding: "down" }],
  ),
  amonkhetTrait("Khenra Weapon Training", ["Khenra|PSA"]),
  amonkhetTrait("Khenra Twins", ["Khenra|PSA"]),
  amonkhetTrait("Menacing", ["Minotaur (Amonkhet)|PSA"]),
  amonkhetTrait("Natural Weapon", ["Minotaur (Amonkhet)|PSA"]),
  amonkhetTrait(
    "Relentless Endurance",
    ["Minotaur (Amonkhet)|PSA"],
    [
      { kind: "heal", bonus: [1] },
      { kind: "uses", count: 1, reset: "long" },
    ],
  ),
  amonkhetTrait("Savage Attacks", ["Minotaur (Amonkhet)|PSA"]),
  amonkhetTrait("Natural Weapons", ["Naga|PSA"], [{ kind: "dc", ability: "con", label: "Bite" }]),
  amonkhetTrait("Poison Affinity", ["Naga|PSA"]),
  amonkhetTrait("Poison Immunity", ["Naga|PSA"]),
  amonkhetTrait(
    "Speed Burst",
    ["Naga|PSA"],
    [{ kind: "active" }, { kind: "speed", bonus: 5, while: "active" }],
  ),
  amonkhetTrait("Skills", ["Human|PHB|Amonkhet|PSA"]),
  amonkhetTrait("Feat", ["Human|PHB|Amonkhet|PSA"]),
  ...["Shelter of Dissenters", "Trials of the Five Gods", "Voice of Authority"].map((name) =>
    narrative({ name, source: "PSA" }),
  ),
];

const death: [string, string] = ["Death", "DMG"];
const oathbreaker: [string, string] = ["Oathbreaker", "DMG"];
const dmgFeature = bookFeature("DMG");
const dmgTrait = bookTrait("DMG");
const hideIn = (terrain?: string): Mechanic => ({
  kind: "roll",
  roll: "check",
  skills: ["stealth"],
  advantage: true,
  against: terrain ? `to hide in ${terrain}` : "to hide",
});
const NEAR_AN_ALLY = "against a creature within 5 feet of an ally that isn't incapacitated";

/**
 * The Death domain, the Oathbreaker, the monster races and the Eladrin of the Dungeon Master's
 * Guide. A race trait whose effect the race row already gives, such as a sense, a defense, a
 * weapon or a speed, is the narrative mark. So is an effect no vocabulary term holds: Touch of
 * Death's 5 plus twice the cleric level, resistance to nonmagical damage alone, a natural
 * weapon's die, disadvantage, and an effect on another creature.
 */
const DUNGEON_MASTERS_GUIDE: FeatureMechanics[] = [
  dmgFeature(cleric24, death, "Death Domain", 3, [SPELLS]),
  dmgFeature(cleric, death, "Bonus Proficiency", 1, grants({ weapons: ["martial"] })),
  // Reaper's cantrip is necromancy; a pick holds no school, so the sheet does not enforce it.
  dmgFeature(cleric, death, "Reaper", 1, spellPicks({ count: 1, level: 0, from: "any" })),
  dmgFeature(cleric, death, "Channel Divinity: Touch of Death", 2),
  dmgFeature(cleric24, death, "Channel Divinity: Touch of Death", 3),
  dmgFeature(cleric, death, "Inescapable Destruction", 6),
  dmgFeature(cleric, death, "Divine Strike", 8, [
    {
      kind: "extraDamage",
      dice: "1d8",
      scales: [{ level: 14, dice: "2d8" }],
      type: "necrotic",
      unarmed: true,
      oncePerTurn: true,
      option: ON_A_HIT,
    },
  ]),
  dmgFeature(cleric, death, "Improved Reaper", 17),
  dmgFeature(paladin, oathbreaker, "Oathbreaker", 3),
  dmgFeature(paladin, oathbreaker, "Channel Divinity", 3),
  dmgFeature(paladin, oathbreaker, "Control Undead", 3, [{ kind: "dc", spell: "Paladin" }]),
  dmgFeature(paladin, oathbreaker, "Dreadful Aspect", 3, [{ kind: "dc", spell: "Paladin" }]),
  dmgFeature(paladin, oathbreaker, "Aura of Hate", 7, [
    { kind: "extraDamage", dice: "cha", weapons: "melee" },
  ]),
  dmgFeature(paladin, oathbreaker, "Supernatural Resistance", 15),
  dmgFeature(paladin, oathbreaker, "Dread Lord", 20, [
    { kind: "active" },
    { kind: "uses", count: 1, reset: "long" },
  ]),
  dmgTrait(
    "Darkvision",
    [
      "Aasimar",
      "Gnoll",
      "Goblin",
      "Hobgoblin",
      "Kobold",
      "Orc",
      "Skeleton",
      "Troglodyte",
      "Zombie",
    ].map((race) => `${race}|DMG`),
  ),
  dmgTrait("Superior Darkvision", ["Gnome (Deep)|DMG", "Kuo-Toa|DMG"]),
  dmgTrait("Amphibious", ["Bullywug|DMG", "Kuo-Toa|DMG", "Merfolk|DMG"]),
  dmgTrait("Sunlight Sensitivity", ["Kobold|DMG", "Kuo-Toa|DMG", "Troglodyte|DMG"]),
  dmgTrait("Undead Nature", ["Skeleton|DMG", "Zombie|DMG"]),
  dmgTrait("Stone Camouflage", ["Gnome (Deep)|DMG", "Grimlock|DMG"], [hideIn("rocky terrain")]),
  dmgTrait(
    "Natural Armor",
    ["Lizardfolk|DMG", "Troglodyte|DMG"],
    [
      { kind: "armorClass", value: 3, races: ["Lizardfolk|DMG"] },
      { kind: "armorClass", value: 1, races: ["Troglodyte|DMG"] },
    ],
  ),
  dmgTrait(
    "Dive Attack",
    ["Aarakocra|DMG"],
    [
      {
        kind: "extraDamage",
        dice: "1d6",
        weapons: "melee",
        option: "after flying at least 30 feet straight toward the target",
      },
    ],
  ),
  dmgTrait("Talons", ["Aarakocra|DMG"]),
  dmgTrait("Celestial Resistance", ["Aasimar|DMG"]),
  dmgTrait("Celestial Legacy", ["Aasimar|DMG"], [SPELLS]),
  dmgTrait("Speak with Frogs and Toads", ["Bullywug|DMG"]),
  dmgTrait("Swamp Camouflage", ["Bullywug|DMG"], [hideIn("swampy terrain")]),
  dmgTrait("Standing Leap", ["Bullywug|DMG"]),
  dmgTrait("Bite", ["Gnoll|DMG"]),
  dmgTrait("Rampage", ["Gnoll|DMG"]),
  dmgTrait("Innate Spellcasting", ["Gnome (Deep)|DMG"], [SPELLS]),
  dmgTrait(
    "Gnome Cunning",
    ["Gnome (Deep)|DMG"],
    [
      {
        kind: "roll",
        roll: "save",
        abilities: ["int", "wis", "cha"],
        advantage: true,
        against: "against magic",
      },
    ],
  ),
  dmgTrait("Nimble Escape", ["Goblin|DMG"], asBonusAction("Disengage", "Hide")),
  dmgTrait("Blindsight", ["Grimlock|DMG"], [{ kind: "defense", conditionImmune: ["blinded"] }]),
  dmgTrait(
    "Keen Hearing and Smell",
    ["Grimlock|DMG"],
    [
      {
        kind: "roll",
        roll: "check",
        skills: ["perception"],
        advantage: true,
        against: "that rely on hearing or smell",
      },
    ],
  ),
  dmgTrait(
    "Martial Advantage",
    ["Hobgoblin|DMG"],
    [{ kind: "extraDamage", dice: "2d6", oncePerTurn: true, option: NEAR_AN_ALLY }],
  ),
  dmgTrait(
    "Ambusher",
    ["Kenku|DMG"],
    [advantageOn("in the first round, against a surprised creature")],
  ),
  dmgTrait("Mimicry", ["Kenku|DMG"]),
  dmgTrait("Pack Tactics", ["Kobold|DMG"], [advantageOn(NEAR_AN_ALLY)]),
  dmgTrait("Otherworldly Perception", ["Kuo-Toa|DMG"]),
  dmgTrait(
    "Slippery",
    ["Kuo-Toa|DMG"],
    (["check", "save"] as const).map((roll) => ({
      kind: "roll",
      roll,
      advantage: true,
      against: "to escape a grapple",
    })),
  ),
  dmgTrait("Hold Breath", ["Lizardfolk|DMG"]),
  dmgTrait("Aggressive", ["Orc|DMG"]),
  dmgTrait("Brittle Bones", ["Skeleton|DMG"]),
  dmgTrait("Chameleon Skin", ["Troglodyte|DMG"], [hideIn()]),
  dmgTrait("Stench", ["Troglodyte|DMG"]),
  dmgTrait("Undead Fortitude", ["Zombie|DMG"]),
  dmgTrait("Elf Weapon Training", ["Elf|PHB|Eladrin|DMG"]),
  dmgTrait("Fey Step", ["Elf|PHB|Eladrin|DMG"], [SPELLS]),
];

const ascendantDragon: [string, string] = ["Ascendant Dragon", "FTD"];
const drakewarden: [string, string] = ["Drakewarden", "FTD"];
const ftdFeature = bookFeature("FTD");
const ftdTrait = bookTrait("FTD");
const dragonborn = (ancestry: string, colors: string[]) =>
  [ancestry, ...colors.map((color) => `${ancestry}; ${color}`)].map(
    (kind) => `Dragonborn (${kind})|FTD`,
  );
const CHROMATIC = dragonborn("Chromatic", ["Black", "Blue", "Green", "Red", "White"]);
const GEM = dragonborn("Gem", ["Amethyst", "Crystal", "Emerald", "Sapphire", "Topaz"]);
const METALLIC = dragonborn("Metallic", ["Brass", "Bronze", "Copper", "Gold", "Silver"]);
const TONGUE_OF_DRAGONS: Mechanic = { kind: "pick", fields: ["languages"], count: 1 };

/**
 * The Way of the Ascendant Dragon, the Drakewarden, the dragonborn and the dragon gift feats of
 * Fizban's Treasury of Dragons. A resistance whose damage type the player picks on each use or
 * for the drake, the drake's own statistics, and an effect on another creature beyond its DC
 * are the narrative mark.
 */
const FIZBANS_TREASURY: FeatureMechanics[] = [
  ftdFeature(monk, ascendantDragon, "Way of the Ascendant Dragon", 3),
  ftdFeature(monk, ascendantDragon, "Draconic Disciple", 3, [TONGUE_OF_DRAGONS]),
  ftdFeature(monk, ascendantDragon, "Breath of the Dragon", 3, [KI_DC, PROFICIENCY_USES]),
  ftdFeature(monk, ascendantDragon, "Wings Unfurled", 6, [PROFICIENCY_USES, ...WINGS]),
  ftdFeature(monk, ascendantDragon, "Aspect of the Wyrm", 11, [{ kind: "active" }, KI_DC]),
  ftdFeature(monk, ascendantDragon, "Ascendant Aspect", 17, [
    { kind: "sense", name: "blindsight", range: 10 },
    KI_DC,
  ]),
  ftdFeature(ranger, drakewarden, "Drakewarden", 3),
  ftdFeature(ranger, drakewarden, "Draconic Gift", 3, [SPELLS, TONGUE_OF_DRAGONS]),
  ftdFeature(ranger, drakewarden, "Drake Companion", 3),
  ftdFeature(ranger, drakewarden, "Bond of Fang and Scale", 7),
  ftdFeature(ranger, drakewarden, "Drake's Breath", 11, [{ kind: "dc", spell: "Ranger" }]),
  ftdFeature(ranger, drakewarden, "Perfected Bond", 15, [PROFICIENCY_USES]),
  ftdTrait("Chromatic Ancestry", ["Dragonborn (Chromatic)|FTD"]),
  ftdTrait("Gem Ancestry", ["Dragonborn (Gem)|FTD"]),
  ftdTrait("Metallic Ancestry", ["Dragonborn (Metallic)|FTD"]),
  ftdTrait(
    "Breath Weapon",
    [...CHROMATIC, ...GEM, ...METALLIC],
    [{ kind: "dc", ability: "con" }, PROFICIENCY_USES],
  ),
  ftdTrait("Draconic Resistance", [...CHROMATIC, ...GEM, ...METALLIC]),
  ftdTrait(
    "Chromatic Warding",
    CHROMATIC,
    [
      { kind: "active" },
      {
        kind: "defense",
        raceResistance: true,
        while: "active",
        races: ["Dragonborn (Chromatic)|FTD"],
      },
      ...(
        [
          ["Black", "acid"],
          ["Blue", "lightning"],
          ["Green", "poison"],
          ["Red", "fire"],
          ["White", "cold"],
        ] as const
      ).map(([color, type]) => ({
        kind: "defense" as const,
        immune: [type],
        while: "active" as const,
        races: [`Dragonborn (Chromatic; ${color})|FTD`],
      })),
    ],
    5,
  ),
  ftdTrait("Psionic Mind", GEM),
  ftdTrait("Gem Flight", GEM, WINGS, 5),
  ftdTrait("Metallic Breath Weapon", METALLIC, [{ kind: "dc", ability: "con" }], 5),
  {
    ref: { name: "Gift of the Chromatic Dragon", source: "FTD" },
    mechanics: [
      PROFICIENCY_USES,
      { kind: "uses", count: 1, reset: "long", part: "infusion" },
      {
        kind: "extraDamage",
        dice: "1d4",
        type: "acid, cold, fire, lightning or poison",
        option: "with the weapon Chromatic Infusion touched, for 1 minute",
      },
    ],
  },
  {
    ref: { name: "Gift of the Gem Dragon", source: "FTD" },
    mechanics: [PROFICIENCY_USES, { ...CHOSEN_CASTING_DC, label: "Telekinetic Reprisal" }],
  },
  {
    ref: { name: "Gift of the Metallic Dragon", source: "FTD" },
    mechanics: [SPELLS, PROFICIENCY_USES],
  },
];

const erlwTrait = bookTrait("ERLW");
const erlwRace = (name: string) => `${name}|ERLW`;
const dragonmark = (race: string, mark: string) => `${race}|PHB|${mark}|ERLW`;
const MARK_OF_FINDING = [
  dragonmark("Half-Orc", "Variant; Mark of Finding"),
  dragonmark("Human", "Variant; Mark of Finding"),
];
const DRAGONMARKS = [
  dragonmark("Dwarf", "Mark of Warding"),
  dragonmark("Elf", "Mark of Shadow"),
  dragonmark("Gnome", "Mark of Scribing"),
  dragonmark("Half-Elf", "Variant; Mark of Detection"),
  dragonmark("Half-Elf", "Variant; Mark of Storm"),
  dragonmark("Halfling", "Mark of Healing"),
  dragonmark("Halfling", "Mark of Hospitality"),
  dragonmark("Human", "Mark of Handling"),
  dragonmark("Human", "Mark of Making"),
  dragonmark("Human", "Mark of Passage"),
  dragonmark("Human", "Mark of Sentinel"),
  ...MARK_OF_FINDING,
];
const shifter = (subrace: string) => `Shifter|ERLW|${subrace}|ERLW`;
const SHIFTERS = ["Beasthide", "Longtooth", "Swiftstride", "Wildhunt"].map(shifter);

/**
 * The races, dragonmarks, feats and background of Eberron: Rising from the Last War. A trait
 * whose effect the race row already gives, such as a sense, a skill, a tool, a defense or a
 * speed, is the narrative mark. So is an effect no vocabulary term holds: a d4 added to a
 * check, extra damage equal to the character's level, a bonus counted from allies in sight,
 * reach, carrying capacity, and an Armor Class bonus that holds only while a double-bladed
 * scimitar is held in two hands. A trait that grants spells records them; the race row lists
 * which.
 */
const EBERRON: FeatureMechanics[] = [
  erlwTrait("Darkvision", [
    ...["Bugbear", "Goblin", "Hobgoblin", "Orc", "Shifter"].map(erlwRace),
    ...MARK_OF_FINDING,
  ]),
  erlwTrait("Long-Limbed", [erlwRace("Bugbear")]),
  erlwTrait("Powerful Build", [erlwRace("Bugbear"), erlwRace("Orc")]),
  erlwTrait("Sneaky", [erlwRace("Bugbear")]),
  erlwTrait(
    "Surprise Attack",
    [erlwRace("Bugbear")],
    [
      {
        kind: "extraDamage",
        dice: "2d6",
        option: "once a combat, on a hit against a creature you surprised, on your first turn",
      },
    ],
  ),
  erlwTrait("Shapechanger", [erlwRace("Changeling")]),
  erlwTrait("Changeling Instincts", [erlwRace("Changeling")]),
  // Its one use is the catalog's.
  erlwTrait("Fury of the Small", [erlwRace("Goblin")]),
  erlwTrait("Nimble Escape", [erlwRace("Goblin")], asBonusAction("Disengage", "Hide")),
  erlwTrait("Martial Training", [erlwRace("Hobgoblin")]),
  // Its one use is the catalog's.
  erlwTrait("Saving Face", [erlwRace("Hobgoblin")]),
  erlwTrait(
    "Dual Mind",
    [erlwRace("Kalashtar")],
    [{ kind: "roll", roll: "save", abilities: ["wis"], advantage: true }],
  ),
  erlwTrait("Mental Discipline", [erlwRace("Kalashtar")]),
  erlwTrait("Mind Link", [erlwRace("Kalashtar")]),
  erlwTrait("Severed from Dreams", [erlwRace("Kalashtar")]),
  erlwTrait("Aggressive", [erlwRace("Orc")]),
  erlwTrait("Primal Intuition", [erlwRace("Orc")]),
  // The minimum of 1 temporary hit point is left to the player; its one use is the catalog's.
  // One record holds a `(name, source)`, so each subrace's benefit while shifted lives here, not
  // on the shared Shifting Feature.
  erlwTrait(
    "Shifting",
    [erlwRace("Shifter")],
    [
      { kind: "active" },
      {
        kind: "tempHp",
        bonus: ["level", "con"],
        races: ["Longtooth", "Swiftstride", "Wildhunt"].map(shifter),
      },
      { kind: "tempHp", dice: "1d6", bonus: ["level", "con"], races: [shifter("Beasthide")] },
      { kind: "armorClass", value: 1, while: "active", races: [shifter("Beasthide")] },
      { kind: "speed", bonus: 10, while: "active", races: [shifter("Swiftstride")] },
      {
        kind: "roll",
        roll: "check",
        abilities: ["wis"],
        advantage: true,
        while: "active",
        races: [shifter("Wildhunt")],
      },
    ],
  ),
  erlwTrait("Shifting Feature", SHIFTERS),
  erlwTrait("Natural Athlete", [shifter("Beasthide")]),
  erlwTrait("Fierce", [shifter("Longtooth")]),
  erlwTrait("Graceful", [shifter("Swiftstride")]),
  erlwTrait("Natural Tracker", [shifter("Wildhunt")]),
  erlwTrait(
    "Constructed Resilience",
    [erlwRace("Warforged")],
    [saveAdvantage("against being poisoned")],
  ),
  erlwTrait("Sentry's Rest", [erlwRace("Warforged")]),
  erlwTrait("Integrated Protection", [erlwRace("Warforged")], [{ kind: "armorClass", value: 1 }]),
  erlwTrait("Specialized Design", [erlwRace("Warforged")]),
  ...(
    [
      ["Warder's Intuition", "Dwarf", "Mark of Warding"],
      ["Cunning Intuition", "Elf", "Mark of Shadow"],
      ["Gifted Scribe", "Gnome", "Mark of Scribing"],
      ["Deductive Intuition", "Half-Elf", "Variant; Mark of Detection"],
      ["Windwright's Intuition", "Half-Elf", "Variant; Mark of Storm"],
      ["Medical Intuition", "Halfling", "Mark of Healing"],
      ["Ever Hospitable", "Halfling", "Mark of Hospitality"],
      ["Wild Intuition", "Human", "Mark of Handling"],
      ["Artisan's Intuition", "Human", "Mark of Making"],
      ["Intuitive Motion", "Human", "Mark of Passage"],
      ["Sentinel's Intuition", "Human", "Mark of Sentinel"],
    ] as const
  ).map(([name, race, mark]) => erlwTrait(name, [dragonmark(race, mark)])),
  erlwTrait("Hunter's Intuition", MARK_OF_FINDING),
  ...(
    [
      ["Wards and Seals", "Dwarf", "Mark of Warding"],
      ["Shape Shadows", "Elf", "Mark of Shadow"],
      ["Scribe's Insight", "Gnome", "Mark of Scribing"],
      ["Magical Detection", "Half-Elf", "Variant; Mark of Detection"],
      ["Headwinds", "Half-Elf", "Variant; Mark of Storm"],
      ["Healing Touch", "Halfling", "Mark of Healing"],
      ["Innkeeper's Magic", "Halfling", "Mark of Hospitality"],
      ["Primal Connection", "Human", "Mark of Handling"],
      // Its one use is the catalog's.
      ["Spellsmith", "Human", "Mark of Making"],
      ["Magical Passage", "Human", "Mark of Passage"],
      ["Guardian's Shield", "Human", "Mark of Sentinel"],
    ] as const
  ).map(([name, race, mark]) => erlwTrait(name, [dragonmark(race, mark)], [SPELLS])),
  erlwTrait("Finder's Magic", MARK_OF_FINDING, [SPELLS]),
  erlwTrait("Spells of the Mark", DRAGONMARKS, [SPELLS]),
  erlwTrait("Storm's Boon", [dragonmark("Half-Elf", "Variant; Mark of Storm")]),
  erlwTrait("Maker's Gift", [dragonmark("Human", "Mark of Making")]),
  erlwTrait("Courier's Speed", [dragonmark("Human", "Mark of Passage")]),
  erlwTrait("The Bigger They Are", [dragonmark("Human", "Mark of Handling")]),
  // Its one use is the catalog's.
  erlwTrait("Vigilant Guardian", [dragonmark("Human", "Mark of Sentinel")]),
  // Its one use is the catalog's; the Hit Die it rolls for temporary hit points is left to the player.
  { ref: { name: "Aberrant Dragonmark", source: "ERLW" }, mechanics: [SPELLS] },
  narrative({ name: "Revenant Blade", source: "ERLW" }),
  narrative({ name: "House Connections", source: "ERLW" }),
];

const mpmmTrait = bookTrait("MPMM");
const mpmm = (...races: string[]) => races.map((race) => `${race}|MPMM`);
const variants = (race: string, ...kinds: string[]) =>
  mpmm(race, ...kinds.map((kind) => `${race}; ${kind}`));
const genasi = (element: string) => `Genasi|MPMM|${element}|MPMM`;
const AASIMARS = variants("Aasimar", "Necrotic Shroud", "Radiant Consumption", "Radiant Soul");
const KOBOLDS = variants("Kobold", "Craftiness", "Defiance", "Draconic Sorcery");
const MPMM_SHIFTERS = variants("Shifter", "Beasthide", "Longtooth", "Swiftstride", "Wildhunt");
const ELVES = mpmm("Eladrin", "Sea Elf", "Shadar-Kai");
const SHIFTED: Mechanic = { kind: "tempHp", bonus: ["proficiency"], times: 2 };
const REVELATION: Mechanic = { kind: "active" };
const revelationDamage = (type: string): Mechanic => ({
  kind: "extraDamage",
  dice: "proficiency",
  type,
  oncePerTurn: true,
  option: "to one target of an attack or a spell, while transformed",
  while: "active",
});
const BY_A_USE = "by spending a use of the trait";

/**
 * The races of Mordenkainen Presents: Monsters of the Multiverse. A trait whose effect the race
 * row already gives, such as a sense, a skill, a tool, a defense, a speed or a cantrip, is the
 * narrative mark. So is an effect no vocabulary term holds: a natural weapon's die, reach,
 * carrying capacity, damage reduced, a die added to a jump or a save, a bonus counted from
 * allies in sight, and an effect on another creature beyond its DC. A trait whose effect starts
 * at 3rd or 5th level is held from the first, as its catalog uses already are. A DC whose
 * ability the player chose for the race reads the highest of the three.
 */
const MONSTERS_OF_THE_MULTIVERSE: FeatureMechanics[] = [
  mpmmTrait("Darkvision", [
    ...AASIMARS,
    ...KOBOLDS,
    ...MPMM_SHIFTERS,
    ...ELVES,
    ...mpmm(
      "Bugbear",
      "Deep Gnome",
      "Duergar",
      "Genasi",
      "Goblin",
      "Hobgoblin",
      "Orc",
      "Tabaxi",
      "Triton",
      "Yuan-Ti",
    ),
  ]),
  mpmmTrait(
    "Fey Ancestry",
    [...ELVES, ...mpmm("Bugbear", "Goblin", "Hobgoblin")],
    [saveAdvantage("against being charmed")],
  ),
  mpmmTrait("Keen Senses", ELVES),
  mpmmTrait("Trance", ELVES),
  mpmmTrait("Powerful Build", mpmm("Bugbear", "Firbolg", "Orc")),
  mpmmTrait("Magic Resistance", mpmm("Satyr", "Yuan-Ti"), [saveAdvantage("against spells")]),
  mpmmTrait("Psychic Resilience", mpmm("Githyanki", "Githzerai")),
  mpmmTrait("Amphibious", [genasi("Water"), ...mpmm("Triton")]),
  mpmmTrait("Hold Breath", mpmm("Lizardfolk", "Tortle")),
  // One record holds a `(name, source)`, so each base names the race it belongs to.
  mpmmTrait("Natural Armor", mpmm("Lizardfolk", "Tortle"), [
    { kind: "unarmoredBase", value: 3, races: mpmm("Lizardfolk") },
    { kind: "unarmoredBase", value: 7, fixed: true, races: mpmm("Tortle") },
  ]),
  mpmmTrait("Nature's Intuition", mpmm("Lizardfolk", "Tortle")),
  mpmmTrait("Flight", mpmm("Aarakocra", "Fairy")),
  mpmmTrait("Talons", mpmm("Aarakocra")),
  // Its one use is the catalog's.
  mpmmTrait("Wind Caller", mpmm("Aarakocra"), [SPELLS]),
  mpmmTrait("Celestial Resistance", AASIMARS),
  // Its one use is the catalog's; the d4s, one per point of proficiency bonus, scale with it.
  mpmmTrait("Healing Hands", AASIMARS, [
    {
      kind: "heal",
      dice: "2d4",
      scales: [
        { level: 5, dice: "3d4" },
        { level: 9, dice: "4d4" },
        { level: 13, dice: "5d4" },
        { level: 17, dice: "6d4" },
      ],
      others: true,
    },
  ]),
  mpmmTrait("Light Bearer", AASIMARS, [SPELLS]),
  // Its one use is the catalog's. The DC and the flight belong to one revelation each, which
  // its own race row records.
  mpmmTrait("Celestial Revelation", mpmm("Aasimar"), [
    REVELATION,
    revelationDamage("necrotic or radiant"),
  ]),
  mpmmTrait("Celestial Revelation (Necrotic Shroud)", mpmm("Aasimar; Necrotic Shroud"), [
    REVELATION,
    { kind: "dc", ability: "cha" },
    revelationDamage("necrotic"),
  ]),
  mpmmTrait("Celestial Revelation (Radiant Consumption)", mpmm("Aasimar; Radiant Consumption"), [
    REVELATION,
    revelationDamage("radiant"),
  ]),
  mpmmTrait("Celestial Revelation (Radiant Soul)", mpmm("Aasimar; Radiant Soul"), [
    REVELATION,
    { kind: "speed", equalToWalk: ["fly"], while: "active" },
    revelationDamage("radiant"),
  ]),
  mpmmTrait("Long-Limbed", mpmm("Bugbear")),
  mpmmTrait("Sneaky", mpmm("Bugbear")),
  mpmmTrait("Surprise Attack", mpmm("Bugbear"), [
    {
      kind: "extraDamage",
      dice: "2d6",
      option: "on a hit against a creature that hasn't taken a turn yet this combat",
    },
  ]),
  mpmmTrait("Charge", mpmm("Centaur")),
  mpmmTrait("Equine Build", mpmm("Centaur")),
  mpmmTrait("Hooves", mpmm("Centaur")),
  mpmmTrait("Natural Affinity", mpmm("Centaur")),
  mpmmTrait("Changeling Instincts", mpmm("Changeling")),
  mpmmTrait("Shapechanger", mpmm("Changeling")),
  mpmmTrait("Gift of the Svirfneblin", mpmm("Deep Gnome"), [SPELLS]),
  mpmmTrait("Gnomish Magic Resistance", mpmm("Deep Gnome"), [
    {
      kind: "roll",
      roll: "save",
      abilities: ["int", "wis", "cha"],
      advantage: true,
      against: "against spells",
    },
  ]),
  mpmmTrait("Svirfneblin Camouflage", mpmm("Deep Gnome"), [
    PROFICIENCY_USES,
    { kind: "roll", roll: "check", skills: ["stealth"], advantage: true, against: BY_A_USE },
  ]),
  mpmmTrait("Duergar Magic", mpmm("Duergar"), [SPELLS]),
  mpmmTrait("Dwarven Resilience", mpmm("Duergar"), [saveAdvantage("against being poisoned")]),
  mpmmTrait("Psionic Fortitude", mpmm("Duergar"), [
    saveAdvantage("against being charmed or stunned"),
  ]),
  mpmmTrait("Fey Step", mpmm("Eladrin"), [PROFICIENCY_USES, CHOSEN_CASTING_DC]),
  mpmmTrait("Fairy Magic", mpmm("Fairy"), [SPELLS]),
  mpmmTrait("Firbolg Magic", mpmm("Firbolg"), [SPELLS_ONCE_PER_LONG_REST]),
  mpmmTrait("Hidden Step", mpmm("Firbolg"), [PROFICIENCY_USES]),
  mpmmTrait("Speech of Beast and Leaf", mpmm("Firbolg"), [
    {
      kind: "roll",
      roll: "check",
      abilities: ["cha"],
      advantage: true,
      against: "to influence Beasts and Plants",
    },
  ]),
  mpmmTrait("Unending Breath", [genasi("Air")]),
  mpmmTrait("Lightning Resistance", [genasi("Air")]),
  mpmmTrait("Mingle with the Wind", [genasi("Air")], [SPELLS]),
  mpmmTrait("Earth Walk", [genasi("Earth")]),
  // The uses count casting blade ward as a bonus action.
  mpmmTrait("Merge with Stone", [genasi("Earth")], [SPELLS_ONCE_PER_LONG_REST, PROFICIENCY_USES]),
  mpmmTrait("Fire Resistance", [genasi("Fire")]),
  mpmmTrait("Reach to the Blaze", [genasi("Fire")], [SPELLS]),
  mpmmTrait("Acid Resistance", [genasi("Water")]),
  mpmmTrait("Call to the Wave", [genasi("Water")], [SPELLS]),
  mpmmTrait("Astral Knowledge", mpmm("Githyanki")),
  mpmmTrait("Githyanki Psionics", mpmm("Githyanki"), [SPELLS]),
  mpmmTrait("Githzerai Psionics", mpmm("Githzerai"), [SPELLS]),
  mpmmTrait("Mental Discipline", mpmm("Githzerai"), [saveAdvantage(CHARMED_OR_FRIGHTENED)]),
  mpmmTrait("Fury of the Small", mpmm("Goblin"), [
    PROFICIENCY_USES,
    {
      kind: "extraDamage",
      dice: "proficiency",
      oncePerTurn: true,
      option: "against a creature larger than you",
    },
  ]),
  mpmmTrait("Nimble Escape", mpmm("Goblin"), asBonusAction("Disengage", "Hide")),
  mpmmTrait("Little Giant", mpmm("Goliath")),
  mpmmTrait("Mountain Born", mpmm("Goliath")),
  mpmmTrait("Stone's Endurance", mpmm("Goliath"), [PROFICIENCY_USES]),
  mpmmTrait("Hare-Trigger", mpmm("Harengon"), [
    { kind: "bonus", target: "initiative", value: "proficiency" },
  ]),
  mpmmTrait("Leporine Senses", mpmm("Harengon")),
  mpmmTrait("Lucky Footwork", mpmm("Harengon")),
  mpmmTrait("Rabbit Hop", mpmm("Harengon"), [PROFICIENCY_USES]),
  // The temporary hit points come with one of three options the player picks on each use, so
  // a use never lands them.
  mpmmTrait("Fey Gift", mpmm("Hobgoblin"), [PROFICIENCY_USES, ...asBonusAction("Help")]),
  mpmmTrait("Fortune from the Many", mpmm("Hobgoblin"), [PROFICIENCY_USES]),
  mpmmTrait("Expert Duplication", mpmm("Kenku"), [
    {
      kind: "roll",
      roll: "check",
      advantage: true,
      against: "to duplicate writing or craftwork exactly",
    },
  ]),
  mpmmTrait("Kenku Recall", mpmm("Kenku"), [
    PROFICIENCY_USES,
    {
      kind: "roll",
      roll: "check",
      advantage: true,
      against: `with a skill you're proficient in, ${BY_A_USE}`,
    },
  ]),
  mpmmTrait("Mimicry", mpmm("Kenku"), [{ kind: "dc", ability: "cha" }]),
  mpmmTrait("Draconic Cry", KOBOLDS, [
    PROFICIENCY_USES,
    advantageOn("against an enemy within 10 feet that heard the cry, until your next turn"),
  ]),
  // Each legacy is a race row of its own, which records it.
  mpmmTrait("Kobold Legacy", mpmm("Kobold")),
  mpmmTrait("Kobold Legacy (Craftiness)", mpmm("Kobold; Craftiness")),
  mpmmTrait("Kobold Legacy (Defiance)", mpmm("Kobold; Defiance"), [
    saveAdvantage("against being frightened"),
  ]),
  mpmmTrait("Kobold Legacy (Draconic Sorcery)", mpmm("Kobold; Draconic Sorcery"), [SPELLS]),
  mpmmTrait("Bite", mpmm("Lizardfolk")),
  mpmmTrait("Hungry Jaws", mpmm("Lizardfolk"), [
    PROFICIENCY_USES,
    { kind: "tempHp", bonus: ["proficiency"] },
  ]),
  mpmmTrait("Horns", mpmm("Minotaur")),
  mpmmTrait("Goring Rush", mpmm("Minotaur")),
  mpmmTrait("Hammering Horns", mpmm("Minotaur"), [{ kind: "dc", ability: "str" }]),
  mpmmTrait("Labyrinthine Recall", mpmm("Minotaur"), [
    {
      kind: "roll",
      roll: "check",
      skills: ["survival"],
      advantage: true,
      against: "to navigate or track",
    },
  ]),
  mpmmTrait("Adrenaline Rush", mpmm("Orc"), [
    PROFICIENCY_USES,
    { kind: "tempHp", bonus: ["proficiency"] },
    ...asBonusAction("Dash"),
  ]),
  // Its one use is the catalog's.
  mpmmTrait("Relentless Endurance", mpmm("Orc"), [{ kind: "heal", bonus: [1] }]),
  mpmmTrait("Ram", mpmm("Satyr")),
  mpmmTrait("Mirthful Leaps", mpmm("Satyr")),
  mpmmTrait("Reveler", mpmm("Satyr")),
  mpmmTrait("Child of the Sea", mpmm("Sea Elf")),
  mpmmTrait("Friend of the Sea", mpmm("Sea Elf")),
  // The resistance from 3rd level holds only until the start of the next turn after a teleport.
  mpmmTrait("Blessing of the Raven Queen", mpmm("Shadar-Kai"), [PROFICIENCY_USES]),
  mpmmTrait("Necrotic Resistance", mpmm("Shadar-Kai")),
  mpmmTrait("Bestial Instincts", MPMM_SHIFTERS),
  mpmmTrait("Shifting", mpmm("Shifter"), [PROFICIENCY_USES, { kind: "active" }, SHIFTED]),
  mpmmTrait("Shifting (Beasthide)", mpmm("Shifter; Beasthide"), [
    PROFICIENCY_USES,
    { kind: "active" },
    { ...SHIFTED, dice: "1d6" },
    { kind: "armorClass", value: 1, while: "active" },
  ]),
  mpmmTrait("Shifting (Longtooth)", mpmm("Shifter; Longtooth"), [
    PROFICIENCY_USES,
    { kind: "active" },
    SHIFTED,
  ]),
  mpmmTrait("Shifting (Swiftstride)", mpmm("Shifter; Swiftstride"), [
    PROFICIENCY_USES,
    { kind: "active" },
    SHIFTED,
    { kind: "speed", bonus: 10, while: "active" },
  ]),
  mpmmTrait("Shifting (Wildhunt)", mpmm("Shifter; Wildhunt"), [
    PROFICIENCY_USES,
    { kind: "active" },
    SHIFTED,
    { kind: "roll", roll: "check", abilities: ["wis"], advantage: true, while: "active" },
  ]),
  mpmmTrait("Cat's Claws", mpmm("Tabaxi")),
  mpmmTrait("Cat's Talent", mpmm("Tabaxi")),
  // Moving 0 feet on a turn restores its use.
  mpmmTrait("Feline Agility", mpmm("Tabaxi"), [{ kind: "uses", count: 1, reset: "manual" }]),
  mpmmTrait("Claws", mpmm("Tortle")),
  mpmmTrait("Shell Defense", mpmm("Tortle"), [
    { kind: "active" },
    { kind: "armorClass", value: 4, while: "active" },
    { kind: "roll", roll: "save", abilities: ["str", "con"], advantage: true, while: "active" },
  ]),
  mpmmTrait("Control Air and Water", mpmm("Triton"), [SPELLS]),
  mpmmTrait("Emissary of the Sea", mpmm("Triton")),
  mpmmTrait("Guardian of the Depths", mpmm("Triton")),
  mpmmTrait("Poison Resilience", mpmm("Yuan-Ti"), [saveAdvantage("against being poisoned")]),
  // Its one use is the catalog's.
  mpmmTrait("Serpentine Spellcasting", mpmm("Yuan-Ti"), [SPELLS]),
];

const giant: [string, string] = ["Giant", "BGG"];
const lunar: [string, string] = ["Lunar", "DSotDQ"];
const pyromancer: [string, string] = ["Pyromancer (PSK)", "PSK"];
const spirits: [string, string] = ["Spirits", "VRGR"];
const undead: [string, string] = ["Undead", "VRGR"];
const warlock24: [string, string] = ["Warlock", "XPHB"];
const dsotdqTrait = bookTrait("DSotDQ");
const mtfTrait = bookTrait("MTF");
const pskTrait = bookTrait("PSK");
const vgmTrait = bookTrait("VGM");
const pszTrait = bookTrait("PSZ");
const vrgrTrait = bookTrait("VRGR");
const psxTrait = bookTrait("PSX");
const eepcTrait = bookTrait("EEPC");
const aagTrait = bookTrait("AAG");
const ggrTrait = bookTrait("GGR");
const motTrait = bookTrait("MOT");
const psiTrait = bookTrait("PSI");
const sccTrait = bookTrait("SCC");
const psdTrait = bookTrait("PSD");
const wbtwTrait = bookTrait("WBtW");
const awmTrait = bookTrait("AWM");
const ogaTrait = bookTrait("OGA");
const lrTrait = bookTrait("LR");
const ttpTrait = bookTrait("TTP");
const aiTrait = bookTrait("AI");
const MAGIC_SAVES: Mechanic = {
  kind: "roll",
  roll: "save",
  abilities: ["int", "wis", "cha"],
  advantage: true,
  against: "against magic",
};
const BEAST_AND_LEAF: Mechanic = {
  kind: "roll",
  roll: "check",
  abilities: ["cha"],
  advantage: true,
  against: "to influence Beasts and Plants",
};
const bggFeature = bookFeature("BGG");
const dsotdqFeature = bookFeature("DSotDQ");
const pskFeature = bookFeature("PSK");
const vrgrFeature = bookFeature("VRGR");
/** Each of `names` as a race or subrace key of `source`. */
const rowsOf =
  (source: string) =>
  (...names: string[]) =>
    names.map((name) => `${name}|${source}`);
const vgm = rowsOf("VGM");
const ggr = rowsOf("GGR");
const mot = rowsOf("MOT");
const aag = rowsOf("AAG");
const psk = rowsOf("PSK");
const psz = rowsOf("PSZ");
const vrgr = rowsOf("VRGR");
const ZENDIKAR_TRIBES = ["Grotag", "Lavastep", "Tuktuk"].map(
  (tribe) => `Goblin|PSZ|Zendikar; ${tribe} Tribe|PSZ`,
);
const TIEFLING_LEGACIES = [
  ["Legacy of Avernus", "Zariel"],
  ["Legacy of Cania", "Mephistopheles"],
  ["Legacy of Dis", "Dispater"],
  ["Legacy of Maladomini", "Baalzebul"],
  ["Legacy of Malbolge", "Glasya"],
  ["Legacy of Minauros", "Mammon"],
  ["Legacy of Phlegethos", "Fierna"],
  ["Legacy of Stygia", "Levistus"],
] as const;
const STRIKE_DC: Mechanic = { kind: "dc", ability: ["str", "con"] };
const STRIKE_OF_THE_GIANTS = "on a hit with a melee or thrown weapon attack";
const strikeOfTheGiants = (
  kind: string,
  dice: string,
  type: string | undefined,
  dc: boolean,
): FeatureMechanics => ({
  ref: { name: `Strike of the Giants; ${kind}`, source: "BGG" },
  mechanics: [
    PROFICIENCY_USES,
    ...(dc ? [STRIKE_DC] : []),
    {
      kind: "extraDamage",
      dice,
      ...(type && { type }),
      oncePerTurn: true,
      option: STRIKE_OF_THE_GIANTS,
    },
  ],
});
const MAGIC_RESISTANCE = saveAdvantage("against spells and other magical effects");
const NATURAL_ARMOR_13: Mechanic = { kind: "unarmoredBase", value: 3 };

/**
 * The Path of the Giant and the giant feats of Bigby Presents: Glory of the Giants. Giant's
 * Havoc adds the Rage Damage bonus, which a column's cell prints as a bonus rather than dice,
 * and a reach no term holds. A background feature that grants one of these feats shares its
 * `(name, source)` and so its record.
 */
const GLORY_OF_THE_GIANTS: FeatureMechanics[] = [
  bggFeature(barbarian, giant, "Path of the Giant", 3),
  bggFeature(barbarian, giant, "Giant Power", 3, [
    SPELLS,
    { kind: "pick", fields: ["languages"], count: 1 },
  ]),
  bggFeature(barbarian, giant, "Giant's Havoc", 3),
  bggFeature(barbarian, giant, "Elemental Cleaver", 6, [
    {
      kind: "extraDamage",
      dice: "1d6",
      scales: [{ level: 14, dice: "2d6" }],
      type: "acid, cold, fire, thunder or lightning",
      option: INFUSED,
      while: "raging",
    },
  ]),
  bggFeature(barbarian, giant, "Mighty Impel", 10, [{ kind: "dc", ability: "str" }]),
  // Its larger Elemental Cleaver die is recorded on Elemental Cleaver's scale.
  bggFeature(barbarian, giant, "Demiurgic Colossus", 14),
  { ref: { name: "Ember of the Fire Giant", source: "BGG" }, mechanics: [PROFICIENCY_USES] },
  { ref: { name: "Fury of the Frost Giant", source: "BGG" }, mechanics: [PROFICIENCY_USES] },
  { ref: { name: "Guile of the Cloud Giant", source: "BGG" }, mechanics: [PROFICIENCY_USES] },
  {
    ref: { name: "Keenness of the Stone Giant", source: "BGG" },
    mechanics: [{ kind: "sense", name: "darkvision", range: 60, raceBonus: 60 }, PROFICIENCY_USES],
  },
  // Its one use is the catalog's.
  { ref: { name: "Rune Shaper", source: "BGG" }, mechanics: [SPELLS] },
  {
    ref: { name: "Soul of the Storm Giant", source: "BGG" },
    mechanics: [
      PROFICIENCY_USES,
      { kind: "active", endsOn: ["incapacitated"] },
      { kind: "defense", resist: ["lightning", "thunder"], while: "active" },
    ],
  },
  // Its damage is the benefit chosen, which each version's own row records.
  {
    ref: { name: "Strike of the Giants", source: "BGG" },
    mechanics: [PROFICIENCY_USES, STRIKE_DC],
  },
  strikeOfTheGiants("Cloud", "1d4", "thunder", true),
  strikeOfTheGiants("Fire", "1d10", "fire", false),
  strikeOfTheGiants("Frost", "1d6", "cold", true),
  strikeOfTheGiants("Hill", "1d6", undefined, true),
  strikeOfTheGiants("Stone", "1d6", "force", true),
  strikeOfTheGiants("Storm", "1d6", "lightning", true),
  // Its hit points come with the Hit Dice a short rest spends, not on a use of its own.
  narrative({ name: "Vigor of the Hill Giant", source: "BGG" }),
];

/**
 * The Lunar Sorcery, the kender and the Krynn feats of Dragonlance: Shadow of the Dragon Queen.
 * A Knight of Solamnia feat's DC and temporary hit points read the ability the feat increased,
 * which no term names. Lunar Empowerment's benefit is its phase's, which the sheet does not
 * store.
 */
const SHADOW_OF_THE_DRAGON_QUEEN: FeatureMechanics[] = [
  dsotdqFeature(sorcerer, lunar, "Lunar Sorcery", 1),
  dsotdqFeature(sorcerer24, lunar, "Lunar Sorcery", 3),
  // Its one use is the catalog's.
  dsotdqFeature(sorcerer, lunar, "Lunar Embodiment", 1, [SPELLS]),
  dsotdqFeature(sorcerer, lunar, "Moon Fire", 1, [{ kind: "spells", learns: ["sacred flame"] }]),
  dsotdqFeature(sorcerer, lunar, "Lunar Boons", 6, [PROFICIENCY_USES]),
  // Its one use is the catalog's.
  dsotdqFeature(sorcerer, lunar, "Waxing and Waning", 6, [SPELLS]),
  dsotdqFeature(sorcerer, lunar, "Lunar Empowerment", 14),
  dsotdqFeature(sorcerer, lunar, "Lunar Phenomenon", 18, [{ kind: "dc", spell: "Sorcerer" }]),
  // Its one use is the catalog's.
  dsotdqTrait("Fearless", ["Kender|DSotDQ"], [saveAdvantage("against being frightened")]),
  dsotdqTrait("Kender Curiosity", ["Kender|DSotDQ"]),
  dsotdqTrait("Taunt", ["Kender|DSotDQ"], [PROFICIENCY_USES, CHOSEN_CASTING_DC]),
  ...["Adept of the Black Robes", "Adept of the White Robes", "Divinely Favored"].map((name) => ({
    ref: { name, source: "DSotDQ" },
    mechanics: [SPELLS],
  })),
  {
    ref: { name: "Adept of the Red Robes", source: "DSotDQ" },
    mechanics: [SPELLS, PROFICIENCY_USES],
  },
  { ref: { name: "Initiate of High Sorcery", source: "DSotDQ" }, mechanics: [SPELLS] },
  ...["Knight of the Crown", "Knight of the Rose", "Knight of the Sword"].map((name) => ({
    ref: { name, source: "DSotDQ" },
    mechanics: [PROFICIENCY_USES],
  })),
  {
    ref: { name: "Squire of Solamnia", source: "DSotDQ" },
    mechanics: [
      PROFICIENCY_USES,
      advantageOn("once a turn, with Precise Strike; a use is spent only on a hit"),
      {
        kind: "extraDamage",
        dice: "1d8",
        oncePerTurn: true,
        option: "on a hit with Precise Strike",
      },
    ],
  },
];

/**
 * The College of Spirits, the Undead patron, the lineages and the backgrounds of Van Richten's
 * Guide to Ravenloft. A lineage trait whose effect the row already gives, such as a sense or a
 * climbing speed, is the narrative mark. One record holds a `(name, source)`, so a trait that
 * differs per lineage is scoped to its lineages. A die added to a
 * check, and hit points equal to the damage a bite or a spirit dealt, have no term.
 */
const VAN_RICHTENS_GUIDE: FeatureMechanics[] = [
  vrgrFeature(bard, spirits, "College of Spirits", 3),
  vrgrFeature(bard, spirits, "Guiding Whispers", 3, [SPELLS]),
  vrgrFeature(bard, spirits, "Spiritual Focus", 3),
  vrgrFeature(bard, spirits, "Tales from Beyond", 3, [{ kind: "dc", spell: "Bard" }]),
  // The spell it teaches lasts until the next long rest, so no pick is stored.
  vrgrFeature(bard, spirits, "Spirit Session", 6, [{ kind: "uses", count: 1, reset: "long" }]),
  vrgrFeature(bard, spirits, "Mystical Connection", 14),
  vrgrFeature(warlock, undead, "The Undead", 1, [SPELLS]),
  vrgrFeature(warlock24, undead, "The Undead", 3, [SPELLS]),
  vrgrFeature(warlock, undead, "Form of Dread", 1, [
    PROFICIENCY_USES,
    { kind: "active" },
    { kind: "tempHp", dice: "1d10", bonus: ["level"] },
    { kind: "defense", conditionImmune: ["frightened"], while: "active" },
  ]),
  vrgrFeature(warlock, undead, "Grave Touched", 6),
  // Its immunity while in Form of Dread is that feature's effect, which this one cannot read.
  vrgrFeature(warlock, undead, "Necrotic Husk", 10, [
    { kind: "defense", resist: ["necrotic"] },
    { kind: "uses", count: 1, reset: "manual" },
  ]),
  // Its one use is the catalog's.
  vrgrFeature(warlock, undead, "Spirit Projection", 14, [
    { kind: "active" },
    { kind: "defense", resist: ["bludgeoning", "piercing", "slashing"], while: "active" },
    { kind: "speed", equalToWalk: ["fly"], while: "active" },
  ]),
  // The hexblood's pick is its row's.
  vrgrTrait("Ancestral Legacy", vrgr("Dhampir", "Hexblood", "Reborn"), [
    { kind: "pick", fields: ["skills"], count: 2, races: vrgr("Dhampir", "Reborn") },
  ]),
  vrgrTrait("Darkvision", vrgr("Dhampir", "Hexblood")),
  // The dhampir's no need to breathe is left to the player.
  vrgrTrait("Deathless Nature", vrgr("Dhampir", "Reborn"), [
    ...["against disease", "against being poisoned"].map(
      (against): Mechanic => ({
        kind: "roll",
        roll: "save",
        advantage: true,
        against,
        races: vrgr("Reborn"),
      }),
    ),
    { kind: "roll", roll: "deathSave", advantage: true, races: vrgr("Reborn") },
  ]),
  vrgrTrait("Spider Climb", vrgr("Dhampir")),
  vrgrTrait("Vampiric Bite", vrgr("Dhampir"), [
    PROFICIENCY_USES,
    advantageOn("with the bite, while missing half or more of your hit points"),
  ]),
  // Its one use is the catalog's.
  vrgrTrait("Eerie Token", vrgr("Hexblood")),
  vrgrTrait("Hex Magic", vrgr("Hexblood"), [SPELLS_ONCE_PER_LONG_REST]),
  vrgrTrait("Knowledge from a Past Life", vrgr("Reborn"), [PROFICIENCY_USES]),
  ...["Heart of Darkness", "Official Inquiry"].map((name) => narrative({ name, source: "VRGR" })),
];

/**
 * The races, subraces, feats, backgrounds and the Pyromancer of the other classic setting
 * books. A trait whose effect the race row already gives, such as a sense, a skill, a tool, a
 * defense, a speed or a weapon, is the narrative mark, as is a background feature. So is an
 * effect no vocabulary term holds: a natural weapon's die, reach, carrying capacity, damage
 * reduced, a die added to a roll, extra damage equal to the character's level, a bonus
 * counted from allies in sight, double proficiency with a tool, and an effect on another
 * creature beyond its DC. A natural armor that ignores Dexterity has no term. A trait that
 * starts at 3rd or 5th level is held from the first.
 */
const SETTING_BOOKS: FeatureMechanics[] = [
  mtfTrait("Superior Darkvision", ["Dwarf|PHB|Duergar|MTF", "Gnome|PHB|Deep|MTF"]),
  mtfTrait(
    "Duergar Resilience",
    ["Dwarf|PHB|Duergar|MTF"],
    [saveAdvantage("against poison, illusions, and being charmed or paralyzed")],
  ),
  mtfTrait("Duergar Magic", ["Dwarf|PHB|Duergar|MTF"], [SPELLS]),
  mtfTrait("Sunlight Sensitivity", ["Dwarf|PHB|Duergar|MTF"]),
  // Its one use is the catalog's.
  mtfTrait("Fey Step", ["Elf|PHB|Eladrin|MTF"], [{ kind: "dc", ability: "cha" }]),
  ...["Sea Elf Training", "Child of the Sea", "Friend of the Sea", "Extra Language"].map((name) =>
    mtfTrait(name, ["Elf|PHB|Sea|MTF"]),
  ),
  mtfTrait("Necrotic Resistance", ["Elf|PHB|Shadar-kai|MTF"]),
  // Its one use is the catalog's; the resistance from 3rd level holds only until the next turn.
  mtfTrait("Blessing of the Raven Queen", ["Elf|PHB|Shadar-kai|MTF"]),
  mtfTrait("Decadent Mastery", ["Gith|MTF|Githyanki|MTF"]),
  mtfTrait("Martial Prodigy", ["Gith|MTF|Githyanki|MTF"]),
  mtfTrait("Githyanki Psionics", ["Gith|MTF|Githyanki|MTF"], [SPELLS]),
  mtfTrait("Mental Discipline", ["Gith|MTF|Githzerai|MTF"], [saveAdvantage(CHARMED_OR_FRIGHTENED)]),
  mtfTrait("Githzerai Psionics", ["Gith|MTF|Githzerai|MTF"], [SPELLS]),
  mtfTrait("Stone Camouflage", ["Gnome|PHB|Deep|MTF"], [hideIn("rocky terrain")]),
  ...TIEFLING_LEGACIES.map(([name, subrace]) =>
    mtfTrait(name, [`Tiefling|PHB|${subrace}|MTF`], [SPELLS]),
  ),
  { ref: { name: "Svirfneblin Magic", source: "MTF" }, mechanics: [SPELLS] },
  pskFeature(sorcerer, pyromancer, "Pyromancer (PSK)", 1),
  pskFeature(sorcerer24, pyromancer, "Pyromancer (PSK)", 3),
  pskFeature(sorcerer, pyromancer, "Heart of Fire", 1),
  pskFeature(sorcerer, pyromancer, "Fire in the Veins", 6, [{ kind: "defense", resist: ["fire"] }]),
  pskFeature(sorcerer, pyromancer, "Pyromancer's Fury", 14),
  pskFeature(sorcerer, pyromancer, "Fiery Soul", 18, [{ kind: "defense", immune: ["fire"] }]),
  pskTrait(
    "Darkvision",
    psk("Aetherborn", "Variant; Gifted Aetherborn", "Dwarf (Kaladesh)", "Elf (Kaladesh)"),
  ),
  ...["Born of Aether", "Menacing", "Gift of the Aetherborn"].map((name) =>
    pskTrait(name, psk("Aetherborn", "Variant; Gifted Aetherborn")),
  ),
  pskTrait("Drain Life", psk("Variant; Gifted Aetherborn")),
  pskTrait("Dwarven Resilience", psk("Dwarf (Kaladesh)"), [saveAdvantage("against poison")]),
  pskTrait("Dwarven Toughness", psk("Dwarf (Kaladesh)"), [
    { kind: "bonus", target: "hitPointsPerLevel", value: 1 },
  ]),
  pskTrait("Artisan's Expertise", psk("Dwarf (Kaladesh)")),
  ...["Keen Senses", "Elf Weapon Training", "Trance", "Elf Culture"].map((name) =>
    pskTrait(name, psk("Elf (Kaladesh)")),
  ),
  pskTrait("Fey Ancestry", psk("Elf (Kaladesh)"), [saveAdvantage("against being charmed")]),
  pskTrait("Vedalken Cunning", psk("Vedalken"), [MAGIC_SAVES]),
  pskTrait("Aether Lore", psk("Vedalken")),
  ...["Fleet of Foot", "Mask of the Wild"].map((name) =>
    pskTrait(name, ["Elf (Kaladesh)|PSK|Bishatar and Tirahar|PSK"]),
  ),
  pskTrait("Cantrip", ["Elf (Kaladesh)|PSK|Vahadar|PSK"], [SPELLS]),
  pskTrait("Extra Language", ["Elf (Kaladesh)|PSK|Vahadar|PSK"]),
  { ref: { name: "Quicksmithing", source: "PSK" }, mechanics: [SPELLS] },
  { ref: { name: "Servo Crafting", source: "PSK" }, mechanics: [SPELLS] },
  vgmTrait(
    "Darkvision",
    vgm(
      "Aasimar",
      "Bugbear",
      "Goblin",
      "Hobgoblin",
      "Kobold",
      "Orc",
      "Tabaxi",
      "Triton",
      "Yuan-ti Pureblood",
    ),
  ),
  vgmTrait("Celestial Resistance", vgm("Aasimar")),
  // Its one use is the catalog's.
  vgmTrait("Healing Hands", vgm("Aasimar"), [{ kind: "heal", bonus: ["level"], others: true }]),
  vgmTrait("Light Bearer", vgm("Aasimar"), [SPELLS]),
  // Each transformation's one use is the catalog's; its extra damage equals the level.
  vgmTrait(
    "Necrotic Shroud",
    ["Aasimar|VGM|Fallen|VGM"],
    [REVELATION, { kind: "dc", ability: "cha" }],
  ),
  vgmTrait("Radiant Consumption", ["Aasimar|VGM|Scourge|VGM"], [REVELATION]),
  vgmTrait(
    "Radiant Soul",
    ["Aasimar|VGM|Protector|VGM"],
    [REVELATION, { kind: "speed", fly: 30, while: "active" }],
  ),
  vgmTrait("Long-Limbed", vgm("Bugbear")),
  vgmTrait("Powerful Build", vgm("Bugbear", "Firbolg", "Goliath", "Orc")),
  vgmTrait("Sneaky", vgm("Bugbear")),
  vgmTrait("Surprise Attack", vgm("Bugbear"), [
    {
      kind: "extraDamage",
      dice: "2d6",
      option: "once a combat, on a hit against a creature you surprised, on your first turn",
    },
  ]),
  vgmTrait("Firbolg Magic", vgm("Firbolg"), [SPELLS]),
  // Its one use is the catalog's.
  vgmTrait("Hidden Step", vgm("Firbolg")),
  vgmTrait("Speech of Beast and Leaf", vgm("Firbolg"), [BEAST_AND_LEAF]),
  // Its one use is the catalog's.
  vgmTrait("Fury of the Small", vgm("Goblin")),
  vgmTrait("Nimble Escape", vgm("Goblin"), asBonusAction("Disengage", "Hide")),
  vgmTrait("Natural Athlete", vgm("Goliath")),
  vgmTrait("Stone's Endurance", vgm("Goliath")),
  vgmTrait("Mountain Born", vgm("Goliath")),
  vgmTrait("Martial Training", vgm("Hobgoblin")),
  vgmTrait("Saving Face", vgm("Hobgoblin")),
  vgmTrait("Expert Forgery", vgm("Kenku"), [
    {
      kind: "roll",
      roll: "check",
      advantage: true,
      against: "to produce forgeries or duplicates of existing objects",
    },
  ]),
  vgmTrait("Kenku Training", vgm("Kenku")),
  vgmTrait("Mimicry", vgm("Kenku")),
  vgmTrait("Grovel, Cower, and Beg", vgm("Kobold")),
  vgmTrait("Pack Tactics", vgm("Kobold"), [advantageOn(NEAR_AN_ALLY)]),
  vgmTrait("Sunlight Sensitivity", vgm("Kobold")),
  vgmTrait("Swim Speed", vgm("Lizardfolk", "Triton")),
  ...["Bite", "Cunning Artisan", "Hold Breath", "Hunter's Lore"].map((name) =>
    vgmTrait(name, vgm("Lizardfolk")),
  ),
  vgmTrait("Natural Armor", vgm("Lizardfolk"), [NATURAL_ARMOR_13]),
  // Its one use is the catalog's.
  vgmTrait("Hungry Jaws", vgm("Lizardfolk"), [{ kind: "tempHp", bonus: ["con"] }]),
  vgmTrait("Aggressive", vgm("Orc")),
  vgmTrait("Primal Intuition", vgm("Orc")),
  // Moving 0 feet on a turn restores its use.
  vgmTrait("Feline Agility", vgm("Tabaxi"), [{ kind: "uses", count: 1, reset: "manual" }]),
  vgmTrait("Cat's Claws", vgm("Tabaxi")),
  vgmTrait("Cat's Talents", vgm("Tabaxi")),
  vgmTrait("Amphibious", vgm("Triton")),
  vgmTrait("Control Air and Water", vgm("Triton"), [SPELLS]),
  vgmTrait("Emissary of the Sea", vgm("Triton")),
  vgmTrait("Guardians of the Depths", vgm("Triton")),
  // Its one use is the catalog's.
  vgmTrait("Innate Spellcasting", vgm("Yuan-ti Pureblood"), [SPELLS]),
  vgmTrait("Magic Resistance", vgm("Yuan-ti Pureblood"), [MAGIC_RESISTANCE]),
  vgmTrait("Poison Immunity", vgm("Yuan-ti Pureblood")),
  pszTrait("Darkvision", psz("Elf (Zendikar)", "Goblin", "Vampire")),
  pszTrait("Keen Senses", psz("Elf (Zendikar)")),
  pszTrait("Fey Ancestry", psz("Elf (Zendikar)"), [saveAdvantage("against being charmed")]),
  // The resistances are the race row's. The base row owns the trait so its scan finds it, and the
  // Ixalan goblin, which holds the base row too, gets no armor class from it.
  pszTrait("Grit", psz("Goblin").concat(ZENDIKAR_TRIBES), [
    { kind: "unarmoredBase", value: 1, races: ZENDIKAR_TRIBES },
  ]),
  pszTrait("Brave", psz("Kor"), [saveAdvantage("against being frightened")]),
  ...["Climbing", "Kor Climbing", "Lucky"].map((name) => pszTrait(name, psz("Kor"))),
  pszTrait("Amphibious", psz("Merfolk")),
  pszTrait("Swimming", psz("Merfolk")),
  ...["Blood Thirst", "Vampiric Resistance"].map((name) => pszTrait(name, psz("Vampire"))),
  pszTrait("Mask of the Wild", ["Elf (Zendikar)|PSZ|Joraga Nation|PSZ"]),
  pszTrait("Fleet of Foot", ["Elf (Zendikar)|PSZ|Joraga Nation|PSZ"]),
  pszTrait("Elf Weapon Training", [
    "Elf (Zendikar)|PSZ|Joraga Nation|PSZ",
    "Elf (Zendikar)|PSZ|Mul Daya Nation|PSZ",
  ]),
  pszTrait("Superior Darkvision", ["Elf (Zendikar)|PSZ|Mul Daya Nation|PSZ"]),
  pszTrait("Mul Daya Magic", ["Elf (Zendikar)|PSZ|Mul Daya Nation|PSZ"], [SPELLS]),
  pszTrait("Sunlight Sensitivity", ["Elf (Zendikar)|PSZ|Mul Daya Nation|PSZ"]),
  pszTrait("Skill Versatility", ["Elf (Zendikar)|PSZ|Tajuru Nation|PSZ"]),
  pszTrait("Grotag Tamer", ["Goblin|PSZ|Zendikar; Grotag Tribe|PSZ"]),
  pszTrait(
    "Lavastep Grit",
    ["Goblin|PSZ|Zendikar; Lavastep Tribe|PSZ"],
    [hideIn("rocky or subterranean environments")],
  ),
  pszTrait("Tuktuk Cunning", ["Goblin|PSZ|Zendikar; Tuktuk Tribe|PSZ"]),
  pszTrait(
    "Cantrip",
    ["Cosi", "Emeria", "Ula"].map((creed) => `Merfolk|PSZ|Zendikar; ${creed} Creed|PSZ`),
    [SPELLS],
  ),
  pszTrait("Creed of the Trickster", ["Merfolk|PSZ|Zendikar; Cosi Creed|PSZ"]),
  pszTrait("Wind Creed Manipulation", ["Merfolk|PSZ|Zendikar; Emeria Creed|PSZ"]),
  pszTrait("Water Creed Navigation", ["Merfolk|PSZ|Zendikar; Ula Creed|PSZ"]),
  pszTrait("Null Transformation", ["Vampire|PSZ|Zendikar|PSZ"]),
  ...["Menacing", "Savage Attacks", "Darkvision"].map((name) =>
    psxTrait(name, ["Orc (Ixalan)|PSX"]),
  ),
  // Its one use is the catalog's.
  psxTrait("Relentless Endurance", ["Orc (Ixalan)|PSX"], [{ kind: "heal", bonus: [1] }]),
  psxTrait("Siren's Song", ["Siren|PSX"], [SPELLS]),
  psxTrait("Flight", ["Siren|PSX"]),
  // The climbing speed is 25 feet, which the goblin's walking speed matches until a bonus raises it.
  psxTrait("Agile Climber", ["Goblin|PSZ|Ixalan|PSX"], [{ kind: "speed", equalToWalk: ["climb"] }]),
  psxTrait("Cantrip", ["Merfolk|PSZ|Ixalan; Blue|PSX", "Merfolk|PSZ|Ixalan; Green|PSX"], [SPELLS]),
  psxTrait("Lore of the Waters", ["Merfolk|PSZ|Ixalan; Blue|PSX"]),
  psxTrait("Mask of the Wild", ["Merfolk|PSZ|Ixalan; Green|PSX"]),
  psxTrait(
    "Feast of Blood",
    ["Vampire|PSZ|Ixalan|PSX"],
    [
      { kind: "active" },
      { kind: "speed", bonus: 10, while: "active" },
      { kind: "roll", roll: "check", abilities: ["str", "dex"], advantage: true, while: "active" },
      { kind: "roll", roll: "save", abilities: ["str", "dex"], advantage: true, while: "active" },
    ],
  ),
  // Its one use is the catalog's.
  {
    ref: { name: "Vampiric Exultation", source: "PSX" },
    mechanics: [{ kind: "active" }, { kind: "speed", fly: 30, while: "active" }],
  },
  {
    ref: { name: "Agent of Order", source: "SatO" },
    mechanics: [
      PROFICIENCY_USES,
      CHOSEN_CASTING_DC,
      {
        kind: "extraDamage",
        dice: "1d8",
        type: "force",
        oncePerTurn: true,
        option: "on damage to a creature you can see within 60 feet",
      },
    ],
  },
  // Its damage adds the proficiency bonus to a die, which no `plus` term holds.
  { ref: { name: "Baleful Scion", source: "SatO" }, mechanics: [PROFICIENCY_USES] },
  narrative({ name: "Cohort of Chaos", source: "SatO" }),
  { ref: { name: "Outlands Envoy", source: "SatO" }, mechanics: [SPELLS] },
  // Its resistance is picked at each long rest.
  narrative({ name: "Planar Wanderer", source: "SatO" }),
  { ref: { name: "Righteous Heritor", source: "SatO" }, mechanics: [PROFICIENCY_USES] },
  { ref: { name: "Scion of the Outer Planes", source: "SatO" }, mechanics: [SPELLS] },
  ...["Conviction", "Planar Infusion"].map((name) => narrative({ name, source: "SatO" })),
  ...["Flight", "Talons"].map((name) => eepcTrait(name, ["Aarakocra|EEPC"])),
  eepcTrait("Unending Breath", ["Genasi|EEPC|Air|EEPC"]),
  eepcTrait("Mingle with the Wind", ["Genasi|EEPC|Air|EEPC"], [SPELLS_ONCE_PER_LONG_REST]),
  eepcTrait("Earth Walk", ["Genasi|EEPC|Earth|EEPC"]),
  eepcTrait("Merge with Stone", ["Genasi|EEPC|Earth|EEPC"], [SPELLS_ONCE_PER_LONG_REST]),
  ...["Darkvision", "Fire Resistance"].map((name) => eepcTrait(name, ["Genasi|EEPC|Fire|EEPC"])),
  eepcTrait("Reach to the Blaze", ["Genasi|EEPC|Fire|EEPC"], [SPELLS]),
  ...["Acid Resistance", "Amphibious", "Swim"].map((name) =>
    eepcTrait(name, ["Genasi|EEPC|Water|EEPC"]),
  ),
  eepcTrait("Call to the Wave", ["Genasi|EEPC|Water|EEPC"], [SPELLS]),
  aagTrait("Astral Fire", aag("Astral Elf"), [SPELLS]),
  aagTrait("Darkvision", aag("Astral Elf", "Plasmoid", "Thri-kreen")),
  aagTrait("Fey Ancestry", aag("Astral Elf"), [saveAdvantage("against being charmed")]),
  aagTrait("Keen Senses", aag("Astral Elf")),
  aagTrait("Starlight Step", aag("Astral Elf"), [PROFICIENCY_USES]),
  aagTrait("Astral Trance", aag("Astral Elf")),
  aagTrait("Armored Casing", aag("Autognome"), [NATURAL_ARMOR_13]),
  aagTrait("Built for Success", aag("Autognome"), [
    PROFICIENCY_USES,
    {
      kind: "attack",
      dice: "1d4",
      afterRoll: true,
      option: "after seeing the d20, by spending a use of the trait",
    },
  ]),
  aagTrait("Healing Machine", aag("Autognome")),
  aagTrait("Mechanical Nature", aag("Autognome"), [
    saveAdvantage("against being paralyzed or poisoned"),
  ]),
  aagTrait("Sentry's Rest", aag("Autognome")),
  aagTrait("Specialized Design", aag("Autognome")),
  aagTrait("Astral Spark", aag("Giff"), [
    PROFICIENCY_USES,
    {
      kind: "extraDamage",
      dice: "proficiency",
      type: "force",
      oncePerTurn: true,
      option: "on a hit with a simple or martial weapon",
    },
  ]),
  aagTrait("Firearms Mastery", aag("Giff")),
  aagTrait("Hippo Build", aag("Giff"), [
    { kind: "roll", roll: "check", abilities: ["str"], advantage: true },
    { kind: "roll", roll: "save", abilities: ["str"], advantage: true },
  ]),
  aagTrait("Dexterous Feet", aag("Hadozee")),
  aagTrait("Glide", aag("Hadozee")),
  aagTrait("Hadozee Dodge", aag("Hadozee"), [PROFICIENCY_USES]),
  aagTrait("Amorphous", aag("Plasmoid"), [
    { kind: "roll", roll: "check", advantage: true, against: "to initiate or escape a grapple" },
  ]),
  aagTrait("Hold Breath", aag("Plasmoid")),
  aagTrait("Natural Resilience", aag("Plasmoid"), [saveAdvantage("against being poisoned")]),
  aagTrait("Shape Self", aag("Plasmoid")),
  aagTrait("Chameleon Carapace", aag("Thri-kreen"), [
    NATURAL_ARMOR_13,
    hideIn("surroundings your carapace matches"),
  ]),
  ...["Secondary Arms", "Sleepless", "Thri-kreen Telepathy"].map((name) =>
    aagTrait(name, aag("Thri-kreen")),
  ),
  ...["Divine Contact", "Wildspace Adaptation"].map((name) => narrative({ name, source: "AAG" })),
  ggrTrait("Fey", ggr("Centaur")),
  ...["Charge", "Hooves", "Equine Build", "Survivor"].map((name) => ggrTrait(name, ggr("Centaur"))),
  ggrTrait("Darkvision", ggr("Goblin", "Simic Hybrid")),
  // Its one use is the catalog's.
  ggrTrait("Fury of the Small", ggr("Goblin")),
  ggrTrait("Nimble Escape", ggr("Goblin"), asBonusAction("Disengage", "Hide")),
  ggrTrait("Powerful Build", ggr("Loxodon")),
  ggrTrait("Loxodon Serenity", ggr("Loxodon"), [saveAdvantage(CHARMED_OR_FRIGHTENED)]),
  ggrTrait("Natural Armor", ggr("Loxodon"), [
    { kind: "unarmoredBase", value: "con", plus: 2, fixed: true },
  ]),
  ggrTrait("Trunk", ggr("Loxodon")),
  ggrTrait("Keen Smell", ggr("Loxodon"), [
    {
      kind: "roll",
      roll: "check",
      skills: ["perception", "survival", "investigation"],
      advantage: true,
      against: "that involve smell",
    },
  ]),
  ...["Horns", "Goring Rush", "Imposing Presence"].map((name) => ggrTrait(name, ggr("Minotaur"))),
  ggrTrait("Hammering Horns", ggr("Minotaur"), [{ kind: "dc", ability: "str" }]),
  // Its benefit is the enhancement picked, which the sheet does not store.
  ggrTrait("Animal Enhancement", ggr("Simic Hybrid")),
  ggrTrait("Vedalken Dispassion", ggr("Vedalken"), [
    { kind: "roll", roll: "save", abilities: ["int", "wis", "cha"], advantage: true },
  ]),
  ggrTrait("Tireless Precision", ggr("Vedalken")),
  // Its one use is the catalog's.
  ggrTrait("Partially Amphibious", ggr("Vedalken")),
  ...[
    "Conclave's Shelter",
    "False Identity",
    "Fearsome Reputation",
    "Legal Authority",
    "Legion Station",
    "Leverage",
    "Researcher",
    "Rubblebelt Refuge",
    "Undercity Paths",
    "Urban Infrastructure",
  ].map((name) => narrative({ name, source: "GGR" })),
  ...["Charge", "Hooves", "Equine Build", "Survivor"].map((name) => motTrait(name, mot("Centaur"))),
  motTrait("Fey", mot("Centaur", "Satyr")),
  motTrait("Darkvision", mot("Leonin", "Triton")),
  motTrait("Claws", mot("Leonin")),
  motTrait("Hunter's Instincts", mot("Leonin")),
  // Its one use is the catalog's.
  motTrait("Daunting Roar", mot("Leonin"), [{ kind: "dc", ability: "con" }]),
  ...["Horns", "Goring Rush", "Imposing Presence"].map((name) => motTrait(name, mot("Minotaur"))),
  motTrait("Hammering Horns", mot("Minotaur"), [{ kind: "dc", ability: "str" }]),
  ...["Ram", "Mirthful Leaps", "Reveler"].map((name) => motTrait(name, mot("Satyr"))),
  motTrait("Magic Resistance", mot("Satyr"), [MAGIC_RESISTANCE]),
  ...["Swim Speed", "Amphibious", "Emissary of the Sea", "Guardians of the Depths"].map((name) =>
    motTrait(name, mot("Triton")),
  ),
  motTrait("Control Air and Water", mot("Triton"), [SPELLS]),
  narrative({ name: "Echoes of Victory", source: "MOT" }),
  ...["Forest Folk", "Fleet of Foot", "Sure-footed", "Spring Attack"].map((name) =>
    psiTrait(name, ["Human (Innistrad)|PSI|Kessig|PSI"]),
  ),
  psiTrait("Breadth of Knowledge", ["Human (Innistrad)|PSI|Nephalia|PSI"]),
  psiTrait("Daunting", ["Human (Innistrad)|PSI|Stensia|PSI"]),
  psiTrait(
    "Tough",
    ["Human (Innistrad)|PSI|Stensia|PSI"],
    [{ kind: "bonus", target: "hitPointsPerLevel", value: 2 }],
  ),
  narrative({ name: "Legal Authority", source: "PSI" }),
  ...["Darkvision", "Flight", "Silent Feathers"].map((name) => sccTrait(name, ["Owlin|SCC"])),
  { ref: { name: "Strixhaven Initiate", source: "SCC" }, mechanics: [SPELLS] },
  // Its one use is the catalog's.
  { ref: { name: "Strixhaven Mascot", source: "SCC" }, mechanics: [SPELLS] },
  ...["Lorehold", "Prismari", "Quandrix", "Silverquill", "Witherbloom"].map((college) =>
    narrative({ name: `${college} Initiate`, source: "SCC" }),
  ),
  ...["Flight", "Hawkeyed"].map((name) => psdTrait(name, ["Aven|PSD"])),
  psdTrait("Natural Athlete", ["Human|PHB|Keldon|PSD"]),
  psdTrait("Keldon Resilience", ["Human|PHB|Keldon|PSD"], grants({ savingThrows: ["str"] })),
  psdTrait("Icehaven Born", ["Human|PHB|Keldon|PSD"]),
  wbtwTrait("Flight", ["Fairy|WBtW"]),
  wbtwTrait("Fairy Magic", ["Fairy|WBtW"], [SPELLS]),
  wbtwTrait(
    "Hare-Trigger",
    ["Harengon|WBtW"],
    [{ kind: "bonus", target: "initiative", value: "proficiency" }],
  ),
  wbtwTrait("Leporine Senses", ["Harengon|WBtW"]),
  wbtwTrait("Lucky Footwork", ["Harengon|WBtW"]),
  wbtwTrait("Rabbit Hop", ["Harengon|WBtW"], [PROFICIENCY_USES]),
  ...["Carnival Fixture", "Feywild Connection"].map((name) => narrative({ name, source: "WBtW" })),
  { ref: { name: "Cartomancer", source: "BMT" }, mechanics: [SPELLS] },
  ...["Fortune's Favor", "Still Standing"].map((name) => narrative({ name, source: "BMT" })),
  ...["Darkvision", "Speak with Small Beasts"].map((name) =>
    awmTrait(name, ["Goblin (Dankwood)|AWM"]),
  ),
  awmTrait("Nimble Escape", ["Goblin (Dankwood)|AWM"], asBonusAction("Disengage", "Hide")),
  ...[
    "Arboreal Alertness",
    "Amphibious",
    "Poison Immunity",
    "Poisonous Skin",
    "Standing Leap",
    "Water Dependency",
  ].map((name) => ogaTrait(name, ["Grung|OGA"])),
  lrTrait("Natural Armor", ["Locathah|LR"], [{ kind: "unarmoredBase", value: 2 }]),
  lrTrait("Observant & Athletic", ["Locathah|LR"]),
  lrTrait(
    "Leviathan Will",
    ["Locathah|LR"],
    [
      saveAdvantage(
        "against being charmed, frightened, paralyzed, poisoned, stunned, or put to sleep",
      ),
    ],
  ),
  lrTrait("Limited Amphibiousness", ["Locathah|LR"]),
  ...["Claws", "Hold Breath", "Survival Instinct"].map((name) => ttpTrait(name, ["Tortle|TTP"])),
  ttpTrait("Natural Armor", ["Tortle|TTP"], [{ kind: "unarmoredBase", value: 7, fixed: true }]),
  ttpTrait(
    "Shell Defense",
    ["Tortle|TTP"],
    [
      { kind: "active" },
      { kind: "armorClass", value: 4, while: "active" },
      { kind: "roll", roll: "save", abilities: ["str", "con"], advantage: true, while: "active" },
    ],
  ),
  ...["Black Blood Healing", "Limited Telepathy", "Persuasive"].map((name) =>
    aiTrait(name, ["Verdan|AI"]),
  ),
  aiTrait(
    "Telepathic Insight",
    ["Verdan|AI"],
    [{ kind: "roll", roll: "save", abilities: ["wis", "cha"], advantage: true }],
  ),
  ...[
    "Inside Informant",
    "Legalese",
    "Name Dropping",
    "Never Tell Me the Odds",
    "Supply Chain",
  ].map((name) => narrative({ name, source: "AI" })),
];

const wizard24: [string, string] = ["Wizard", "XPHB"];
const mystic: [string, string] = ["Mystic", "UATheMysticClass"];
const totemWarrior: [string, string] = ["Totem Warrior", "PHB"];
const battlerager: [string, string] = ["Battlerager", "SCAG"];
const arcana: [string, string] = ["Arcana", "SCAG"];
const echoKnight: [string, string] = ["Echo Knight", "EGW"];
const purpleDragonKnight: [string, string] = ["Purple Dragon Knight (Banneret)", "SCAG"];
const longDeath: [string, string] = ["Long Death", "SCAG"];
const crown: [string, string] = ["Crown", "SCAG"];
const undying: [string, string] = ["Undying", "SCAG"];
const chronurgy: [string, string] = ["Chronurgy", "EGW"];
const graviturgy: [string, string] = ["Graviturgy", "EGW"];
const order = (name: string): [string, string] => [name, "UATheMysticClass"];
const scagFeature = bookFeature("SCAG");
const egwFeature = bookFeature("EGW");
const orderFeature = bookFeature("UATheMysticClass");
const scagTrait = bookTrait("SCAG");
const egwTrait = bookTrait("EGW");
/** A Mystic class feature, narrative where it carries no mechanics. */
const mysticFeature = (name: string, level: number, mechanics?: Mechanic[]): FeatureMechanics =>
  mechanics
    ? classFeature(mystic, [name, "UATheMysticClass"], level, mechanics)
    : narrative({
        name,
        source: "UATheMysticClass",
        className: mystic[0],
        classSource: mystic[1],
        level,
      });
/** A SCAG totem a Path of the Totem Warrior feature of `level` offers, narrative where it carries no mechanics. */
const totem = (
  name: string,
  level: number,
  offeredBy: string,
  mechanics?: Mechanic[],
): FeatureMechanics => {
  const key = (feature: string, source: string) => ({
    name: feature,
    source,
    className: barbarian[0],
    classSource: barbarian[1],
    subclass: { shortName: totemWarrior[0], source: totemWarrior[1] },
    level,
  });
  return {
    ref: key(name, "SCAG"),
    offeredBy: key(offeredBy, "PHB"),
    ...(mechanics ? { mechanics } : { narrative: true }),
  };
};
const DRAGONS = [
  "Black",
  "Blue",
  "Brass",
  "Bronze",
  "Copper",
  "Gold",
  "Green",
  "Red",
  "Silver",
  "White",
];
/** The EGW dragonborn subrace of `lineage`, and each of its ten draconic ancestries where `colors` says so. */
const egwDragonborn = (lineage: string, colors: "only" | "also" | "none") =>
  [
    ...(colors === "only" ? [] : [lineage]),
    ...(colors === "none" ? [] : DRAGONS.map((color) => `Dragonborn (${lineage}; ${color})`)),
  ].map((subrace) => `Dragonborn|PHB|${subrace}|EGW`);
const halfElf = (...descents: string[]) =>
  descents.map((descent) => `Half-Elf|PHB|Variant; ${descent}|SCAG`);
const SKILL_VERSATILITY = ["Aquatic Elf", "Drow", "Moon Elf or Sun Elf", "Wood Elf"].map(
  (elf) => `${elf} Descent; Skill Versatility`,
);
const tiefling = (...variants: string[]) =>
  variants.map((variant) => `Tiefling|PHB|Variant; ${variant}|SCAG`);
const SOUL_KNIFE = "with your soul knives, for 10 minutes after spending";

/**
 * The subclasses, races and backgrounds of the Sword Coast Adventurer's Guide, the Explorer's
 * Guide to Wildemount and the Mystic of Unearthed Arcana. A trait whose effect the race row
 * already gives, such as a sense, a skill, a speed or a weapon, is the narrative mark, as is a
 * background feature. So is an effect no vocabulary term holds: a speed or a jump held only
 * while raging, an ability's modifier added to initiative, a weapon the feature makes, damage
 * dealt back or redirected, resistance to nonmagical damage alone, a proficiency swapped until
 * the next rest, hit points equal to psi points spent, and an effect on another creature beyond
 * its DC or amount. A Totem Warrior's SCAG totem holds only where the feature offering it was
 * given that totem.
 */
const SWORD_COAST_AND_WILDEMOUNT: FeatureMechanics[] = [
  totem("Elk", 3, "Totem Spirit"),
  totem("Tiger", 3, "Totem Spirit"),
  totem("Elk", 6, "Aspect of the Beast"),
  totem("Tiger", 6, "Aspect of the Beast", [
    skillsOf(2, ["athletics", "acrobatics", "stealth", "survival"]),
  ]),
  totem("Elk", 14, "Totemic Attunement", [{ kind: "dc", ability: "str" }]),
  totem("Tiger", 14, "Totemic Attunement"),
  scagFeature(barbarian, battlerager, "Path of the Battlerager", 3),
  scagFeature(barbarian, battlerager, "Battlerager Armor", 3),
  scagFeature(barbarian, battlerager, "Restriction—Dwarves Only", 3),
  scagFeature(barbarian, battlerager, "Reckless Abandon", 6, [{ kind: "tempHp", bonus: ["con"] }]),
  scagFeature(barbarian, battlerager, "Battlerager Charge", 10, [
    { kind: "turn", bonusAction: ["Dash"], while: "raging" },
  ]),
  scagFeature(barbarian, battlerager, "Spiked Retribution", 14),
  ...(
    [
      [cleric, 1, 2],
      [cleric24, 3, 3],
    ] as const
  ).flatMap(([owner, domainLevel, channelLevel]) => [
    scagFeature(owner, arcana, "Arcana Domain", domainLevel, [SPELLS]),
    scagFeature(owner, arcana, "Channel Divinity: Arcane Abjuration", channelLevel, [
      { kind: "dc", spell: "Cleric" },
    ]),
  ]),
  scagFeature(cleric, arcana, "Arcane Initiate", 1, [
    ...grants({ skills: ["arcana"] }),
    ...spellPicks({ count: 2, level: 0, from: "Wizard" }),
  ]),
  scagFeature(cleric, arcana, "Spell Breaker", 6),
  scagFeature(cleric, arcana, "Potent Spellcasting", 8),
  scagFeature(
    cleric,
    arcana,
    "Arcane Mastery",
    17,
    spellPicks(...[6, 7, 8, 9].map((level) => ({ count: 1, level, from: "Wizard" }))),
  ),
  egwFeature(fighter, echoKnight, "Echo Knight", 3),
  egwFeature(fighter, echoKnight, "Manifest Echo", 3),
  egwFeature(fighter, echoKnight, "Unleash Incarnation", 3, [
    { kind: "uses", count: "con", reset: "long" },
  ]),
  egwFeature(fighter, echoKnight, "Echo Avatar", 7),
  // Its one use is the catalog's.
  egwFeature(fighter, echoKnight, "Shadow Martyr", 10),
  egwFeature(fighter, echoKnight, "Reclaim Potential", 15, [
    { kind: "uses", count: "con", reset: "long" },
    { kind: "tempHp", dice: "2d6", bonus: ["con"] },
  ]),
  egwFeature(fighter, echoKnight, "Legion of One", 18, [
    { kind: "regain", target: "uses", of: "Unleash Incarnation", count: 1, on: "initiative" },
  ]),
  scagFeature(fighter, purpleDragonKnight, "Purple Dragon Knight (Banneret)", 3),
  scagFeature(fighter, purpleDragonKnight, "Rallying Cry", 3, [
    { kind: "heal", bonus: ["level"], others: true },
  ]),
  scagFeature(fighter, purpleDragonKnight, "Restriction: Knighthood", 3),
  // The other skill it gives where Persuasion is already held is the player's to add.
  scagFeature(
    fighter,
    purpleDragonKnight,
    "Royal Envoy",
    7,
    grants({ skills: ["persuasion"], expertise: ["persuasion"] }),
  ),
  scagFeature(fighter, purpleDragonKnight, "Inspiring Surge", 10),
  scagFeature(fighter, purpleDragonKnight, "Bulwark", 15),
  scagFeature(fighter, purpleDragonKnight, "Inspiring Surge", 18),
  scagFeature(monk, longDeath, "Way of the Long Death", 3),
  scagFeature(monk, longDeath, "Touch of Death", 3, [
    { kind: "tempHp", bonus: ["wis", "level"], on: "zeroHp" },
  ]),
  scagFeature(monk, longDeath, "Hour of Reaping", 6),
  scagFeature(monk, longDeath, "Mastery of Death", 11),
  scagFeature(monk, longDeath, "Touch of the Long Death", 17, [KI_DC]),
  scagFeature(paladin, crown, "Oath of the Crown", 3),
  scagFeature(paladin, crown, "Champion Challenge", 3, [{ kind: "dc", spell: "Paladin" }]),
  scagFeature(paladin, crown, "Channel Divinity", 3),
  scagFeature(paladin, crown, "Oath Spells", 3, [SPELLS]),
  scagFeature(paladin, crown, "Tenets of the Crown", 3),
  scagFeature(paladin, crown, "Turn the Tide", 3, [
    { kind: "heal", dice: "1d6", bonus: ["cha"], others: true },
  ]),
  scagFeature(paladin, crown, "Divine Allegiance", 7),
  scagFeature(paladin, crown, "Unyielding Spirit", 15, [
    saveAdvantage("against being paralyzed or stunned"),
  ]),
  // Its one use is the catalog's.
  scagFeature(paladin, crown, "Exalted Champion", 20, [
    { kind: "active", endsOn: ["incapacitated"] },
    { kind: "roll", roll: "save", abilities: ["wis"], advantage: true, while: "active" },
  ]),
  scagFeature(warlock, undying, "The Undying", 1, [SPELLS]),
  scagFeature(warlock24, undying, "The Undying", 3, [SPELLS]),
  scagFeature(warlock, undying, "Among the Dead", 1, [
    SPELLS,
    saveAdvantage("against disease"),
    { kind: "dc", spell: "Warlock" },
  ]),
  // Its one use is the catalog's.
  scagFeature(warlock, undying, "Defy Death", 6, [{ kind: "heal", dice: "1d8", bonus: ["con"] }]),
  scagFeature(warlock, undying, "Undying Nature", 10),
  // Its one use is the catalog's.
  scagFeature(warlock, undying, "Indestructible Life", 14, [
    { kind: "heal", dice: "1d8", bonus: ["level"] },
  ]),
  ...(
    [
      [wizard, 2],
      [wizard24, 3],
    ] as const
  ).flatMap(([owner, level]) => [
    egwFeature(owner, chronurgy, "Chronurgy Magic", level, [SPELLS]),
    egwFeature(owner, graviturgy, "Graviturgy Magic", level, [SPELLS]),
  ]),
  // Its two uses are the catalog's.
  egwFeature(wizard, chronurgy, "Chronal Shift", 2),
  egwFeature(wizard, chronurgy, "Temporal Awareness", 2),
  egwFeature(wizard, chronurgy, "Momentary Stasis", 6, [
    { kind: "uses", count: "int", reset: "long" },
    { kind: "dc", spell: "Wizard" },
  ]),
  // Its one use is the catalog's.
  egwFeature(wizard, chronurgy, "Arcane Abeyance", 10),
  egwFeature(wizard, chronurgy, "Convergent Future", 14),
  egwFeature(wizard, graviturgy, "Adjust Density", 2),
  egwFeature(wizard, graviturgy, "Gravity Well", 6),
  egwFeature(wizard, graviturgy, "Violent Attraction", 10, [
    { kind: "uses", count: "int", reset: "long" },
  ]),
  // Its one use is the catalog's.
  egwFeature(wizard, graviturgy, "Event Horizon", 14, [{ kind: "dc", spell: "Wizard" }]),
  ...["Mystic Order", "Psionic Disciplines and Talents", "Using a Discipline"].map((name) =>
    mysticFeature(name, 1),
  ),
  mysticFeature("Psionics", 1, [{ kind: "dc", ability: "int" }]),
  mysticFeature("Mystical Recovery", 2),
  mysticFeature("Telepathy", 2),
  ...[3, 6, 14].map((level) => mysticFeature("Mystic Order feature", level)),
  ...[4, 8, 12, 16, 19].map((level) => mysticFeature("Ability Score Improvement", level)),
  mysticFeature("Strength of Mind", 4),
  mysticFeature("Potent Psionics (1d8)", 8, [
    {
      kind: "extraDamage",
      dice: "1d8",
      scales: [{ level: 14, dice: "2d8" }],
      type: "psychic",
      oncePerTurn: true,
      option: ON_A_HIT,
    },
  ]),
  // Its larger die is recorded on Potent Psionics (1d8)'s scale.
  mysticFeature("Potent Psionics (2d8)", 14),
  // Its one use is the catalog's.
  mysticFeature("Consumptive Power", 10),
  mysticFeature("Psionic Mastery (1/Day)", 11, [
    {
      kind: "uses",
      count: 1,
      reset: "long",
      scales: [
        { level: 13, count: 2 },
        { level: 15, count: 3 },
        { level: 17, count: 4 },
      ],
    },
  ]),
  // Each further use is recorded on Psionic Mastery (1/Day)'s scale.
  ...(
    [
      ["2/Day", 13],
      ["3/Day", 15],
      ["4/Day", 17],
    ] as const
  ).map(([uses, level]) => mysticFeature(`Psionic Mastery (${uses})`, level)),
  mysticFeature("Psionic Body", 20, [
    {
      kind: "defense",
      resist: ["bludgeoning", "piercing", "slashing"],
      immune: ["poison"],
      conditionImmune: ["disease", "poisoned"],
    },
  ]),
  ...["Avatar", "Awakened", "Immortal", "Nomad", "Wu Jen"].map((name) =>
    orderFeature(mystic, order(name), "Bonus Disciplines", 1),
  ),
  ...(
    [
      ["Avatar", "Order of the Avatar"],
      ["Awakened", "Order of the Awakened"],
      ["Immortal", "Order of the Immortal"],
      ["Nomad", "Order of the Nomad"],
      ["Soul Knife", "Order of the Soul Knife"],
      ["Wu Jen", "Order of the Wu Jen"],
    ] as const
  ).map(([name, intro]) => orderFeature(mystic, order(name), intro, 1)),
  orderFeature(
    mystic,
    order("Avatar"),
    "Armor Training",
    1,
    grants({ armor: ["medium", "shield"] }),
  ),
  ...(
    [
      ["Avatar of Battle", 3],
      ["Avatar of Healing", 6],
      ["Avatar of Speed", 14],
    ] as const
  ).map(([name, level]) => orderFeature(mystic, order("Avatar"), name, level)),
  orderFeature(mystic, order("Awakened"), "Awakened Talent", 1, [
    skillsOf(2, [
      "animal handling",
      "deception",
      "insight",
      "intimidation",
      "investigation",
      "perception",
      "persuasion",
    ]),
  ]),
  // Its one use is the catalog's.
  orderFeature(mystic, order("Awakened"), "Psionic Investigation", 3),
  orderFeature(mystic, order("Awakened"), "Psionic Surge", 6),
  // Its one use is the catalog's.
  orderFeature(mystic, order("Awakened"), "Spectral Form", 14, [
    { kind: "active" },
    { kind: "defense", resist: [...DAMAGE_TYPES_BUT_PSYCHIC, "psychic"], while: "active" },
  ]),
  orderFeature(mystic, order("Immortal"), "Immortal Durability", 1, [
    { kind: "bonus", target: "hitPointsPerLevel", value: 1 },
    { kind: "unarmoredBase", value: "con", unlessShield: true },
  ]),
  orderFeature(mystic, order("Immortal"), "Psionic Resilience", 3, [
    { kind: "tempHp", bonus: ["int"] },
  ]),
  orderFeature(mystic, order("Immortal"), "Surge of Health", 6),
  orderFeature(mystic, order("Immortal"), "Immortal Will", 14, [
    { kind: "heal", bonus: ["level", "con"] },
  ]),
  orderFeature(mystic, order("Nomad"), "Breadth of Knowledge", 1),
  // Its one use is the catalog's.
  orderFeature(mystic, order("Nomad"), "Memory of One Thousand Steps", 3),
  orderFeature(mystic, order("Nomad"), "Superior Teleportation", 6),
  orderFeature(mystic, order("Nomad"), "Effortless Journey", 14),
  orderFeature(
    mystic,
    order("Soul Knife"),
    "Martial Training",
    1,
    grants({ armor: ["medium"], weapons: ["martial"] }),
  ),
  // The blade itself is no catalog weapon; its parry is the effect it starts.
  orderFeature(mystic, order("Soul Knife"), "Soul Knife", 1, [
    { kind: "active", endsOn: ["incapacitated"] },
    { kind: "armorClass", value: 2, while: "active" },
  ]),
  orderFeature(
    mystic,
    order("Soul Knife"),
    "Hone the Blade",
    3,
    (
      [
        [2, 1],
        [5, 2],
        [7, 4],
      ] as const
    ).map(
      ([psi, bonus]): Mechanic => ({
        kind: "attack",
        weapons: "melee",
        attack: bonus,
        damage: bonus,
        option: `${SOUL_KNIFE} ${psi} psi points`,
      }),
    ),
  ),
  orderFeature(mystic, order("Soul Knife"), "Consumptive Knife", 6, [
    { kind: "regain", target: "pool", pool: "psi_points", count: 2 },
  ]),
  orderFeature(mystic, order("Soul Knife"), "Phantom Knife", 14),
  orderFeature(mystic, order("Wu Jen"), "Hermit's Study", 1, [
    skillsOf(2, [
      "animal handling",
      "arcana",
      "history",
      "insight",
      "medicine",
      "nature",
      "perception",
      "religion",
      "survival",
    ]),
  ]),
  orderFeature(mystic, order("Wu Jen"), "Elemental Attunement", 3),
  // A pick holds no level range, so the sheet does not hold it to 1st through 3rd level, and the
  // slots psi points create are not ones the sheet regains.
  orderFeature(
    mystic,
    order("Wu Jen"),
    "Arcane Dabbler",
    6,
    spellPicks({ count: 3, from: "Wizard" }),
  ),
  orderFeature(mystic, order("Wu Jen"), "Elemental Mastery", 14),
  egwTrait("Darkvision", [
    "Orc|EGW",
    ...egwDragonborn("Draconblood", "also"),
    ...egwDragonborn("Ravenite", "also"),
  ]),
  ...["Aggressive", "Primal Intuition", "Powerful Build"].map((name) =>
    egwTrait(name, ["Orc|EGW"]),
  ),
  egwTrait("Draconic Ancestry", [
    ...egwDragonborn("Draconblood", "none"),
    ...egwDragonborn("Ravenite", "none"),
  ]),
  // The PHB Breath Weapon's record applies to every lineage of the race, these included.
  egwTrait("Breath Weapon", [
    ...egwDragonborn("Draconblood", "only"),
    ...egwDragonborn("Ravenite", "only"),
  ]),
  // Its one use is the catalog's.
  egwTrait("Forceful Presence", egwDragonborn("Draconblood", "also"), [
    {
      kind: "roll",
      roll: "check",
      skills: ["intimidation", "persuasion"],
      advantage: true,
      against: "once a short rest, with Forceful Presence",
    },
  ]),
  // Its one use is the catalog's.
  egwTrait("Vengeful Assault", egwDragonborn("Ravenite", "also")),
  egwTrait(
    "Incisive Sense",
    ["Elf|PHB|Pallid|EGW"],
    [{ kind: "roll", roll: "check", skills: ["investigation", "insight"], advantage: true }],
  ),
  egwTrait("Blessing of the Moon Weaver", ["Elf|PHB|Pallid|EGW"], [SPELLS]),
  egwTrait("Child of the Wood", ["Halfling|PHB|Lotusden|EGW"], [SPELLS]),
  egwTrait("Timberwalk", ["Halfling|PHB|Lotusden|EGW"]),
  scagTrait("Superior Darkvision", ["Gnome|PHB|Deep/Svirfneblin|SCAG"]),
  scagTrait("Stone Camouflage", ["Gnome|PHB|Deep/Svirfneblin|SCAG"], [hideIn("rocky terrain")]),
  scagTrait(
    "Variant Feature (Choose 1)",
    halfElf(
      "Aquatic Elf Descent",
      "Drow Descent",
      "Moon Elf or Sun Elf Descent",
      "Wood Elf Descent",
    ),
  ),
  scagTrait("Variant Feature; Skill Versatility", halfElf(...SKILL_VERSATILITY)),
  scagTrait("Variant Feature; Swim Speed", halfElf("Aquatic Elf Descent; Swim Speed")),
  scagTrait("Variant Feature; Drow Magic", halfElf("Drow Descent; Drow Magic"), [SPELLS]),
  scagTrait("Variant Feature; Cantrip", halfElf("Moon Elf or Sun Elf Descent; Cantrip"), [SPELLS]),
  scagTrait(
    "Variant Feature; Elf Weapon Training",
    halfElf(
      "Moon Elf or Sun Elf Descent; Elf Weapon Training",
      "Wood Elf Descent; Elf Weapon Training",
    ),
  ),
  scagTrait("Variant Feature; Fleet of Foot", halfElf("Wood Elf Descent; Fleet of Foot")),
  scagTrait("Variant Feature; Mask of the Wild", halfElf("Wood Elf Descent; Mask of the Wild")),
  scagTrait("Silent Speech", ["Halfling|PHB|Ghostwise|SCAG"]),
  scagTrait("Devil's Tongue", tiefling("Devil's Tongue"), [SPELLS]),
  scagTrait("Hellfire", tiefling("Hellfire"), [SPELLS]),
  scagTrait("Winged", tiefling("Winged")),
  scagTrait("Appearance", tiefling("Devil's Tongue", "Hellfire", "Infernal Legacy", "Winged")),
  ...[
    "All Eyes on You",
    "Court Functionary",
    "Ear to the Ground",
    "Inheritance",
    "Kept in Style",
    "Knightly Regard",
    "Library Access",
    "Mercenary Life",
    "Respect of the Stout Folk",
    "Safe Haven",
    "Uthgardt Heritage",
    "Watcher's Eye",
  ].map((name) => narrative({ name, source: "SCAG" })),
  ...[
    "Ballad of the Grinning Fool",
    "Criminal Contact",
    "Researcher",
    "Shadow Network",
    "Shelter of the Faithful",
    "Ship's Passage",
    "Spy Contact",
  ].map((name) => narrative({ name, source: "EGW" })),
  ...[
    "Backstage Pass",
    "By Popular Demand",
    "City Guard",
    "City Secrets",
    "Criminal Connections",
    "Criminal Contact",
    "Discovery",
    "Dual Personalities",
    "False Identity",
    "Gateguide Connection",
    "Guild Membership",
    "Immigrant Experience",
    "Long-Lost Heir",
    "Loyalty Test",
    "Military Rank",
    "Patriar",
    "Professional Courtesy",
    "Religious Community",
    "Researcher",
    "Rumor Monger",
    "Rustic Hospitality",
    "Shelter of the Faithful",
    "Ship's Passage",
    "Smuggler's Sense",
    "Social Vengeance",
    "The Real City",
    "Wanderer",
  ].map((name) => narrative({ name, source: "BGDIA" })),
  // Harvest the Water's advantage is on checks with a tool, which no roll term holds; I'll
  // Patch It! restores a vehicle's hull points, not the character's.
  ...["Down Low", "Harvest the Water", "I'll Patch It!", "Steady"].map((name) =>
    narrative({ name, source: "GoS" }),
  ),
  ...["Adept Linguist", "Historical Knowledge"].map((name) => narrative({ name, source: "ToA" })),
];

const xgeFeature = bookFeature("XGE");
const SHORT_REST_USE: Mechanic = { kind: "uses", count: 1, reset: "short" };
const LONG_REST_USE: Mechanic = { kind: "uses", count: 1, reset: "long" };
const UMBRAL_RESISTANCES = DAMAGE_TYPES_BUT_PSYCHIC.filter(
  (type) => type !== "force" && type !== "radiant",
).concat("psychic");
const bookOptional =
  (source: string) =>
  (name: string, mechanics?: Mechanic[]): FeatureMechanics =>
    mechanics ? { ref: { name, source }, mechanics } : narrative({ name, source });
const xgeOptional = bookOptional("XGE");

/**
 * The classic subclass features, racial feats and optional features of Xanathar's Guide to
 * Everything. A subclass's opening entry, which only describes it, is the narrative mark. So is
 * an effect no vocabulary term holds: a reaction that changes one roll, an effect laid on another
 * creature, an ability modifier added to initiative or to a spell's damage, a language, an
 * effect that holds only on the turn it is made or only while concentrating, and a choice made
 * on each use. A feature whose benefit the sheet applies in part records that part.
 */
const XANATHARS_GUIDE: FeatureMechanics[] = [
  ...(
    [
      [barbarian, ["Ancestral Guardian", "Path of the Ancestral Guardian"], 3],
      [barbarian, ["Storm Herald", "Path of the Storm Herald"], 3],
      [barbarian, ["Zealot", "Path of the Zealot"], 3],
      [bard, ["Glamour", "College of Glamour"], 3],
      [bard, ["Swords", "College of Swords"], 3],
      [bard, ["Whispers", "College of Whispers"], 3],
      [cleric24, ["Forge", "Forge Domain"], 3],
      [cleric24, ["Grave", "Grave Domain"], 3],
      [druid, ["Dreams", "Circle of Dreams"], 2],
      [druid24, ["Dreams", "Circle of Dreams"], 3],
      [druid, ["Shepherd", "Circle of the Shepherd"], 2],
      [druid24, ["Shepherd", "Circle of the Shepherd"], 3],
      [fighter, ["Arcane Archer", "Arcane Archer"], 3],
      [fighter, ["Cavalier", "Cavalier"], 3],
      [fighter, ["Samurai", "Samurai"], 3],
      [monk, ["Drunken Master", "Way of the Drunken Master"], 3],
      [monk, ["Kensei", "Way of the Kensei"], 3],
      [monk, ["Sun Soul", "Way of the Sun Soul"], 3],
      [paladin, ["Conquest", "Oath of Conquest"], 3],
      [paladin, ["Redemption", "Oath of Redemption"], 3],
      [ranger, ["Gloom Stalker", "Gloom Stalker"], 3],
      [ranger, ["Horizon Walker", "Horizon Walker"], 3],
      [ranger, ["Monster Slayer", "Monster Slayer"], 3],
      [rogue, ["Inquisitive", "Inquisitive"], 3],
      [rogue, ["Mastermind", "Mastermind"], 3],
      [rogue, ["Scout", "Scout"], 3],
      [rogue, ["Swashbuckler", "Swashbuckler"], 3],
      [sorcerer, ["Divine Soul", "Divine Soul"], 1],
      [sorcerer24, ["Divine Soul", "Divine Soul"], 3],
      [sorcerer, ["Shadow", "Shadow Magic"], 1],
      [sorcerer24, ["Shadow", "Shadow Magic"], 3],
      [sorcerer, ["Storm", "Storm Sorcery"], 1],
      [sorcerer24, ["Storm", "Storm Sorcery"], 3],
      [warlock24, ["Celestial", "The Celestial"], 3],
      [warlock24, ["Hexblade", "The Hexblade"], 3],
      [wizard, ["War", "War Magic"], 2],
      [wizard24, ["War", "War Magic"], 3],
    ] as const
  ).map(([owner, [subclass, name], level]) => xgeFeature(owner, [subclass, "XGE"], name, level)),
  // The oath's own tenets and its Channel Divinity options, which are other features.
  xgeFeature(paladin, ["Conquest", "XGE"], "Tenets of Conquest", 3),
  xgeFeature(paladin, ["Redemption", "XGE"], "Tenets of Redemption", 3),
  xgeFeature(paladin, ["Conquest", "XGE"], "Channel Divinity", 3),
  xgeFeature(paladin, ["Redemption", "XGE"], "Channel Divinity", 3),
  xgeFeature(bard, ["Swords", "XGE"], "Fighting Style", 3),
  xgeFeature(fighter, ["Arcane Archer", "XGE"], "Additional Arcane Shot Option", 7),
  xgeFeature(fighter, ["Arcane Archer", "XGE"], "Additional Arcane Shot Option", 10),
  xgeFeature(fighter, ["Arcane Archer", "XGE"], "Additional Arcane Shot Option", 15),
  xgeFeature(fighter, ["Arcane Archer", "XGE"], "Additional Arcane Shot Option", 18),
  // Barbarian
  xgeFeature(barbarian, ["Ancestral Guardian", "XGE"], "Ancestral Protectors", 3),
  xgeFeature(barbarian, ["Ancestral Guardian", "XGE"], "Spirit Shield", 6),
  xgeFeature(barbarian, ["Ancestral Guardian", "XGE"], "Vengeful Ancestors", 14),
  xgeFeature(barbarian, ["Storm Herald", "XGE"], "Storm Soul", 6),
  xgeFeature(barbarian, ["Storm Herald", "XGE"], "Shielding Storm", 10),
  xgeFeature(barbarian, ["Storm Herald", "XGE"], "Raging Storm", 14),
  xgeFeature(barbarian, ["Zealot", "XGE"], "Warrior of the Gods", 3),
  xgeFeature(barbarian, ["Zealot", "XGE"], "Fanatical Focus", 6),
  xgeFeature(barbarian, ["Zealot", "XGE"], "Zealous Presence", 10, [LONG_REST_USE]),
  xgeFeature(barbarian, ["Zealot", "XGE"], "Rage beyond Death", 14),
  // Cleric
  xgeFeature(cleric, ["Forge", "XGE"], "Channel Divinity: Artisan's Blessing", 2),
  xgeFeature(cleric24, ["Forge", "XGE"], "Channel Divinity: Artisan's Blessing", 3),
  // The resistance to nonmagical weapon damage holds only in heavy armor.
  xgeFeature(cleric, ["Forge", "XGE"], "Saint of Forge and Fire", 17, [
    { kind: "defense", immune: ["fire"] },
  ]),
  xgeFeature(cleric, ["Grave", "XGE"], "Channel Divinity: Path to the Grave", 2),
  xgeFeature(cleric24, ["Grave", "XGE"], "Channel Divinity: Path to the Grave", 3),
  xgeFeature(cleric, ["Grave", "XGE"], "Potent Spellcasting", 8),
  // Druid
  xgeFeature(druid, ["Dreams", "XGE"], "Hearth of Moonlight and Shadow", 6),
  xgeFeature(druid, ["Dreams", "XGE"], "Walker in Dreams", 14, [LONG_REST_USE]),
  xgeFeature(druid, ["Shepherd", "XGE"], "Speech of the Woods", 2),
  xgeFeature(druid, ["Shepherd", "XGE"], "Mighty Summoner", 6),
  xgeFeature(druid, ["Shepherd", "XGE"], "Faithful Summons", 14, [LONG_REST_USE]),
  // Fighter. Arcane Shot holds the use count Ever-Ready Shot restores.
  xgeFeature(fighter, ["Arcane Archer", "XGE"], "Curving Shot", 7),
  xgeFeature(fighter, ["Arcane Archer", "XGE"], "Magic Arrow", 7),
  xgeFeature(fighter, ["Arcane Archer", "XGE"], "Ever-Ready Shot", 15),
  xgeFeature(fighter, ["Cavalier", "XGE"], "Born to the Saddle", 3, [
    saveAdvantage("to avoid falling off your mount"),
  ]),
  xgeFeature(fighter, ["Cavalier", "XGE"], "Hold the Line", 10),
  xgeFeature(fighter, ["Cavalier", "XGE"], "Vigilant Defender", 18),
  xgeFeature(fighter, ["Samurai", "XGE"], "Rapid Strike", 15),
  xgeFeature(fighter, ["Samurai", "XGE"], "Strength before Death", 18, [LONG_REST_USE]),
  // Monk
  xgeFeature(monk, ["Drunken Master", "XGE"], "Drunken Technique", 3),
  xgeFeature(monk, ["Drunken Master", "XGE"], "Leap to Your Feet", 6),
  xgeFeature(monk, ["Drunken Master", "XGE"], "Redirect Attack", 6),
  xgeFeature(monk, ["Drunken Master", "XGE"], "Tipsy Sway", 6),
  xgeFeature(monk, ["Drunken Master", "XGE"], "Drunkard's Luck", 11),
  xgeFeature(monk, ["Drunken Master", "XGE"], "Intoxicated Frenzy", 17),
  xgeFeature(monk, ["Kensei", "XGE"], "Agile Parry", 3, [
    { kind: "active" },
    { kind: "armorClass", value: 2, while: "active" },
  ]),
  // The kensei weapons are chosen by type, which no pick holds.
  xgeFeature(monk, ["Kensei", "XGE"], "Path of the Kensei", 3, [
    {
      kind: "pick",
      fields: ["tools"],
      count: 1,
      from: ["calligrapher's supplies", "painter's supplies"],
    },
  ]),
  xgeFeature(monk, ["Kensei", "XGE"], "Unerring Accuracy", 17),
  xgeFeature(monk, ["Sun Soul", "XGE"], "Radiant Sun Bolt", 3),
  xgeFeature(monk, ["Sun Soul", "XGE"], "Sun Shield", 17),
  // Paladin
  xgeFeature(paladin, ["Conquest", "XGE"], "Aura of Conquest", 7),
  xgeFeature(paladin, ["Conquest", "XGE"], "Scornful Rebuke", 15),
  xgeFeature(paladin, ["Redemption", "XGE"], "Emissary of Peace", 3, [
    { kind: "active" },
    { kind: "roll", roll: "check", skills: ["persuasion"], bonus: 5, while: "active" },
  ]),
  xgeFeature(paladin, ["Redemption", "XGE"], "Aura of the Guardian", 7),
  xgeFeature(paladin, ["Redemption", "XGE"], "Emissary of Redemption", 20),
  // Ranger
  xgeFeature(ranger, ["Gloom Stalker", "XGE"], "Stalker's Flurry", 11),
  xgeFeature(ranger, ["Gloom Stalker", "XGE"], "Shadowy Dodge", 15),
  xgeFeature(ranger, ["Horizon Walker", "XGE"], "Detect Portal", 3, [SHORT_REST_USE]),
  xgeFeature(ranger, ["Horizon Walker", "XGE"], "Ethereal Step", 7, [SHORT_REST_USE]),
  xgeFeature(ranger, ["Horizon Walker", "XGE"], "Spectral Defense", 15),
  xgeFeature(ranger, ["Monster Slayer", "XGE"], "Supernatural Defense", 7),
  xgeFeature(ranger, ["Monster Slayer", "XGE"], "Slayer's Counter", 15),
  // Rogue
  xgeFeature(rogue, ["Inquisitive", "XGE"], "Ear for Deceit", 3),
  xgeFeature(rogue, ["Inquisitive", "XGE"], "Eye for Detail", 3),
  xgeFeature(rogue, ["Inquisitive", "XGE"], "Insightful Fighting", 3),
  xgeFeature(rogue, ["Inquisitive", "XGE"], "Steady Eye", 9, [
    {
      kind: "roll",
      roll: "check",
      skills: ["perception", "investigation"],
      advantage: true,
      against: "if you move no more than half your speed on the same turn",
    },
  ]),
  xgeFeature(rogue, ["Inquisitive", "XGE"], "Eye for Weakness", 17),
  xgeFeature(rogue, ["Mastermind", "XGE"], "Insightful Manipulator", 9),
  xgeFeature(rogue, ["Mastermind", "XGE"], "Misdirection", 13),
  xgeFeature(rogue, ["Mastermind", "XGE"], "Soul of Deceit", 17),
  xgeFeature(rogue, ["Scout", "XGE"], "Skirmisher", 3),
  xgeFeature(rogue, ["Scout", "XGE"], "Sudden Strike", 17),
  xgeFeature(rogue, ["Swashbuckler", "XGE"], "Fancy Footwork", 3),
  xgeFeature(rogue, ["Swashbuckler", "XGE"], "Rakish Audacity", 3),
  xgeFeature(rogue, ["Swashbuckler", "XGE"], "Panache", 9),
  xgeFeature(rogue, ["Swashbuckler", "XGE"], "Elegant Maneuver", 13),
  // Sorcerer
  xgeFeature(sorcerer, ["Divine Soul", "XGE"], "Empowered Healing", 6),
  xgeFeature(sorcerer, ["Divine Soul", "XGE"], "Otherworldly Wings", 14, [
    { kind: "active", endsOn: ["incapacitated"] },
    { kind: "speed", fly: 30, while: "active" },
  ]),
  xgeFeature(sorcerer, ["Shadow", "XGE"], "Shadow Walk", 14),
  xgeFeature(sorcerer, ["Shadow", "XGE"], "Umbral Form", 18, [
    { kind: "active", endsOn: ["incapacitated"] },
    { kind: "defense", resist: UMBRAL_RESISTANCES, while: "active" },
  ]),
  xgeFeature(sorcerer, ["Storm", "XGE"], "Tempestuous Magic", 1),
  xgeFeature(sorcerer, ["Storm", "XGE"], "Wind Speaker", 1),
  xgeFeature(sorcerer, ["Storm", "XGE"], "Storm Guide", 6),
  xgeFeature(sorcerer, ["Storm", "XGE"], "Wind Soul", 18, [
    SHORT_REST_USE,
    { kind: "defense", immune: ["lightning", "thunder"] },
    { kind: "speed", fly: 60 },
  ]),
  // Warlock
  xgeFeature(warlock, ["Celestial", "XGE"], "Radiant Soul", 6, [
    { kind: "defense", resist: ["radiant"] },
  ]),
  xgeFeature(warlock, ["Hexblade", "XGE"], "Armor of Hexes", 10),
  xgeFeature(warlock, ["Hexblade", "XGE"], "Master of Hexes", 14),
  // Wizard
  xgeFeature(wizard, ["War", "XGE"], "Arcane Deflection", 2),
  xgeFeature(wizard, ["War", "XGE"], "Tactical Wit", 2),
  xgeFeature(wizard, ["War", "XGE"], "Power Surge", 6),
  xgeFeature(wizard, ["War", "XGE"], "Durable Magic", 10),
  xgeFeature(wizard, ["War", "XGE"], "Deflecting Shroud", 14),
  // Racial feats
  xgeOptional("Bountiful Luck"),
  xgeOptional("Elven Accuracy"),
  xgeOptional("Fade Away", [SHORT_REST_USE]),
  xgeOptional("Flames of Phlegethos"),
  xgeOptional("Infernal Constitution", [
    { kind: "defense", resist: ["cold", "poison"] },
    saveAdvantage("against being poisoned"),
  ]),
  xgeOptional("Prodigy", [
    { kind: "pick", fields: ["skills"], count: 1 },
    { kind: "pick", fields: ["tools"], count: 1 },
    { kind: "pick", fields: ["languages"], count: 1 },
    { kind: "pick", fields: ["expertise"], count: 1 },
  ]),
  xgeOptional("Squat Nimbleness", [
    { kind: "speed", bonus: 5 },
    { kind: "pick", fields: ["skills"], count: 1, from: ["acrobatics", "athletics"] },
    {
      kind: "roll",
      roll: "check",
      skills: ["athletics", "acrobatics"],
      advantage: true,
      against: "to escape from being grappled",
    },
  ]),
  // Eldritch invocations
  xgeOptional("Aspect of the Moon"),
  xgeOptional("Cloak of Flies", [
    SHORT_REST_USE,
    { kind: "active", endsOn: ["incapacitated"] },
    { kind: "roll", roll: "check", skills: ["intimidation"], advantage: true, while: "active" },
  ]),
  xgeOptional("Ghostly Gaze", [SHORT_REST_USE, { kind: "active" }]),
  xgeOptional("Grasp of Hadar"),
  xgeOptional("Lance of Lethargy"),
  xgeOptional("Maddening Hex"),
  xgeOptional("Relentless Hex"),
];

const tceFeature = bookFeature("TCE");
const tceOptional = bookOptional("TCE");
const tceTrait = bookTrait("TCE");
const bookClassFeature =
  (source: string) =>
  (
    owner: [string, string],
    name: string,
    level: number,
    mechanics?: Mechanic[],
  ): FeatureMechanics =>
    mechanics
      ? classFeature(owner, [name, source], level, mechanics)
      : narrative({ name, source, className: owner[0], classSource: owner[1], level });
const tceClassFeature = bookClassFeature("TCE");
const BLESSED_STRIKES: Mechanic[] = [
  {
    kind: "extraDamage",
    dice: "1d8",
    type: "radiant",
    oncePerTurn: true,
    option: "when a creature takes damage from one of your cantrips or weapon attacks",
  },
];
const PSYCHIC_RESISTANCE: Mechanic = { kind: "defense", resist: ["psychic"] };

/**
 * The classic class features, subclass features, feats, optional features and Custom Lineage
 * traits of Tasha's Cauldron of Everything. An overview of a subclass, the optional features that
 * only let a choice be swapped, an effect laid on another creature, a reroll or a roll treated as
 * a 10, an infused item's benefit and a choice made on each rest are the narrative mark. A
 * feature whose benefit the sheet applies in part records that part.
 */
const TASHAS_CAULDRON: FeatureMechanics[] = [
  // Artificer
  tceClassFeature(artificer, "Magical Tinkering", 1),
  tceClassFeature(artificer, "Optional Rule: Firearm Proficiency", 1),
  tceClassFeature(artificer, "Spellcasting", 1),
  tceClassFeature(artificer, "Infuse Item", 2),
  tceClassFeature(artificer, "Infusions Known", 2),
  tceClassFeature(artificer, "Artificer Specialist", 3),
  tceClassFeature(artificer, "The Right Tool for the Job", 3),
  ...[4, 8, 12, 16, 19].map((level) =>
    tceClassFeature(artificer, "Ability Score Improvement", level),
  ),
  ...[5, 9, 15].map((level) => tceClassFeature(artificer, "Artificer Specialist Feature", level)),
  tceClassFeature(artificer, "Tool Expertise", 6),
  tceClassFeature(artificer, "Magic Item Adept", 10),
  tceClassFeature(artificer, "Magic Item Savant", 14),
  tceClassFeature(artificer, "Magic Item Master", 18),
  // Optional class features
  tceClassFeature(barbarian, "Primal Knowledge", 3),
  tceClassFeature(barbarian, "Instinctive Pounce", 7),
  tceClassFeature(bard, "Bardic Versatility", 4),
  tceClassFeature(cleric, "Cantrip Versatility", 4),
  tceClassFeature(druid, "Wild Companion", 2),
  tceClassFeature(druid, "Cantrip Versatility", 4),
  tceClassFeature(fighter, "Martial Versatility", 4),
  tceClassFeature(monk, "Dedicated Weapon", 2),
  tceClassFeature(monk, "Ki-Fueled Attack", 3),
  tceClassFeature(paladin, "Martial Versatility", 4),
  tceClassFeature(ranger, "Deft Explorer", 1, [
    ...expertiseIn(1),
    { kind: "pick", fields: ["languages"], count: 2 },
  ]),
  tceClassFeature(ranger, "Spellcasting Focus", 2),
  tceClassFeature(ranger, "Martial Versatility", 4),
  tceClassFeature(sorcerer, "Metamagic Options", 3),
  tceClassFeature(sorcerer, "Sorcerous Versatility", 4),
  tceClassFeature(sorcerer, "Magical Guidance", 5),
  tceClassFeature(warlock, "Eldritch Versatility", 4),
  tceClassFeature(wizard, "Cantrip Formulas", 3),
  ...(
    [
      [death, 8],
      [ambition, 8],
      [solidarity, 8],
      [strength, 8],
      [zeal, 8],
      [arcana, 8],
    ] as const
  ).map(([domain, level]) => ({
    ...tceFeature(cleric, domain, "Blessed Strikes", level, BLESSED_STRIKES),
    houseRule: "optionalClassFeatures" as const,
  })),
  tceFeature(fighter, ["Battle Master", "PHB"], "Maneuver Options", 3),
  // Subclasses
  ...(
    [
      [artificer, ["Alchemist", "TCE"], "Alchemist", 3],
      [artificer, ["Armorer", "TCE"], "Armorer", 3],
      [artificer, ["Armorer", "TCE"], "Arcane Armor", 3],
      [artificer, ["Armorer", "TCE"], "Armor Model", 3],
      [artificer, ["Armorer", "TCE"], "Dampening Field", 3],
      [artificer, ["Armorer", "TCE"], "Powered Steps", 3],
      [artificer, ["Armorer", "TCE"], "Thunder Gauntlets", 3],
      [artificer, ["Armorer", "TCE"], "Armor Modifications", 9],
      [artificer, ["Armorer", "TCE"], "Perfected Armor", 15],
      [artificer, ["Artillerist", "TCE"], "Artillerist", 3],
      [artificer, ["Artillerist", "TCE"], "Arcane Firearm", 5],
      [artificer, ["Artillerist", "TCE"], "Fortified Position", 15],
      [artificer, ["Battle Smith", "TCE"], "Battle Smith", 3],
      [barbarian, ["Beast", "TCE"], "Path of the Beast", 3],
      [barbarian, ["Beast", "TCE"], "Bestial Soul", 6],
      [barbarian, ["Wild Magic", "TCE"], "Path of Wild Magic", 3],
      [barbarian, ["Wild Magic", "TCE"], "Unstable Backlash", 10],
      [barbarian, ["Wild Magic", "TCE"], "Controlled Surge", 14],
      [bard, ["Creation", "TCE"], "College of Creation", 3],
      [bard, ["Creation", "TCE"], "Animating Performance", 6],
      [bard, ["Creation", "TCE"], "Creative Crescendo", 14],
      [bard, ["Eloquence", "TCE"], "College of Eloquence", 3],
      [bard, ["Eloquence", "TCE"], "Silver Tongue", 3],
      [bard, ["Eloquence", "TCE"], "Unsettling Words", 3],
      [bard, ["Eloquence", "TCE"], "Unfailing Inspiration", 6],
      [cleric, ["Order", "TCE"], "Voice of Authority", 1],
      [cleric, ["Order", "TCE"], "Order's Wrath", 17],
      [cleric24, ["Order", "TCE"], "Order Domain", 3],
      [cleric24, ["Order", "TCE"], "Channel Divinity: Order's Demand", 3],
      [cleric, ["Peace", "TCE"], "Protective Bond", 6],
      [cleric, ["Peace", "TCE"], "Potent Spellcasting", 8],
      [cleric, ["Peace", "TCE"], "Expansive Bond", 17],
      [cleric24, ["Peace", "TCE"], "Peace Domain", 3],
      [cleric, ["Twilight", "TCE"], "Vigilant Blessing", 1],
      [cleric, ["Twilight", "TCE"], "Twilight Shroud", 17],
      [cleric24, ["Twilight", "TCE"], "Twilight Domain", 3],
      [druid, ["Spores", "TCE"], "Circle of Spores", 2],
      [druid24, ["Spores", "TCE"], "Circle of Spores", 3],
      [druid, ["Stars", "TCE"], "Circle of Stars", 2],
      [druid24, ["Stars", "TCE"], "Circle of Stars", 3],
      [druid, ["Stars", "TCE"], "Starry Form", 2],
      [druid, ["Stars", "TCE"], "Archer", 2],
      [druid, ["Stars", "TCE"], "Dragon", 2],
      [druid, ["Stars", "TCE"], "Twinkling Constellations", 10],
      [druid, ["Stars", "TCE"], "Full of Stars", 14],
      [druid, ["Wildfire", "TCE"], "Circle of Wildfire", 2],
      [druid24, ["Wildfire", "TCE"], "Circle of Wildfire", 3],
      [fighter, ["Psi Warrior", "TCE"], "Psi Warrior", 3],
      [fighter, ["Psi Warrior", "TCE"], "Protective Field", 3],
      [fighter, ["Psi Warrior", "TCE"], "Telekinetic Adept", 7],
      [fighter, ["Rune Knight", "TCE"], "Rune Knight", 3],
      ...[7, 10, 15].map(
        (level) => [fighter, ["Rune Knight", "TCE"], "Additional Rune Known", level] as const,
      ),
      [monk, ["Astral Self", "TCE"], "Way of the Astral Self", 3],
      [monk, ["Astral Self", "TCE"], "Forms of Your Astral Self", 3],
      [monk, ["Astral Self", "TCE"], "Visage of the Astral Self", 6],
      [monk, ["Mercy", "TCE"], "Way of Mercy", 3],
      [monk, ["Mercy", "TCE"], "Physician's Touch", 6],
      [monk, ["Mercy", "TCE"], "Flurry of Healing and Harm", 11],
      [paladin, ["Glory", "TCE"], "Oath of Glory", 3],
      [paladin, ["Glory", "TCE"], "Channel Divinity", 3],
      [paladin, ["Glory", "TCE"], "Tenets of Glory", 3],
      [paladin, ["Watchers", "TCE"], "Oath of the Watchers", 3],
      [paladin, ["Watchers", "TCE"], "Channel Divinity", 3],
      [paladin, ["Watchers", "TCE"], "Tenets of the Watchers", 3],
      [paladin, ["Watchers", "TCE"], "Vigilant Rebuke", 15],
      [ranger, ["Beast Master", "PHB"], "Primal Companion", 3],
      [ranger, ["Fey Wanderer", "TCE"], "Fey Wanderer", 3],
      [ranger, ["Swarmkeeper", "TCE"], "Swarmkeeper", 3],
      [rogue, ["Phantom", "TCE"], "Phantom", 3],
      [rogue, ["Phantom", "TCE"], "Whispers of the Dead", 3],
      [rogue, ["Phantom", "TCE"], "Tokens of the Departed", 9],
      [rogue, ["Phantom", "TCE"], "Death's Friend", 17],
      [rogue, ["Soulknife", "TCE"], "Soulknife", 3],
      [rogue, ["Soulknife", "TCE"], "Psi-Bolstered Knack", 3],
      [rogue, ["Soulknife", "TCE"], "Psychic Whispers", 3],
      [rogue, ["Soulknife", "TCE"], "Psychic Blades", 3],
      [rogue, ["Soulknife", "TCE"], "Soul Blades", 9],
      [rogue, ["Soulknife", "TCE"], "Psychic Teleportation", 9],
      [sorcerer, ["Aberrant Mind", "TCE"], "Aberrant Mind", 1],
      [sorcerer24, ["Aberrant Mind", "TCE"], "Aberrant Mind", 3],
      [sorcerer, ["Aberrant Mind", "TCE"], "Telepathic Speech", 1],
      [sorcerer, ["Aberrant Mind", "TCE"], "Psionic Sorcery", 6],
      [sorcerer, ["Aberrant Mind", "TCE"], "Revelation in Flesh", 14],
      [sorcerer, ["Clockwork Soul", "TCE"], "Clockwork Soul", 1],
      [sorcerer24, ["Clockwork Soul", "TCE"], "Clockwork Soul", 3],
      [sorcerer, ["Clockwork Soul", "TCE"], "Bastion of Law", 6],
      [warlock, ["Fathomless", "TCE"], "Gift of the Sea", 1],
      [warlock, ["Fathomless", "TCE"], "Guardian Coil", 6],
      [warlock24, ["Fathomless", "TCE"], "The Fathomless", 3],
      [warlock, ["Genie", "TCE"], "Genie's Vessel", 1],
      [warlock24, ["Genie", "TCE"], "The Genie", 3],
      [wizard, ["Bladesinging", "TCE"], "Bladesinging", 2],
      [wizard24, ["Bladesinging", "TCE"], "Bladesinging", 3],
      [wizard, ["Bladesinging", "TCE"], "Bladesinger Styles", 2],
      [wizard, ["Bladesinging", "TCE"], "Song of Defense", 10],
      [wizard, ["Scribes", "TCE"], "Order of Scribes", 2],
      [wizard24, ["Scribes", "TCE"], "Order of Scribes", 3],
      [wizard, ["Scribes", "TCE"], "Awakened Spellbook", 2],
      [wizard, ["Scribes", "TCE"], "Wizardly Quill", 2],
      [wizard, ["Scribes", "TCE"], "Master Scrivener", 10],
    ] as const
  ).map(([owner, subclass, name, level]) => tceFeature(owner, [...subclass], name, level)),
  // Subclass features that carry mechanics
  tceFeature(bard, ["Creation", "TCE"], "Performance of Creation", 3, [LONG_REST_USE]),
  tceFeature(bard, ["Eloquence", "TCE"], "Universal Speech", 6, [LONG_REST_USE]),
  tceFeature(cleric, ["Peace", "TCE"], "Implement of Peace", 1, [
    { kind: "pick", fields: ["skills"], count: 1, from: ["insight", "performance", "persuasion"] },
  ]),
  tceFeature(druid, ["Spores", "TCE"], "Fungal Body", 14, [
    { kind: "defense", conditionImmune: ["blinded", "deafened", "frightened", "poisoned"] },
  ]),
  tceFeature(fighter, ["Psi Warrior", "TCE"], "Telekinetic Movement", 3, [SHORT_REST_USE]),
  tceFeature(fighter, ["Psi Warrior", "TCE"], "Psi-Powered Leap", 7, [SHORT_REST_USE]),
  tceFeature(fighter, ["Psi Warrior", "TCE"], "Guarded Mind", 10, [PSYCHIC_RESISTANCE]),
  tceFeature(fighter, ["Psi Warrior", "TCE"], "Bulwark of Force", 15, [LONG_REST_USE]),
  tceFeature(paladin, ["Glory", "TCE"], "Peerless Athlete", 3, [
    { kind: "active" },
    {
      kind: "roll",
      roll: "check",
      skills: ["athletics", "acrobatics"],
      advantage: true,
      while: "active",
    },
  ]),
  tceFeature(paladin, ["Glory", "TCE"], "Living Legend", 20, [
    LONG_REST_USE,
    { kind: "active" },
    { kind: "roll", roll: "check", abilities: ["cha"], advantage: true, while: "active" },
  ]),
  tceFeature(paladin, ["Watchers", "TCE"], "Watcher's Will", 3, [
    { kind: "active" },
    {
      kind: "roll",
      roll: "save",
      abilities: ["int", "wis", "cha"],
      advantage: true,
      while: "active",
    },
  ]),
  tceFeature(paladin, ["Watchers", "TCE"], "Aura of the Sentinel", 7, [
    { kind: "bonus", target: "initiative", value: "proficiency" },
  ]),
  tceFeature(ranger, ["Fey Wanderer", "TCE"], "Otherworldly Glamour", 3, [
    {
      kind: "pick",
      fields: ["skills"],
      count: 1,
      from: ["deception", "performance", "persuasion"],
    },
    // A bonus falls on named skills only, so a Charisma check outside these four goes without.
    {
      kind: "roll",
      roll: "check",
      skills: ["deception", "intimidation", "performance", "persuasion"],
      bonus: "wis",
    },
  ]),
  tceFeature(rogue, ["Soulknife", "TCE"], "Psychic Veil", 13, [LONG_REST_USE]),
  tceFeature(sorcerer, ["Aberrant Mind", "TCE"], "Psychic Defenses", 6, [
    PSYCHIC_RESISTANCE,
    saveAdvantage(CHARMED_OR_FRIGHTENED),
  ]),
  tceFeature(sorcerer, ["Clockwork Soul", "TCE"], "Trance of Order", 14, [LONG_REST_USE]),
  tceFeature(warlock, ["Fathomless", "TCE"], "Oceanic Soul", 6, [
    { kind: "defense", resist: ["cold"] },
  ]),
  tceFeature(warlock, ["Fathomless", "TCE"], "Fathomless Plunge", 14, [SHORT_REST_USE]),
  tceFeature(wizard, ["Scribes", "TCE"], "One with the Word", 14, [
    {
      kind: "roll",
      roll: "check",
      skills: ["arcana"],
      advantage: true,
      against: "while your Awakened Spellbook is on your person",
    },
  ]),
  // Feats
  tceOptional("Eldritch Adept"),
  tceOptional("Fighting Initiate"),
  tceOptional("Gunner", grants({ weapons: ["firearms"] })),
  tceOptional("Metamagic Adept"),
  tceOptional("Poisoner", grants({ tools: ["poisoner's kit"] })),
  tceOptional("Skill Expert", [skillsOf(1), ...expertiseIn(1)]),
  tceOptional("Slasher"),
  // Optional features: maneuvers, infusions and metamagic
  ...[
    "Ambush",
    "Bait and Switch",
    "Commanding Presence",
    "Grappling Strike",
    "Interception",
    "Tactical Assessment",
    "Armor of Magical Strength",
    "Arcane Propulsion Armor",
    "Boots of the Winding Path",
    "Enhanced Arcane Focus",
    "Enhanced Defense",
    "Helm of Awareness",
    "Mind Sharpener",
    "Rebuke of the Talisman",
    "Replicate Magic Item",
    "Repulsion Shield",
    "Resistant Armor",
    "Spell-Refueling Ring",
    "Seeking Spell",
    "Transmuted Spell",
    "Unarmed Fighting",
  ].map((name) => tceOptional(name)),
  tceOptional("Eldritch Mind", [saveAdvantage("to maintain your concentration on a spell")]),
  // Custom Lineage
  tceTrait("Feat", [
    "Custom Lineage|TCE",
    "Custom Lineage; Darkvision|TCE",
    "Custom Lineage; Skill Proficiency|TCE",
  ]),
  tceTrait("Variable Trait", ["Custom Lineage|TCE"]),
  tceTrait(
    "Variable Trait; Darkvision",
    ["Custom Lineage; Darkvision|TCE"],
    [{ kind: "sense", name: "darkvision", range: 60 }],
  ),
  tceTrait(
    "Variable Trait; Skill Proficiency",
    ["Custom Lineage; Skill Proficiency|TCE"],
    [skillsOf(1)],
  ),
];

const phbFeature = bookFeature("PHB");
const phbClassFeature = bookClassFeature("PHB");
const phbTrait = bookTrait("PHB");

/**
 * The classic Wizard and Warlock features of the Player's Handbook that carried no record. A
 * once-per-rest feature records its use; what a roll or a spell it adds cannot say, such as
 * Dark One's Own Luck's d10, stays in the rules text. Spell Resistance records its saving throw
 * advantage only, since its resistance holds against the damage of spells alone. The 2024
 * classes hold the school and patron rows at level 3.
 */
const PLAYERS_HANDBOOK_ARCANE: FeatureMechanics[] = [
  // Warlock
  ...[4, 8, 12, 16, 19].map((level) =>
    phbClassFeature(warlock, "Ability Score Improvement", level),
  ),
  phbClassFeature(warlock, "Eldritch Invocations", 2),
  phbClassFeature(warlock, "Otherworldly Patron", 1),
  ...[6, 10, 14].map((level) => phbClassFeature(warlock, "Otherworldly Patron feature", level)),
  phbClassFeature(warlock, "Pact Boon", 3),
  phbClassFeature(warlock, "Pact Magic", 1),
  // Wizard
  ...[4, 8, 12, 16, 19].map((level) => phbClassFeature(wizard, "Ability Score Improvement", level)),
  phbClassFeature(wizard, "Arcane Tradition", 2),
  ...[6, 10, 14].map((level) => phbClassFeature(wizard, "Arcane Tradition feature", level)),
  phbClassFeature(wizard, "Spellcasting", 1),
  // Wizard, Abjuration
  phbFeature(wizard, ["Abjuration", "PHB"], "Abjuration Savant", 2),
  phbFeature(wizard, ["Abjuration", "PHB"], "School of Abjuration", 2),
  phbFeature(wizard24, ["Abjuration", "PHB"], "School of Abjuration", 3),
  phbFeature(wizard, ["Abjuration", "PHB"], "Projected Ward", 6),
  phbFeature(wizard, ["Abjuration", "PHB"], "Improved Abjuration", 10),
  phbFeature(wizard, ["Abjuration", "PHB"], "Spell Resistance", 14, [
    saveAdvantage("against spells"),
  ]),
  // Warlock, Great Old One
  phbFeature(warlock, ["Great Old One", "PHB"], "Awakened Mind", 1),
  phbFeature(warlock24, ["Great Old One", "PHB"], "The Great Old One", 3),
  phbFeature(warlock, ["Great Old One", "PHB"], "Thought Shield", 10, [PSYCHIC_RESISTANCE]),
  phbFeature(warlock, ["Great Old One", "PHB"], "Create Thrall", 14),
  // Wizard, Conjuration
  phbFeature(wizard, ["Conjuration", "PHB"], "Conjuration Savant", 2),
  phbFeature(wizard, ["Conjuration", "PHB"], "Minor Conjuration", 2),
  phbFeature(wizard, ["Conjuration", "PHB"], "School of Conjuration", 2),
  phbFeature(wizard24, ["Conjuration", "PHB"], "School of Conjuration", 3),
  phbFeature(wizard, ["Conjuration", "PHB"], "Benign Transposition", 6),
  phbFeature(wizard, ["Conjuration", "PHB"], "Focused Conjuration", 10),
  // Warlock, Fiend
  phbFeature(warlock24, ["Fiend", "PHB"], "The Fiend", 3),
  phbFeature(warlock, ["Fiend", "PHB"], "Dark One's Own Luck", 6, [SHORT_REST_USE]),
  phbFeature(warlock, ["Fiend", "PHB"], "Fiendish Resilience", 10),
  phbFeature(warlock, ["Fiend", "PHB"], "Hurl Through Hell", 14, [LONG_REST_USE]),
  // Wizard, Divination
  phbFeature(wizard, ["Divination", "PHB"], "Divination Savant", 2),
  phbFeature(wizard, ["Divination", "PHB"], "School of Divination", 2),
  phbFeature(wizard24, ["Divination", "PHB"], "School of Divination", 3),
  phbFeature(wizard, ["Divination", "PHB"], "Expert Divination", 6),
  // Wizard, Evocation
  phbFeature(wizard, ["Evocation", "PHB"], "Evocation Savant", 2),
  phbFeature(wizard, ["Evocation", "PHB"], "School of Evocation", 2),
  phbFeature(wizard, ["Evocation", "PHB"], "Sculpt Spells", 2),
  phbFeature(wizard24, ["Evocation", "PHB"], "School of Evocation", 3),
  phbFeature(wizard, ["Evocation", "PHB"], "Potent Cantrip", 6),
  phbFeature(wizard, ["Evocation", "PHB"], "Empowered Evocation", 10),
  // Wizard, Enchantment
  phbFeature(wizard, ["Enchantment", "PHB"], "Enchantment Savant", 2),
  phbFeature(wizard, ["Enchantment", "PHB"], "School of Enchantment", 2),
  phbFeature(wizard24, ["Enchantment", "PHB"], "School of Enchantment", 3),
  phbFeature(wizard, ["Enchantment", "PHB"], "Split Enchantment", 10),
  // Wizard, Illusion
  phbFeature(wizard, ["Illusion", "PHB"], "Illusion Savant", 2),
  phbFeature(wizard, ["Illusion", "PHB"], "School of Illusion", 2),
  phbFeature(wizard24, ["Illusion", "PHB"], "School of Illusion", 3),
  phbFeature(wizard, ["Illusion", "PHB"], "Malleable Illusions", 6),
  phbFeature(wizard, ["Illusion", "PHB"], "Illusory Self", 10, [SHORT_REST_USE]),
  phbFeature(wizard, ["Illusion", "PHB"], "Illusory Reality", 14),
  // Wizard, Transmutation
  phbFeature(wizard, ["Transmutation", "PHB"], "Minor Alchemy", 2),
  phbFeature(wizard, ["Transmutation", "PHB"], "School of Transmutation", 2),
  phbFeature(wizard, ["Transmutation", "PHB"], "Transmutation Savant", 2),
  phbFeature(wizard24, ["Transmutation", "PHB"], "School of Transmutation", 3),
  phbFeature(wizard, ["Transmutation", "PHB"], "Transmuter's Stone", 6),
  phbFeature(wizard, ["Transmutation", "PHB"], "Shapechanger", 10, [SHORT_REST_USE]),
  // Warlock, Archfey
  phbFeature(warlock24, ["Archfey", "PHB"], "The Archfey", 3),
  phbFeature(warlock, ["Archfey", "PHB"], "Misty Escape", 6, [SHORT_REST_USE]),
  // Wizard, Necromancy
  phbFeature(wizard, ["Necromancy", "PHB"], "Necromancy Savant", 2),
  phbFeature(wizard, ["Necromancy", "PHB"], "School of Necromancy", 2),
  phbFeature(wizard24, ["Necromancy", "PHB"], "School of Necromancy", 3),
  phbFeature(wizard, ["Necromancy", "PHB"], "Undead Thralls", 6),
];

/**
 * The classic Cleric and Bard features of the Player's Handbook that carried no record. A
 * feature that works on another creature, such as Cutting Words or Dampen Elements, a die or
 * spell damage a record cannot say, or a condition the sheet does not track, such as Stormborn's
 * flight outdoors and Avatar of Battle's resistance to nonmagical damage, is the narrative mark.
 * The 2024 Cleric holds the domain rows and the domain's Channel Divinity at level 3.
 */
const PLAYERS_HANDBOOK_DIVINE: FeatureMechanics[] = [
  // Bard
  ...[4, 8, 12, 16, 19].map((level) => phbClassFeature(bard, "Ability Score Improvement", level)),
  phbClassFeature(bard, "Spellcasting", 1),
  phbClassFeature(bard, "Bard College", 3),
  ...[6, 14].map((level) => phbClassFeature(bard, "Bard College feature", level)),
  ...[
    ["d8", 5],
    ["d10", 10],
    ["d12", 15],
  ].map(([die, level]) => phbClassFeature(bard, `Bardic Inspiration (${die})`, Number(level))),
  ...[
    ["d8", 9],
    ["d10", 13],
    ["d12", 17],
  ].map(([die, level]) => phbClassFeature(bard, `Song of Rest (${die})`, Number(level))),
  // Bard, Lore
  phbFeature(bard, ["Lore", "PHB"], "College of Lore", 3),
  phbFeature(bard, ["Lore", "PHB"], "Cutting Words", 3),
  // Bard, Valor
  phbFeature(bard, ["Valor", "PHB"], "College of Valor", 3),
  phbFeature(bard, ["Valor", "PHB"], "Combat Inspiration", 3),
  phbFeature(bard, ["Valor", "PHB"], "Battle Magic", 14),
  // Cleric
  ...[4, 8, 12, 16, 19].map((level) => phbClassFeature(cleric, "Ability Score Improvement", level)),
  phbClassFeature(cleric, "Spellcasting", 1),
  ...[6, 18].map((level) => phbClassFeature(cleric, "Channel Divinity", level)),
  ...[2, 6, 8, 17].map((level) => phbClassFeature(cleric, "Divine Domain feature", level)),
  ...[
    ["CR 1/2", 5],
    ["CR 1", 8],
    ["CR 2", 11],
    ["CR 3", 14],
    ["CR 4", 17],
  ].map(([cr, level]) => phbClassFeature(cleric, `Destroy Undead (${cr})`, Number(level))),
  phbClassFeature(cleric, "Divine Intervention Improvement", 20),
  // Cleric, Knowledge
  phbFeature(cleric, ["Knowledge", "PHB"], "Channel Divinity: Knowledge of the Ages", 2),
  phbFeature(cleric24, ["Knowledge", "PHB"], "Channel Divinity: Knowledge of the Ages", 3),
  // Cleric, Light; the 2014 row's save DC is in `SAVE_DCS`
  phbFeature(cleric24, ["Light", "PHB"], "Channel Divinity: Radiance of the Dawn", 3, [
    { kind: "dc", spell: "Cleric" },
  ]),
  // Cleric, Nature
  phbFeature(cleric24, ["Nature", "PHB"], "Channel Divinity: Charm Animals and Plants", 3, [
    { kind: "dc", spell: "Cleric" },
  ]),
  // Cleric, Tempest
  phbFeature(cleric, ["Tempest", "PHB"], "Channel Divinity: Destructive Wrath", 2),
  phbFeature(cleric24, ["Tempest", "PHB"], "Channel Divinity: Destructive Wrath", 3),
  ...["Knowledge", "Life", "Light", "Nature", "Tempest", "Trickery", "War"].map((domain) =>
    phbFeature(cleric24, [domain, "PHB"], `${domain} Domain`, 3),
  ),
  phbFeature(cleric, ["Knowledge", "PHB"], "Potent Spellcasting", 8),
  phbFeature(cleric, ["Knowledge", "PHB"], "Visions of the Past", 17),
  phbFeature(cleric, ["Light", "PHB"], "Improved Flare", 6),
  phbFeature(cleric, ["Light", "PHB"], "Potent Spellcasting", 8),
  phbFeature(cleric, ["Light", "PHB"], "Corona of Light", 17),
  phbFeature(cleric, ["Nature", "PHB"], "Acolyte of Nature", 1, [
    skillsOf(1, ["animal handling", "nature", "survival"]),
    ...spellPicks({ count: 1, level: 0, from: "Druid" }),
  ]),
  phbFeature(cleric, ["Nature", "PHB"], "Dampen Elements", 6),
  phbFeature(cleric, ["Nature", "PHB"], "Master of Nature", 17),
  phbFeature(cleric, ["Tempest", "PHB"], "Thunderbolt Strike", 6),
  phbFeature(cleric, ["Tempest", "PHB"], "Stormborn", 17),
  phbFeature(cleric, ["Trickery", "PHB"], "Blessing of the Trickster", 1),
  phbFeature(cleric, ["Trickery", "PHB"], "Channel Divinity: Cloak of Shadows", 6),
  phbFeature(cleric, ["Trickery", "PHB"], "Improved Duplicity", 17),
  phbFeature(cleric, ["War", "PHB"], "Channel Divinity: War God's Blessing", 6),
  phbFeature(cleric, ["War", "PHB"], "Avatar of Battle", 17),
];

/**
 * The classic Ranger and Druid features of the Player's Handbook that carried no record. A
 * feature that works on a companion or another creature, grants a reaction, a choice among
 * options or a movement rule, or turns on terrain or an enemy type, is the narrative mark.
 * Wild Shape's uses show 2 at level 20, where Archdruid makes them unlimited. The 2024 Druid
 * holds the subclass rows at level 3.
 */
const PLAYERS_HANDBOOK_NATURE: FeatureMechanics[] = [
  // Druid
  ...[4, 8, 12, 16, 19].map((level) => phbClassFeature(druid, "Ability Score Improvement", level)),
  phbClassFeature(druid, "Druidic", 1),
  phbClassFeature(druid, "Spellcasting", 1),
  phbClassFeature(druid, "Druid Circle", 2),
  ...[6, 10, 14].map((level) => phbClassFeature(druid, "Druid Circle feature", level)),
  phbClassFeature(druid, "Wild Shape", 2, [{ kind: "uses", count: 2, reset: "short" }]),
  ...[4, 8].map((level) => phbClassFeature(druid, "Wild Shape Improvement", level)),
  phbClassFeature(druid, "Beast Spells", 18),
  phbClassFeature(druid, "Timeless Body", 18),
  phbClassFeature(druid, "Archdruid", 20),
  // Druid, Land
  phbFeature(druid, ["Land", "PHB"], "Circle of the Land", 2),
  phbFeature(druid24, ["Land", "PHB"], "Circle of the Land", 3),
  phbFeature(
    druid,
    ["Land", "PHB"],
    "Bonus Cantrip",
    2,
    spellPicks({ count: 1, level: 0, from: "Druid" }),
  ),
  phbFeature(druid, ["Land", "PHB"], "Nature's Ward", 10, [
    { kind: "defense", immune: ["poison"], conditionImmune: ["disease"] },
  ]),
  // Druid, Moon
  phbFeature(druid, ["Moon", "PHB"], "Circle of the Moon", 2),
  phbFeature(druid24, ["Moon", "PHB"], "Circle of the Moon", 3),
  phbFeature(druid, ["Moon", "PHB"], "Circle Forms", 2),
  phbFeature(druid, ["Moon", "PHB"], "Primal Strike", 6),
  phbFeature(druid, ["Moon", "PHB"], "Elemental Wild Shape", 10),
  // Ranger
  ...[4, 8, 12, 16, 19].map((level) => phbClassFeature(ranger, "Ability Score Improvement", level)),
  phbClassFeature(ranger, "Natural Explorer", 1),
  phbClassFeature(ranger, "Fighting Style", 2),
  phbClassFeature(ranger, "Spellcasting", 2),
  phbClassFeature(ranger, "Ranger Archetype", 3),
  ...[7, 11, 15].map((level) => phbClassFeature(ranger, "Ranger Archetype feature", level)),
  phbClassFeature(ranger, "Favored Enemy and Natural Explorer improvements", 6, [
    { kind: "pick", fields: ["languages"], count: 1 },
  ]),
  phbClassFeature(ranger, "Natural Explorer improvement", 10),
  phbClassFeature(ranger, "Favored Enemy improvement", 14, [
    { kind: "pick", fields: ["languages"], count: 1 },
  ]),
  phbClassFeature(ranger, "Feral Senses", 18),
  phbClassFeature(ranger, "Foe Slayer", 20, [
    {
      kind: "attack",
      weapons: "any",
      attack: "wis",
      oncePerTurn: true,
      option: "against a favored enemy, instead of adding it to the damage roll",
    },
    {
      kind: "extraDamage",
      dice: "wis",
      oncePerTurn: true,
      option: "against a favored enemy, instead of adding it to the attack roll",
    },
  ]),
  // Ranger, Beast Master
  phbFeature(ranger, ["Beast Master", "PHB"], "Beast Master", 3),
  phbFeature(ranger, ["Beast Master", "PHB"], "Ranger's Companion", 3),
  phbFeature(ranger, ["Beast Master", "PHB"], "Exceptional Training", 7),
  phbFeature(ranger, ["Beast Master", "PHB"], "Bestial Fury", 11),
  phbFeature(ranger, ["Beast Master", "PHB"], "Share Spells", 15),
  // Ranger, Hunter
  phbFeature(ranger, ["Hunter", "PHB"], "Hunter", 3),
  phbFeature(ranger, ["Hunter", "PHB"], "Hunter's Prey", 3),
  phbFeature(ranger, ["Hunter", "PHB"], "Giant Killer", 3),
  phbFeature(ranger, ["Hunter", "PHB"], "Horde Breaker", 3),
  phbFeature(ranger, ["Hunter", "PHB"], "Defensive Tactics", 7),
  phbFeature(ranger, ["Hunter", "PHB"], "Escape the Horde", 7),
  phbFeature(ranger, ["Hunter", "PHB"], "Multiattack", 11),
  phbFeature(ranger, ["Hunter", "PHB"], "Volley", 11),
  phbFeature(ranger, ["Hunter", "PHB"], "Whirlwind Attack", 11),
  phbFeature(ranger, ["Hunter", "PHB"], "Superior Hunter's Defense", 15),
  phbFeature(ranger, ["Hunter", "PHB"], "Evasion", 15),
  phbFeature(ranger, ["Hunter", "PHB"], "Stand Against the Tide", 15),
  phbFeature(ranger, ["Hunter", "PHB"], "Uncanny Dodge", 15),
];

/**
 * The classic Fighter and Barbarian features of the Player's Handbook that carried no record. A
 * feature that works on another creature, grants a reaction, a bonus action attack or a choice
 * among options, replaces a roll's total, or repeats one the class table counts, is the
 * narrative mark. Eagle's flight holds only while raging, which a speed mechanic cannot say.
 */
const PLAYERS_HANDBOOK_MARTIAL: FeatureMechanics[] = [
  // Barbarian
  ...[4, 8, 12, 16, 19].map((level) =>
    phbClassFeature(barbarian, "Ability Score Improvement", level),
  ),
  phbClassFeature(barbarian, "Primal Path", 3),
  phbClassFeature(barbarian, "Path Feature", 6),
  ...[10, 14].map((level) => phbClassFeature(barbarian, "Path feature", level)),
  phbClassFeature(barbarian, "Feral Instinct", 7, [
    { kind: "roll", roll: "initiative", advantage: true },
  ]),
  phbClassFeature(barbarian, "Relentless Rage", 11),
  phbClassFeature(barbarian, "Persistent Rage", 15),
  phbClassFeature(barbarian, "Indomitable Might", 18),
  phbClassFeature(barbarian, "Primal Champion", 20),
  // Barbarian, Berserker
  phbFeature(barbarian, ["Berserker", "PHB"], "Path of the Berserker", 3),
  phbFeature(barbarian, ["Berserker", "PHB"], "Frenzy", 3),
  phbFeature(barbarian, ["Berserker", "PHB"], "Mindless Rage", 6, [
    { kind: "defense", conditionImmune: ["charmed", "frightened"], while: "raging" },
  ]),
  phbFeature(barbarian, ["Berserker", "PHB"], "Retaliation", 14),
  // Barbarian, Totem Warrior
  phbFeature(barbarian, ["Totem Warrior", "PHB"], "Path of the Totem Warrior", 3),
  phbFeature(barbarian, ["Totem Warrior", "PHB"], "Wolf", 3),
  phbFeature(barbarian, ["Totem Warrior", "PHB"], "Aspect of the Beast", 6),
  phbFeature(barbarian, ["Totem Warrior", "PHB"], "Bear", 6, [
    {
      kind: "roll",
      roll: "check",
      abilities: ["str"],
      advantage: true,
      against: "made to push, pull, lift, or break objects",
    },
  ]),
  phbFeature(barbarian, ["Totem Warrior", "PHB"], "Eagle", 6),
  phbFeature(barbarian, ["Totem Warrior", "PHB"], "Wolf", 6),
  phbFeature(barbarian, ["Totem Warrior", "PHB"], "Totemic Attunement", 14),
  phbFeature(barbarian, ["Totem Warrior", "PHB"], "Bear", 14),
  phbFeature(barbarian, ["Totem Warrior", "PHB"], "Eagle", 14),
  phbFeature(barbarian, ["Totem Warrior", "PHB"], "Wolf", 14),
  // Fighter
  ...[4, 6, 8, 12, 14, 16, 19].map((level) =>
    phbClassFeature(fighter, "Ability Score Improvement", level),
  ),
  phbClassFeature(fighter, "Fighting Style", 1),
  phbClassFeature(fighter, "Martial Archetype", 3),
  ...[7, 10, 15, 18].map((level) => phbClassFeature(fighter, "Martial Archetype feature", level)),
  phbClassFeature(fighter, "Indomitable (two uses)", 13),
  phbClassFeature(fighter, "Action Surge (two uses)", 17),
  phbClassFeature(fighter, "Indomitable (three uses)", 17),
  // Fighter, Battle Master; the superiority dice come from the class table
  phbFeature(fighter, ["Battle Master", "PHB"], "Battle Master", 3),
  phbFeature(fighter, ["Battle Master", "PHB"], "Maneuvers", 3),
  phbFeature(fighter, ["Battle Master", "PHB"], "Student of War", 3, [
    { kind: "pick", fields: ["tools"], count: 1, types: ["artisan"] },
  ]),
  ...[7, 10, 15].map((level) =>
    phbFeature(fighter, ["Battle Master", "PHB"], "Additional Maneuvers", level),
  ),
  ...[7, 15].map((level) =>
    phbFeature(fighter, ["Battle Master", "PHB"], "Additional Superiority Die", level),
  ),
  phbFeature(fighter, ["Battle Master", "PHB"], "Know Your Enemy", 7),
  // Fighter, Champion
  phbFeature(fighter, ["Champion", "PHB"], "Champion", 3),
  phbFeature(fighter, ["Champion", "PHB"], "Additional Fighting Style", 10),
  // Fighter, Eldritch Knight
  phbFeature(fighter, ["Eldritch Knight", "PHB"], "Eldritch Knight", 3),
  phbFeature(fighter, ["Eldritch Knight", "PHB"], "Spellcasting", 3),
  phbFeature(fighter, ["Eldritch Knight", "PHB"], "Weapon Bond", 3),
  phbFeature(fighter, ["Eldritch Knight", "PHB"], "War Magic", 7),
  phbFeature(fighter, ["Eldritch Knight", "PHB"], "Eldritch Strike", 10),
  phbFeature(fighter, ["Eldritch Knight", "PHB"], "Arcane Charge", 15),
  phbFeature(fighter, ["Eldritch Knight", "PHB"], "Improved War Magic", 18),
];

/**
 * The classic Paladin and Rogue features of the Player's Handbook that carried no record. A
 * feature that works on another creature, grants a reaction, a choice or a spell list, replaces
 * a roll, or repeats the class table is the narrative mark. The two auras record the immunity
 * the paladin holds in them; Aura of Warding resists the damage of spells alone, which a
 * resistance cannot say, and Avenging Angel's aura works on enemies.
 */
const PLAYERS_HANDBOOK_PALADIN_ROGUE: FeatureMechanics[] = [
  // Paladin
  ...[4, 8, 12, 16, 19].map((level) =>
    phbClassFeature(paladin, "Ability Score Improvement", level),
  ),
  phbClassFeature(paladin, "Fighting Style", 2),
  phbClassFeature(paladin, "Spellcasting", 2),
  phbClassFeature(paladin, "Divine Health", 3, [{ kind: "defense", conditionImmune: ["disease"] }]),
  phbClassFeature(paladin, "Aura of Courage", 10, [
    { kind: "defense", conditionImmune: ["frightened"] },
  ]),
  phbClassFeature(paladin, "Aura improvements", 18),
  ...[7, 15, 20].map((level) => phbClassFeature(paladin, "Sacred Oath feature", level)),
  // Paladin, Ancients
  phbFeature(paladin, ["Ancients", "PHB"], "Oath of the Ancients", 3),
  phbFeature(paladin, ["Ancients", "PHB"], "Tenets of the Ancients", 3),
  phbFeature(paladin, ["Ancients", "PHB"], "Channel Divinity", 3),
  phbFeature(paladin, ["Ancients", "PHB"], "Aura of Warding", 7),
  // Paladin, Devotion
  phbFeature(paladin, ["Devotion", "PHB"], "Oath of Devotion", 3),
  phbFeature(paladin, ["Devotion", "PHB"], "Tenets of Devotion", 3),
  phbFeature(paladin, ["Devotion", "PHB"], "Channel Divinity", 3),
  phbFeature(paladin, ["Devotion", "PHB"], "Aura of Devotion", 7, [
    { kind: "defense", conditionImmune: ["charmed"] },
  ]),
  phbFeature(paladin, ["Devotion", "PHB"], "Purity of Spirit", 15),
  // Paladin, Vengeance
  phbFeature(paladin, ["Vengeance", "PHB"], "Oath of Vengeance", 3),
  phbFeature(paladin, ["Vengeance", "PHB"], "Tenets of Vengeance", 3),
  phbFeature(paladin, ["Vengeance", "PHB"], "Channel Divinity", 3),
  phbFeature(paladin, ["Vengeance", "PHB"], "Relentless Avenger", 7),
  phbFeature(paladin, ["Vengeance", "PHB"], "Soul of Vengeance", 15),
  phbFeature(paladin, ["Vengeance", "PHB"], "Avenging Angel", 20, [
    { kind: "active" },
    { kind: "speed", fly: 60, while: "active" },
  ]),
  // Rogue
  ...[4, 8, 10, 12, 16, 19].map((level) =>
    phbClassFeature(rogue, "Ability Score Improvement", level),
  ),
  phbClassFeature(rogue, "Thieves' Cant", 1),
  phbClassFeature(rogue, "Roguish Archetype", 3),
  phbClassFeature(rogue, "Uncanny Dodge", 5),
  phbClassFeature(rogue, "Evasion", 7),
  ...[9, 13, 17].map((level) => phbClassFeature(rogue, "Roguish Archetype feature", level)),
  phbClassFeature(rogue, "Reliable Talent", 11),
  phbClassFeature(rogue, "Blindsense", 14),
  phbClassFeature(rogue, "Slippery Mind", 15, [{ kind: "proficiency", savingThrows: ["wis"] }]),
  phbClassFeature(rogue, "Elusive", 18),
  phbClassFeature(rogue, "Stroke of Luck", 20),
  // Rogue, Arcane Trickster
  phbFeature(rogue, ["Arcane Trickster", "PHB"], "Arcane Trickster", 3),
  phbFeature(rogue, ["Arcane Trickster", "PHB"], "Spellcasting", 3),
  phbFeature(rogue, ["Arcane Trickster", "PHB"], "Mage Hand Legerdemain", 3),
  phbFeature(rogue, ["Arcane Trickster", "PHB"], "Magical Ambush", 9),
  // Rogue, Assassin
  phbFeature(rogue, ["Assassin", "PHB"], "Assassin", 3),
  phbFeature(rogue, ["Assassin", "PHB"], "Infiltration Expertise", 9),
  phbFeature(rogue, ["Assassin", "PHB"], "Impostor", 13),
  // Rogue, Thief
  phbFeature(rogue, ["Thief", "PHB"], "Thief", 3),
  phbFeature(rogue, ["Thief", "PHB"], "Second-Story Work", 3),
  phbFeature(rogue, ["Thief", "PHB"], "Use Magic Device", 13),
  phbFeature(rogue, ["Thief", "PHB"], "Thief's Reflexes", 17),
];

/**
 * The classic Monk and Sorcerer features of the Player's Handbook that carried no record. Each is
 * the narrative mark: a reaction, a choice, a spell list, a pool or a cost the class table holds,
 * an effect on another creature, or a bonus that grows with the level, which a speed mechanic
 * cannot say, as Unarmored Movement's does. The 2024 Sorcerer holds the two origin rows at level 3.
 */
const PLAYERS_HANDBOOK_MONK_SORCERER: FeatureMechanics[] = [
  // Monk
  ...[4, 8, 12, 16, 19].map((level) => phbClassFeature(monk, "Ability Score Improvement", level)),
  phbClassFeature(monk, "Unarmored Movement", 2),
  phbClassFeature(monk, "Flurry of Blows", 2),
  phbClassFeature(monk, "Monastic Tradition", 3),
  ...[6, 11, 17].map((level) => phbClassFeature(monk, "Monastic Tradition feature", level)),
  phbClassFeature(monk, "Deflect Missiles", 3),
  phbClassFeature(monk, "Slow Fall", 4),
  phbClassFeature(monk, "Ki-Empowered Strikes", 6),
  phbClassFeature(monk, "Evasion", 7),
  phbClassFeature(monk, "Stillness of Mind", 7),
  phbClassFeature(monk, "Unarmored Movement improvement", 9),
  phbClassFeature(monk, "Tongue of the Sun and Moon", 13),
  phbClassFeature(monk, "Timeless Body", 15),
  // Monk, Four Elements
  phbFeature(monk, ["Four Elements", "PHB"], "Way of the Four Elements", 3),
  phbFeature(monk, ["Four Elements", "PHB"], "Disciple of the Elements", 3),
  phbFeature(monk, ["Four Elements", "PHB"], "Elemental Disciplines", 3),
  ...[6, 11, 17].map((level) =>
    phbFeature(monk, ["Four Elements", "PHB"], "Extra Elemental Discipline", level),
  ),
  // Monk, Open Hand
  phbFeature(monk, ["Open Hand", "PHB"], "Way of the Open Hand", 3),
  // Monk, Shadow
  phbFeature(monk, ["Shadow", "PHB"], "Way of Shadow", 3),
  phbFeature(monk, ["Shadow", "PHB"], "Cloak of Shadows", 11),
  phbFeature(monk, ["Shadow", "PHB"], "Opportunist", 17),
  // Sorcerer
  ...[4, 8, 12, 16, 19].map((level) =>
    phbClassFeature(sorcerer, "Ability Score Improvement", level),
  ),
  phbClassFeature(sorcerer, "Spellcasting", 1),
  phbClassFeature(sorcerer, "Sorcerous Origin", 1),
  ...[6, 14, 18].map((level) => phbClassFeature(sorcerer, "Sorcerous Origin feature", level)),
  phbClassFeature(sorcerer, "Sorcery Points", 2),
  ...[3, 10, 17].map((level) => phbClassFeature(sorcerer, "Metamagic", level)),
  // Sorcerer, Draconic
  phbFeature(sorcerer, ["Draconic", "PHB"], "Dragon Ancestor", 1),
  phbFeature(sorcerer, ["Draconic", "PHB"], "Draconic Bloodline", 1),
  phbFeature(sorcerer24, ["Draconic", "PHB"], "Draconic Bloodline", 3),
  phbFeature(sorcerer, ["Draconic", "PHB"], "Draconic Presence", 18),
  // Sorcerer, Wild
  phbFeature(sorcerer, ["Wild", "PHB"], "Wild Magic", 1),
  phbFeature(sorcerer24, ["Wild", "PHB"], "Wild Magic", 3),
  phbFeature(sorcerer, ["Wild", "PHB"], "Bend Luck", 6),
  phbFeature(sorcerer, ["Wild", "PHB"], "Controlled Chaos", 14),
  phbFeature(sorcerer, ["Wild", "PHB"], "Spell Bombardment", 18),
];

/**
 * The classic feats and optional features of the Player's Handbook that carried no record. A
 * feat or invocation that grants proficiencies, a pick, advantage on a roll or a ki save DC
 * records it. The rest is the narrative mark: a reaction, a choice made on each use, a superiority
 * die or metamagic spent on one roll, an effect on another creature, a reduction of damage, a
 * bonus to a passive score, which a check bonus cannot say, or a benefit of the senses or of
 * movement that no term holds. Resilient and Weapon Master leave a choice no pick holds.
 */
const PLAYERS_HANDBOOK_FEATS: FeatureMechanics[] = [
  {
    ref: { name: "Actor", source: "PHB" },
    mechanics: [
      {
        kind: "roll",
        roll: "check",
        skills: ["deception", "performance"],
        advantage: true,
        against: "when trying to pass yourself off as a different person",
      },
    ],
  },
  {
    ref: { name: "Beguiling Influence", source: "PHB" },
    mechanics: grants({ skills: ["deception", "persuasion"] }),
  },
  {
    ref: { name: "Heavily Armored", source: "PHB" },
    mechanics: grants({ armor: ["heavy"] }),
  },
  {
    ref: { name: "Lightly Armored", source: "PHB" },
    mechanics: grants({ armor: ["light"] }),
  },
  {
    ref: { name: "Moderately Armored", source: "PHB" },
    mechanics: grants({ armor: ["medium", "shield"] }),
  },
  {
    ref: { name: "Linguist", source: "PHB" },
    mechanics: [{ kind: "pick", fields: ["languages"], count: 3 }],
  },
  {
    ref: { name: "Skilled", source: "PHB" },
    mechanics: [{ kind: "pick", fields: ["skills", "tools"], count: 3 }],
  },
  {
    ref: { name: "Mage Slayer", source: "PHB" },
    mechanics: [saveAdvantage("against spells cast by creatures within 5 feet of you")],
  },
  {
    ref: { name: "War Caster", source: "PHB" },
    mechanics: [
      {
        kind: "roll",
        roll: "save",
        abilities: ["con"],
        advantage: true,
        against: "to maintain concentration on a spell when you take damage",
      },
    ],
  },
  { ref: { name: "Unbroken Air", source: "PHB" }, mechanics: [KI_DC] },
  { ref: { name: "Water Whip", source: "PHB" }, mechanics: [KI_DC] },
  ...[
    "Athlete",
    "Commander's Strike",
    "Crossbow Expert",
    "Defensive Duelist",
    "Elemental Adept",
    "Evasive Footwork",
    "Heavy Armor Master",
    "Keen Mind",
    "Observant",
    "Parry",
    "Polearm Master",
    "Protection",
    "Resilient",
    "Savage Attacker",
    "Sentinel",
    "Shield Master",
    "Skulker",
    "Sweeping Attack",
    "Tavern Brawler",
    "Two-Weapon Fighting",
    "Weapon Master",
    "Agonizing Blast",
    "Eldritch Spear",
    "Eyes of the Rune Keeper",
    "Gaze of Two Minds",
    "One with Shadows",
    "Repelling Blast",
    "Voice of the Chain Master",
    "Witch Sight",
    "Elemental Attunement",
    "Shape the Flowing River",
    "Careful Spell",
    "Distant Spell",
    "Empowered Spell",
    "Extended Spell",
    "Quickened Spell",
    "Subtle Spell",
    "Twinned Spell",
  ].map((name) => narrative({ name, source: "PHB" })),
];

const phb = (...owners: string[]) => owners.map((owner) => `${owner}|PHB`);
const phbSubrace = (race: string, ...subraces: string[]) =>
  subraces.map((subrace) => `${race}|PHB|${subrace}|PHB`);
const PHB_DRAGONBORN = [
  "Dragonborn|PHB",
  ...DRAGONS.map((color) => `Dragonborn|PHB|Dragonborn (${color})|PHB`),
];

/**
 * The races, subraces and backgrounds of the Player's Handbook that carried no record. A trait
 * whose effect the race row already gives, such as a sense, a skill, a tool, a weapon, an armor,
 * a resistance, a speed, a language or a feat, is the narrative mark, as is a background feature.
 * So is an effect no vocabulary term holds: a reroll, double proficiency on a check about
 * stonework, a die rolled again on a critical hit, moving through a larger creature's space, a
 * device built in an hour, and a penalty in sunlight. Breath Weapon's damage and area differ by
 * ancestry and its DC is the same. The halfling's Lucky shares its `(name, source)` with the feat,
 * whose record the report reads for the trait.
 */
const PLAYERS_HANDBOOK_RACES: FeatureMechanics[] = [
  phbTrait("Darkvision", phb("Dwarf", "Elf", "Gnome", "Half-Elf", "Half-Orc", "Tiefling")),
  phbTrait("Superior Darkvision", phbSubrace("Elf", "Drow")),
  phbTrait("Keen Senses", [...phb("Elf"), ...phbSubrace("Elf", "Drow")]),
  phbTrait("Elf Weapon Training", phbSubrace("Elf", "High", "Wood")),
  phbTrait("Drow Weapon Training", phbSubrace("Elf", "Drow")),
  phbTrait("Fleet of Foot", phbSubrace("Elf", "Wood")),
  phbTrait("Mask of the Wild", phbSubrace("Elf", "Wood")),
  phbTrait("Trance", phb("Elf")),
  phbTrait("Sunlight Sensitivity", phbSubrace("Elf", "Drow")),
  phbTrait("Extra Language", phbSubrace("Elf", "High")),
  phbTrait("Cantrip", phbSubrace("Elf", "High"), [SPELLS]),
  phbTrait("Drow Magic", phbSubrace("Elf", "Drow"), [SPELLS]),
  phbTrait("Dwarven Resilience", phb("Dwarf"), [saveAdvantage("against poison")]),
  phbTrait("Stout Resilience", phbSubrace("Halfling", "Stout"), [saveAdvantage("against poison")]),
  phbTrait("Dwarven Combat Training", phb("Dwarf")),
  phbTrait("Dwarven Armor Training", phbSubrace("Dwarf", "Mountain")),
  phbTrait("Tool Proficiency", phb("Dwarf")),
  phbTrait("Stonecunning", phb("Dwarf")),
  phbTrait("Halfling Nimbleness", phb("Halfling")),
  phbTrait("Naturally Stealthy", phbSubrace("Halfling", "Lightfoot")),
  phbTrait("Artificer's Lore", phbSubrace("Gnome", "Rock")),
  phbTrait("Tinker", phbSubrace("Gnome", "Rock")),
  phbTrait("Natural Illusionist", phbSubrace("Gnome", "Forest"), [SPELLS]),
  phbTrait("Speak with Small Beasts", phbSubrace("Gnome", "Forest")),
  phbTrait("Skill Versatility", phb("Half-Elf")),
  phbTrait("Menacing", phb("Half-Orc")),
  phbTrait("Savage Attacks", phb("Half-Orc")),
  phbTrait("Skills", phbSubrace("Human", "Variant")),
  phbTrait("Feat", phbSubrace("Human", "Variant")),
  phbTrait("Draconic Ancestry", phb("Dragonborn")),
  phbTrait("Damage Resistance", PHB_DRAGONBORN),
  phbTrait("Breath Weapon", PHB_DRAGONBORN, [
    { kind: "dc", ability: "con" },
    { kind: "uses", count: 1, reset: "short" },
  ]),
  phbTrait("Hellish Resistance", phb("Tiefling")),
  phbTrait("Infernal Legacy", phb("Tiefling"), [SPELLS]),
  ...[
    "Bad Reputation",
    "By Popular Demand",
    "Choose a Feature",
    "City Secrets",
    "Criminal Contact",
    "Discovery",
    "False Identity",
    "Guild Membership",
    "Military Rank",
    "Position of Privilege",
    "Researcher",
    "Retainers",
    "Rustic Hospitality",
    "Shelter of the Faithful",
    "Ship's Passage",
    "Spy Contact",
    "Wanderer",
  ].map((name) => narrative({ name, source: "PHB" })),
];

const RECORDS: FeatureMechanics[] = [
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
    SPELLS,
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
    races: ["Dwarf|PHB|Hill|PHB"],
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
    races: ["Elf|PHB", "Half-Elf|PHB"],
    mechanics: [saveAdvantage("against being charmed")],
  },
  {
    ref: { name: "Gnome Cunning", source: "PHB" },
    races: ["Gnome|PHB"],
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
    races: ["Halfling|PHB"],
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
  ...ATTACK_CHANGES,
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
      kind: "attack",
      dice: "1d8",
      scales: [
        { level: 10, dice: "1d10" },
        { level: 18, dice: "1d12" },
      ],
      afterRoll: true,
      option: PRECISION_ATTACK,
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
      mechanics: [
        { kind: "extraDamage", dice: "1d6", unarmed: true, option: SUPERIORITY_DIE },
        { kind: "attack", dice: "1d6", afterRoll: true, option: PRECISION_ATTACK },
      ],
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
  // Its heal lands when the target dies, which a `heal` would move to the use that curses it.
  subclassFeature(warlock, ["Hexblade", "XGE"], ["Hexblade's Curse", "XGE"], 1, [
    {
      kind: "extraDamage",
      dice: "proficiency",
      unarmed: true,
      option: "against your cursed target",
    },
    { kind: "attack", critical: 19, option: "against your cursed target" },
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
      RUNE_USES,
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
  classFeature(cleric, ["Channel Divinity", "PHB"], 2, [
    {
      kind: "pool",
      key: "channel_divinity",
      count: 1,
      scales: [
        { level: 6, count: 2 },
        { level: 18, count: 3 },
      ],
    },
  ]),
  classFeature(paladin, ["Channel Divinity", "PHB"], 3, [
    { kind: "pool", key: "channel_divinity", count: 1 },
  ]),
  ...(
    [
      [cleric, "Channel Divinity: Preserve Life", "PHB", 2],
      [cleric24, "Channel Divinity: Preserve Life", "PHB", 3],
      [cleric24, "Preserve Life", "XPHB", 3],
    ] as const
  ).map(([owner, name, source, level]) =>
    subclassFeature(owner, ["Life", source], [name, source], level, [
      { kind: "heal", bonus: ["level"], times: 5, ...(source === "XPHB" ? {} : { others: true }) },
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
    { kind: "tempHp", bonus: ["cha", "level"], on: "zeroHp" },
  ]),
  subclassFeature(["Warlock", "XPHB"], ["Fiend", "XPHB"], ["Dark One's Blessing", "XPHB"], 3, [
    { kind: "tempHp", bonus: ["cha", "level"] },
  ]),
  // Heals twice the level of the killing spell, three times for a necromancy spell. The sheet
  // records neither the spell nor its school.
  narrative({
    name: "Grim Harvest",
    source: "PHB",
    className: "Wizard",
    classSource: "PHB",
    subclass: { shortName: "Necromancy", source: "PHB" },
    level: 2,
  }),
  // Each regains on rolling initiative where none is left, as printed. Tireless Spirit regains a
  // use of Fighting Spirit, whose count is the catalog's, which a roll of initiative does not read.
  classFeature(monk, ["Perfect Self", "PHB"], 20, [
    { kind: "regain", target: "pool", pool: "ki_points", count: 4, on: "initiative" },
  ]),
  subclassFeature(fighter, ["Battle Master", "PHB"], ["Relentless", "PHB"], 15, [
    { kind: "regain", target: "pool", pool: "superiority_dice", count: 1, on: "initiative" },
  ]),
  classFeature(bard, ["Superior Inspiration", "PHB"], 20, [
    { kind: "regain", target: "uses", of: "Bardic Inspiration", count: 1, on: "initiative" },
  ]),
  narrative({
    name: "Tireless Spirit",
    source: "XGE",
    className: "Fighter",
    classSource: "PHB",
    subclass: { shortName: "Samurai", source: "XGE" },
    level: 10,
  }),
  {
    ref: { name: "Relentless Endurance", source: "PHB" },
    races: ["Half-Orc|PHB"],
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
    { kind: "heal", dice: { column: "martial_arts" }, bonus: ["wis"] },
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
    SPELLS,
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
  // The player picks the creatures that accept, as many as the Constitution modifier allows.
  subclassFeature(barbarian, ["Beast", "TCE"], ["Call the Hunt", "TCE"], 14, [
    { kind: "tempHp", bonus: [5], per: "creature", most: "con" },
    { kind: "uses", count: "proficiency", reset: "long" },
  ]),
  subclassFeature(druid, ["Moon", "PHB"], ["Combat Wild Shape", "PHB"], 2, [
    { kind: "heal", dice: "1d8", per: "slotLevel" },
  ]),
  // The superiority die is the Battle Master's where held, else the d6 of Martial Adept.
  {
    ref: { name: "Rally", source: "PHB" },
    mechanics: [
      { kind: "tempHp", dice: { pool: "superiority_dice", die: 6 }, bonus: ["cha"], others: true },
    ],
  },
  {
    ref: { name: "Tomb of Levistus", source: "XGE" },
    mechanics: [
      { kind: "tempHp", bonus: ["level"], times: 10, levelsIn: { name: "Warlock", source: "PHB" } },
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
    { name: "Gift of the Ever-Living Ones", source: "XGE" },
    { name: "Gift of the Protectors", source: "TCE" },
    { name: "Homunculus Servant", source: "TCE" },
  ].map(narrative),
  classFeature(sorcerer, ["Font of Magic", "PHB"], 2, [
    { kind: "convert", pool: "sorcery_points", costs: [2, 3, 5, 6, 7], refund: true },
  ]),
  classFeature(wizard, ["Arcane Recovery", "PHB"], 1, [
    { kind: "slotRecovery", maxLevel: 5 },
    { kind: "uses", count: 1, reset: "long" },
  ]),
  subclassFeature(druid, ["Land", "PHB"], ["Natural Recovery", "PHB"], 2, [
    { kind: "slotRecovery", maxLevel: 5 },
    { kind: "uses", count: 1, reset: "long" },
  ]),
  // The sheet tracks no rest taken, so the one use a short rest restores stands for finishing it.
  classFeature(sorcerer, ["Sorcerous Restoration", "PHB"], 20, [
    { kind: "regain", target: "pool", pool: "sorcery_points", count: 4 },
    { kind: "uses", count: 1, reset: "short" },
  ]),
  classFeature(warlock, ["Eldritch Master", "PHB"], 20, [
    { kind: "regain", target: "pactSlots" },
    { kind: "uses", count: 1, reset: "long" },
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
  ...RUNES_INVOKED,
  ...ONGOING_EFFECTS,
  ...TURN_ECONOMY,
  ...SPELLS_GRANTED,
  ...SPELLS_BY_INVOCATION,
  ...SPELLS_PICKED,
  ...SPELLS_FROM_CLASS_FEATURES,
  ...SPELLS_GRANTED_2024,
  ...SPELLS_FROM_CLASS_FEATURES_2024,
  ...PLANE_SHIFT_AMONKHET,
  ...DUNGEON_MASTERS_GUIDE,
  ...FIZBANS_TREASURY,
  ...EBERRON,
  ...MONSTERS_OF_THE_MULTIVERSE,
  ...GLORY_OF_THE_GIANTS,
  ...SHADOW_OF_THE_DRAGON_QUEEN,
  ...VAN_RICHTENS_GUIDE,
  ...SETTING_BOOKS,
  ...XANATHARS_GUIDE,
  ...TASHAS_CAULDRON,
  ...PLAYERS_HANDBOOK_ARCANE,
  ...PLAYERS_HANDBOOK_DIVINE,
  ...PLAYERS_HANDBOOK_NATURE,
  ...PLAYERS_HANDBOOK_MARTIAL,
  ...PLAYERS_HANDBOOK_PALADIN_ROGUE,
  ...PLAYERS_HANDBOOK_MONK_SORCERER,
  ...PLAYERS_HANDBOOK_FEATS,
  ...PLAYERS_HANDBOOK_RACES,
  ...SWORD_COAST_AND_WILDEMOUNT,
];

export const FEATURE_MECHANICS = withSaveDcs(RECORDS, SAVE_DCS);
