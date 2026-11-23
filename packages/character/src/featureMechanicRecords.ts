import type { BonusActionAction, FeatureMechanics, Mechanic } from "./featureMechanics.ts";
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
    "Bewitching Whispers",
    "Chains of Carceri",
    "Dreadful Word",
    "Eldritch Sight",
    "Fiendish Vigor",
    "Mask of Many Faces",
    "Master of Myriad Forms",
    "Minions of Chaos",
    "Mire the Mind",
    "Misty Visions",
    "Otherworldly Leap",
    "Pact of the Chain",
    "Pact of the Tome",
    "Book of Ancient Secrets",
    "Sculptor of Flesh",
    "Sign of Ill Omen",
    "Thief of Five Fates",
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
    "Infernal Legacy",
    "Drow Magic",
    "Natural Illusionist",
  ].map((name) => ({ name, source: "PHB" })),
  { name: "Shroud of Shadow", source: "XGE" },
  { name: "Far Scribe", source: "TCE" },
].map((ref) => ({ ref, mechanics: [SPELLS] }));

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
    classFeature(
      warlock,
      [`Mystic Arcanum (${spell}th level)`, "PHB"],
      level as number,
      spellPicks({ count: 1, level: spell as number, from: "Warlock" }),
    ),
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
  classFeature(["Warlock", "XPHB"], ["Mystic Arcanum", "XPHB"], 11, [SPELLS]),
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
  ...SPELLS_PICKED,
  ...SPELLS_FROM_CLASS_FEATURES,
  ...SPELLS_GRANTED_2024,
  ...SPELLS_FROM_CLASS_FEATURES_2024,
];
