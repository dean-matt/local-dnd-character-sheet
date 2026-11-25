/**
 * The features with recorded mechanics that a character holds: each catalog feat and option,
 * the traits its race and subrace give, and each class or subclass feature its level has reached. A subclass
 * feature is recorded under its subclass's short name, so `SUBCLASS_NAMES` maps it to the
 * full name a level stores.
 */
import type { HomebrewFeature } from "./catalog.ts";
import type { CharacterDefinition } from "./definition.ts";
import { FEATURE_MECHANICS } from "./featureMechanicRecords.ts";
import {
  type EffectEnd,
  type FeatureMechanics,
  featureMechanicsKey,
  featureOffers,
  type Mechanic,
  mechanicsOfKind,
  type SpellPick,
} from "./featureMechanics.ts";
import { classFeatureUsesKey, entryKey, featureKey, featureUsesKey, refKey } from "./keys.ts";
import { type ContentRef, catalogRef, type FeatureKey } from "./refs.ts";
import { houseRule as houseRuleOf } from "./resolve.ts";
import { classLevels, totalLevel } from "./summaries.ts";

export const SUBCLASS_NAMES = new Map([
  ["Ancestral Guardian|XGE", "Path of the Ancestral Guardian|XGE"],
  ["Aberrant Mind|TCE", "Aberrant Mind|TCE"],
  ["Archfey|PHB", "The Archfey|PHB"],
  ["Illusion|PHB", "School of Illusion|PHB"],
  ["Sun Soul|XGE", "Way of the Sun Soul|XGE"],
  ["Forge|XGE", "Forge Domain|XGE"],
  ["Draconic|PHB", "Draconic Bloodline|PHB"],
  ["Draconic|XPHB", "Draconic Sorcery|XPHB"],
  ["Dance|XPHB", "College of Dance|XPHB"],
  ["Lore|XPHB", "College of Lore|XPHB"],
  ["Hunter|PHB", "Hunter|PHB"],
  ["Life|PHB", "Life Domain|PHB"],
  ["Nature|PHB", "Nature Domain|PHB"],
  ["Tempest|PHB", "Tempest Domain|PHB"],
  ["War|PHB", "War Domain|PHB"],
  ["Order|TCE", "Order Domain|TCE"],
  ["Twilight|TCE", "Twilight Domain|TCE"],
  ["Grave|XGE", "Grave Domain|XGE"],
  ["Peace|TCE", "Peace Domain|TCE"],
  ["Valor|PHB", "College of Valor|PHB"],
  ["Swords|XGE", "College of Swords|XGE"],
  ["Champion|PHB", "Champion|PHB"],
  ["Samurai|XGE", "Samurai|XGE"],
  ["Rune Knight|TCE", "Rune Knight|TCE"],
  ["Mercy|TCE", "Way of Mercy|TCE"],
  ["Drunken Master|XGE", "Way of the Drunken Master|XGE"],
  ["Assassin|PHB", "Assassin|PHB"],
  ["Mastermind|XGE", "Mastermind|XGE"],
  ["Scout|XGE", "Scout|XGE"],
  ["Hexblade|XGE", "The Hexblade|XGE"],
  ["Bladesinging|TCE", "Bladesinging|TCE"],
  ["Alchemist|TCE", "Alchemist|TCE"],
  ["Artillerist|TCE", "Artillerist|TCE"],
  ["Battle Smith|TCE", "Battle Smith|TCE"],
  ["Armorer|TCE", "Armorer|TCE"],
  ["Gloom Stalker|XGE", "Gloom Stalker|XGE"],
  ["Glory|TCE", "Oath of Glory|TCE"],
  ["Shadow|XGE", "Shadow Magic|XGE"],
  ["Totem Warrior|PHB", "Path of the Totem Warrior|PHB"],
  ["Necromancy|PHB", "School of Necromancy|PHB"],
  ["Storm|XGE", "Storm Sorcery|XGE"],
  ["Lore|PHB", "College of Lore|PHB"],
  ["Knowledge|PHB", "Knowledge Domain|PHB"],
  ["Cavalier|XGE", "Cavalier|XGE"],
  ["Arcane Archer|XGE", "Arcane Archer|XGE"],
  ["Devotion|PHB", "Oath of Devotion|PHB"],
  ["Devotion|XPHB", "Oath of Devotion|XPHB"],
  ["Vengeance|PHB", "Oath of Vengeance|PHB"],
  ["Land|PHB", "Circle of the Land|PHB"],
  ["Thief|PHB", "Thief|PHB"],
  ["Champion|XPHB", "Champion|XPHB"],
  ["Hunter|XPHB", "Hunter|XPHB"],
  ["Berserker|XPHB", "Path of the Berserker|XPHB"],
  ["Life|XPHB", "Life Domain|XPHB"],
  ["Land|XPHB", "Circle of the Land|XPHB"],
  ["Open Hand|PHB", "Way of the Open Hand|PHB"],
  ["Open Hand|XPHB", "Warrior of the Open Hand|XPHB"],
  ["Fiend|PHB", "The Fiend|PHB"],
  ["Fiend|XPHB", "Fiend Patron|XPHB"],
  ["Light|PHB", "Light Domain|PHB"],
  ["Divination|PHB", "School of Divination|PHB"],
  ["Evocation|PHB", "School of Evocation|PHB"],
  ["Evoker|XPHB", "Evoker|XPHB"],
  ["Trickery|PHB", "Trickery Domain|PHB"],
  ["Zealot|XGE", "Path of the Zealot|XGE"],
  ["Whispers|XGE", "College of Whispers|XGE"],
  ["Spores|TCE", "Circle of Spores|TCE"],
  ["Battle Master|PHB", "Battle Master|PHB"],
  ["Beast Master|PHB", "Beast Master|PHB"],
  ["Psi Warrior|TCE", "Psi Warrior|TCE"],
  ["Kensei|XGE", "Way of the Kensei|XGE"],
  ["Astral Self|TCE", "Way of the Astral Self|TCE"],
  ["Horizon Walker|XGE", "Horizon Walker|XGE"],
  ["Monster Slayer|XGE", "Monster Slayer|XGE"],
  ["Fey Wanderer|TCE", "Fey Wanderer|TCE"],
  ["Swarmkeeper|TCE", "Swarmkeeper|TCE"],
  ["Genie|TCE", "The Genie|TCE"],
  ["Abjuration|PHB", "School of Abjuration|PHB"],
  ["Ancients|PHB", "Oath of the Ancients|PHB"],
  ["Beast|TCE", "Path of the Beast|TCE"],
  ["Celestial|XGE", "The Celestial|XGE"],
  ["Clockwork Soul|TCE", "Clockwork Soul|TCE"],
  ["Conjuration|PHB", "School of Conjuration|PHB"],
  ["Creation|TCE", "College of Creation|TCE"],
  ["Divine Soul|XGE", "Divine Soul|XGE"],
  ["Dreams|XGE", "Circle of Dreams|XGE"],
  ["Fathomless|TCE", "The Fathomless|TCE"],
  ["Glamour|XGE", "College of Glamour|XGE"],
  ["Moon|PHB", "Circle of the Moon|PHB"],
  ["Redemption|XGE", "Oath of Redemption|XGE"],
  ["War|XGE", "War Magic|XGE"],
  ["Shepherd|XGE", "Circle of the Shepherd|XGE"],
  ["Stars|TCE", "Circle of Stars|TCE"],
  ["Storm Herald|XGE", "Path of the Storm Herald|XGE"],
  ["Transmutation|PHB", "School of Transmutation|PHB"],
  ["Wild Magic|TCE", "Path of Wild Magic|TCE"],
  ["Wildfire|TCE", "Circle of Wildfire|TCE"],
  ["Wild|PHB", "Wild Magic|PHB"],
  ["Eloquence|TCE", "College of Eloquence|TCE"],
  ["Inquisitive|XGE", "Inquisitive|XGE"],
  ["Phantom|TCE", "Phantom|TCE"],
  ["Soulknife|TCE", "Soulknife|TCE"],
  ["Scribes|TCE", "Order of Scribes|TCE"],
  ["Conquest|XGE", "Oath of Conquest|XGE"],
  ["Watchers|TCE", "Oath of the Watchers|TCE"],
  ["Shadow|PHB", "Way of Shadow|PHB"],
  ["Swashbuckler|XGE", "Swashbuckler|XGE"],
  ["Arcane Trickster|PHB", "Arcane Trickster|PHB"],
  ["Great Old One|PHB", "The Great Old One|PHB"],
  ["Enchantment|PHB", "School of Enchantment|PHB"],
  ["Berserker|PHB", "Path of the Berserker|PHB"],
  ["Ambition (PSA)|PSA", "Ambition Domain (PSA)|PSA"],
  ["Knowledge (PSA)|PSA", "Knowledge Domain (PSA)|PSA"],
  ["Solidarity (PSA)|PSA", "Solidarity Domain (PSA)|PSA"],
  ["Strength (PSA)|PSA", "Strength Domain (PSA)|PSA"],
  ["Zeal (PSA)|PSA", "Zeal Domain (PSA)|PSA"],
  ["Death|DMG", "Death Domain|DMG"],
  ["Oathbreaker|DMG", "Oathbreaker|DMG"],
  ["Ascendant Dragon|FTD", "Way of the Ascendant Dragon|FTD"],
  ["Drakewarden|FTD", "Drakewarden|FTD"],
  ["Giant|BGG", "Path of the Giant|BGG"],
  ["Lunar|DSotDQ", "Lunar Sorcery|DSotDQ"],
  ["Pyromancer (PSK)|PSK", "Pyromancer (PSK)|PSK"],
  ["Spirits|VRGR", "College of Spirits|VRGR"],
  ["Undead|VRGR", "The Undead|VRGR"],
  ["Battlerager|SCAG", "Path of the Battlerager|SCAG"],
  ["Arcana|SCAG", "Arcana Domain|SCAG"],
  ["Purple Dragon Knight (Banneret)|SCAG", "Purple Dragon Knight (Banneret)|SCAG"],
  ["Long Death|SCAG", "Way of the Long Death|SCAG"],
  ["Crown|SCAG", "Oath of the Crown|SCAG"],
  ["Undying|SCAG", "The Undying|SCAG"],
  ["Echo Knight|EGW", "Echo Knight|EGW"],
  ["Chronurgy|EGW", "Chronurgy Magic|EGW"],
  ["Graviturgy|EGW", "Graviturgy Magic|EGW"],
  ["Avatar|UATheMysticClass", "Order of the Avatar|UATheMysticClass"],
  ["Awakened|UATheMysticClass", "Order of the Awakened|UATheMysticClass"],
  ["Immortal|UATheMysticClass", "Order of the Immortal|UATheMysticClass"],
  ["Nomad|UATheMysticClass", "Order of the Nomad|UATheMysticClass"],
  ["Soul Knife|UATheMysticClass", "Order of the Soul Knife|UATheMysticClass"],
  ["Wu Jen|UATheMysticClass", "Order of the Wu Jen|UATheMysticClass"],
]);

/** The features section's group a held feature shows in. */
type HeldOrigin = "class" | "subclass" | "race" | "feat" | "optionalFeature";

export type Held = {
  ref: ContentRef;
  origin: HeldOrigin;
  entry: FeatureMechanics;
  /** Levels in the class a subclass feature belongs to, or the character's total level. */
  levels: number;
  /** Its entry in the state's `featureUses`, as the features the API resolves key it. */
  usesKey: string;
  /** Set where a homebrew effect replaces the mechanics recorded for the feature. */
  homebrew?: true;
};

const BY_KEY = new Map(FEATURE_MECHANICS.map((entry) => [featureMechanicsKey(entry), entry]));

/** The mechanics a table's homebrew effect rules for each catalog feature, keyed by its `refKey`. */
type HomebrewEffects = ReadonlyMap<string, readonly Mechanic[]>;

/** `entry` with the mechanics a homebrew effect rules for `ref` in place of its recorded ones. */
function ruled(entry: FeatureMechanics, ref: ContentRef, effects?: HomebrewEffects) {
  const mechanics = effects?.get(refKey(ref));
  if (!mechanics) return entry;
  const { narrative: _, ...rest } = entry;
  return { ...rest, mechanics: [...mechanics] };
}

/** What a catalog feat or optional feature records, or an empty record where only a homebrew effect rules for it. */
const pickedEntry = (ref: ContentRef, effects?: HomebrewEffects): FeatureMechanics | undefined =>
  BY_KEY.get(refKey(ref)) ?? (effects?.has(refKey(ref)) ? { ref, mechanics: [] } : undefined);

/** The spells a feature's mechanics have the player pick. */
export const spellPicks = (entry: FeatureMechanics): SpellPick[] =>
  mechanicsOfKind(entry, "spells").flatMap((mechanic) => mechanic.picks ?? []);

/** The picks a class or subclass feature asks the player for, none where it records none. */
export const featurePickOffers = (feature: FeatureKey, effects?: HomebrewEffects) => {
  const entry = BY_KEY.get(featureKey(feature));
  return entry ? featureOffers(ruled(entry, feature, effects)) : [];
};

/** The spell picks a class or subclass feature asks the player for, none where it records none. */
export const featureSpellPickOffers = (
  feature: FeatureKey,
  effects?: HomebrewEffects,
): SpellPick[] => {
  const entry = BY_KEY.get(featureKey(feature));
  return entry ? spellPicks(ruled(entry, feature, effects)) : [];
};

/**
 * What a feat or optional feature records of the spells it grants: how their cast is limited,
 * and the one count of uses it keeps itself where that count is fixed, which a cast of its one
 * spell then spends.
 */
export function spellGrantRecord(
  ref: ContentRef,
  effects?: HomebrewEffects,
): {
  casting?: "slot" | "atWill";
  uses?: { count: number; reset: "short" | "long" };
} {
  const recorded = pickedEntry(ref, effects);
  if (!recorded) return {};
  const entry = ruled(recorded, ref, effects);
  const { casting } = mechanicsOfKind(entry, "spells")[0] ?? {};
  const [uses] = mechanicsOfKind(entry, "uses").flatMap(({ count, reset, part, scales }) =>
    typeof count === "number" && reset !== "manual" && !part && !scales ? [{ count, reset }] : [],
  );
  return { ...(casting && { casting }), ...(uses && { uses }) };
}

const SUBCLASS_FEATURES = FEATURE_MECHANICS.flatMap((entry) => {
  const { ref } = entry;
  if (!("className" in ref) || !ref.subclass) return [];
  const subclass = SUBCLASS_NAMES.get(`${ref.subclass.shortName}|${ref.subclass.source}`);
  return subclass
    ? [
        {
          entry,
          ref: { name: ref.name, source: ref.source },
          key: `${ref.className}|${ref.classSource}|${subclass}`,
          origin: "subclass" as const,
          level: ref.level,
          usesKey: classFeatureUsesKey(ref),
        },
      ]
    : [];
});

const CLASS_FEATURES = FEATURE_MECHANICS.flatMap((entry) => {
  const { ref } = entry;
  return "className" in ref && !ref.subclass
    ? [
        {
          entry,
          ref: { name: ref.name, source: ref.source },
          key: `${ref.className}|${ref.classSource}`,
          origin: "class" as const,
          level: ref.level,
          usesKey: classFeatureUsesKey(ref),
        },
      ]
    : [];
});

const RACE_FEATURES = FEATURE_MECHANICS.flatMap((entry) =>
  entry.races ? [{ entry, ref: entry.ref as ContentRef, owners: entry.races }] : [],
);

export type HoldsFeatures = Partial<Pick<CharacterDefinition, "featureChoices" | "houseRules">> &
  Pick<CharacterDefinition, "feats" | "optionalFeatures" | "race" | "subrace" | "levels"> & {
    /** The names of the features whose effect runs, as the state's `activeEffects` holds them; none where absent. */
    started?: ReadonlySet<string>;
    /** The recorded mechanics of each homebrew feat and option the character holds, keyed by `homebrewId`. */
    homebrewFeatures?: ReadonlyMap<string, HomebrewFeature>;
    /** The mechanics a homebrew effect rules for a catalog feature, keyed by its `refKey`, in place of the recorded ones. */
    homebrewEffects?: HomebrewEffects;
  };

function pickedFeatures(definition: HoldsFeatures, levels: number): Held[] {
  return [
    ...definition.feats.map(({ ref }) => ({ ref, origin: "feat" as const })),
    ...definition.optionalFeatures.map(({ ref }) => ({ ref, origin: "optionalFeature" as const })),
  ].flatMap(({ ref, origin }) => {
    const homebrew =
      "homebrewId" in ref ? definition.homebrewFeatures?.get(ref.homebrewId) : undefined;
    const catalog = homebrew?.ref ?? catalogRef(ref);
    const entry = homebrew
      ? { ref: homebrew.ref, mechanics: homebrew.mechanics }
      : catalog && pickedEntry(catalog, definition.homebrewEffects);
    if (!catalog || !entry) return [];
    const usesKey = featureUsesKey([origin, catalog.source], catalog.name);
    return [{ ref: catalog, origin, entry, levels, usesKey }];
  });
}

/** `entry` without the mechanics a shared trait scopes to races the character is not. */
function ownedBy(entry: FeatureMechanics, owners: string[]): FeatureMechanics {
  const { mechanics } = entry;
  const mine = mechanics?.filter(
    (mechanic) =>
      !("races" in mechanic && mechanic.races) ||
      mechanic.races.some((owner) => owners.includes(owner)),
  );
  return mine?.length === mechanics?.length ? entry : { ...entry, mechanics: mine };
}

const ownersOf = (race: ContentRef, subrace?: ContentRef) => [
  refKey(race),
  ...(subrace ? [`${refKey(race)}|${refKey(subrace)}`] : []),
];

/**
 * How often each spell a race or subrace grants is cast without a slot where its trait records
 * the count that upstream's `additionalSpells` omits. A race holding two such traits of different
 * counts reads the first, a ceiling no race reaches.
 */
export function raceSpellCasts(race: ContentRef, subrace?: ContentRef) {
  const owners = ownersOf(race, subrace);
  for (const feature of RACE_FEATURES) {
    if (!feature.owners.some((owner) => owners.includes(owner))) continue;
    const casts = mechanicsOfKind(ownedBy(feature.entry, owners), "spells").find(
      (mechanic) => mechanic.casts,
    )?.casts;
    if (casts) return casts;
  }
  return undefined;
}

/** The spells the features a character holds teach by name, each with the feature that does. */
export const learnedSpells = (definition: HoldsFeatures): { feature: string; spell: string }[] =>
  heldFeatures(definition).flatMap(({ ref, entry }) =>
    mechanicsOfKind(entry, "spells").flatMap(({ learns = [] }) =>
      learns.map((spell) => ({ feature: ref.name, spell })),
    ),
  );

function raceTraits(definition: HoldsFeatures, levels: number): Held[] {
  const race = catalogRef(definition.race);
  if (!race) return [];
  const owners = ownersOf(race, catalogRef(definition.subrace));
  return RACE_FEATURES.filter((feature) =>
    feature.owners.some((owner) => owners.includes(owner)),
  ).map(({ ref, entry }) => ({
    ref,
    origin: "race" as const,
    entry: ownedBy(entry, owners),
    levels,
    usesKey: featureUsesKey(["trait", entryKey(definition.race)], ref.name),
  }));
}

const optionTaken = (definition: HoldsFeatures, { ref, offeredBy, houseRule }: FeatureMechanics) =>
  (!houseRule || houseRuleOf({ houseRules: definition.houseRules ?? {} }, houseRule)) &&
  (!offeredBy ||
    (definition.featureChoices ?? []).some(
      (choice) =>
        featureKey(choice.feature) === featureKey(offeredBy) &&
        choice.options.some((option) => option.name === ref.name && option.source === ref.source),
    ));

function classFeatures(definition: HoldsFeatures): Held[] {
  return classLevels(definition).flatMap((group) => {
    if ("homebrewId" in group.class) return [];
    const classKey = refKey(group.class);
    const subclass = catalogRef(group.subclass);
    const subclassKey = subclass && `${classKey}|${refKey(subclass)}`;
    return [
      ...CLASS_FEATURES.filter((feature) => feature.key === classKey),
      ...SUBCLASS_FEATURES.filter((feature) => feature.key === subclassKey),
    ]
      .filter((feature) => group.level >= feature.level && optionTaken(definition, feature.entry))
      .map(({ ref, origin, entry, usesKey }) => ({
        ref,
        origin,
        entry,
        levels: group.level,
        usesKey,
      }));
  });
}

/** `held` with the mechanics a homebrew effect rules for it in place of its recorded ones. */
function withHomebrewEffect(held: Held, effects?: HomebrewEffects): Held {
  const entry = ruled(held.entry, held.ref, effects);
  return entry === held.entry ? held : { ...held, entry, homebrew: true };
}

/** `held` without the mechanics that hold only while its effect runs, unless it runs. */
function asStarted(held: Held, started: ReadonlySet<string>): Held {
  const { mechanics } = held.entry;
  if (!mechanics || started.has(held.ref.name)) return held;
  const now = mechanics.filter((mechanic) => !("while" in mechanic) || mechanic.while !== "active");
  return now.length === mechanics.length
    ? held
    : { ...held, entry: { ...held.entry, mechanics: now } };
}

/** Each feature once, the later source of a repeat winning. */
export function heldFeatures(definition: HoldsFeatures): Held[] {
  const levels = totalLevel(definition);
  const held = new Map<string, Held>();
  for (const feature of [
    ...pickedFeatures(definition, levels),
    ...raceTraits(definition, levels),
    ...classFeatures(definition),
  ])
    held.set(
      featureMechanicsKey(feature.entry),
      withHomebrewEffect(feature, definition.homebrewEffects),
    );
  const started = definition.started ?? new Set();
  return [...held.values()].map((feature) => asStarted(feature, started));
}

/** The held features whose effect the player starts and ends, with what ends each early. */
export const startableFeatures = (
  definition: HoldsFeatures,
): (ContentRef & { endsOn: EffectEnd[] })[] =>
  heldFeatures(definition).flatMap(({ ref, entry }) =>
    mechanicsOfKind(entry, "active").map(({ endsOn = [] }) => ({ ...ref, endsOn })),
  );
