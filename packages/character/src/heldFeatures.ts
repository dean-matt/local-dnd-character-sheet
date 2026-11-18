/**
 * The features with recorded mechanics that a character holds: each catalog feat and option,
 * the traits its race and subrace give, and each class or subclass feature its level has reached. A subclass
 * feature is recorded under its subclass's short name, so `SUBCLASS_NAMES` maps it to the
 * full name a level stores.
 */
import type { CharacterDefinition } from "./definition.ts";
import { FEATURE_MECHANICS } from "./featureMechanicRecords.ts";
import { type FeatureMechanics, featureMechanicsKey, featureOffers } from "./featureMechanics.ts";
import { featureKey, refKey } from "./keys.ts";
import { type ContentRef, catalogRef, type FeatureKey } from "./refs.ts";
import { houseRule as houseRuleOf } from "./resolve.ts";
import { classLevels, totalLevel } from "./summaries.ts";

export const SUBCLASS_NAMES = new Map([
  ["Forge|XGE", "Forge Domain|XGE"],
  ["Draconic|PHB", "Draconic Bloodline|PHB"],
  ["Draconic|XPHB", "Draconic Sorcery|XPHB"],
  ["Dance|XPHB", "College of Dance|XPHB"],
  ["Hunter|PHB", "Hunter|PHB"],
  ["Life|PHB", "Life Domain|PHB"],
  ["Nature|PHB", "Nature Domain|PHB"],
  ["Tempest|PHB", "Tempest Domain|PHB"],
  ["War|PHB", "War Domain|PHB"],
  ["Order|TCE", "Order Domain|TCE"],
  ["Twilight|TCE", "Twilight Domain|TCE"],
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
  ["Land|PHB", "Circle of the Land|PHB"],
  ["Thief|PHB", "Thief|PHB"],
  ["Champion|XPHB", "Champion|XPHB"],
  ["Hunter|XPHB", "Hunter|XPHB"],
  ["Berserker|XPHB", "Path of the Berserker|XPHB"],
]);

/** The races, keyed `race` or `race|subrace` by the `(name, source)` of each, that give a trait. */
const RACE_TRAITS = new Map([
  ["Dwarven Toughness|PHB", ["Dwarf|PHB|Hill|PHB"]],
  ["Fey Ancestry|PHB", ["Elf|PHB", "Half-Elf|PHB"]],
  ["Gnome Cunning|PHB", ["Gnome|PHB"]],
  ["Brave|PHB", ["Halfling|PHB"]],
]);

export type Held = {
  ref: ContentRef;
  entry: FeatureMechanics;
  /** Levels in the class a subclass feature belongs to, or the character's total level. */
  levels: number;
};

const BY_KEY = new Map(FEATURE_MECHANICS.map((entry) => [featureMechanicsKey(entry), entry]));

/** The picks a class or subclass feature asks the player for, none where it records none. */
export const featurePickOffers = (feature: FeatureKey) => {
  const entry = BY_KEY.get(featureKey(feature));
  return entry ? featureOffers(entry) : [];
};

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
          level: ref.level,
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
          level: ref.level,
        },
      ]
    : [];
});

const RACE_FEATURES = FEATURE_MECHANICS.flatMap((entry) => {
  const owners = RACE_TRAITS.get(featureMechanicsKey(entry));
  return owners ? [{ entry, ref: entry.ref as ContentRef, owners }] : [];
});

export type HoldsFeatures = Partial<Pick<CharacterDefinition, "featureChoices" | "houseRules">> &
  Pick<CharacterDefinition, "feats" | "optionalFeatures" | "race" | "subrace" | "levels">;

function pickedFeatures(definition: HoldsFeatures, levels: number): Held[] {
  return [...definition.feats, ...definition.optionalFeatures].flatMap(({ ref }) => {
    const catalog = catalogRef(ref);
    const entry = catalog && BY_KEY.get(refKey(catalog));
    return catalog && entry ? [{ ref: catalog, entry, levels }] : [];
  });
}

function raceTraits(definition: HoldsFeatures, levels: number): Held[] {
  const race = catalogRef(definition.race);
  if (!race) return [];
  const subrace = catalogRef(definition.subrace);
  const owners = [refKey(race), ...(subrace ? [`${refKey(race)}|${refKey(subrace)}`] : [])];
  return RACE_FEATURES.filter((feature) =>
    feature.owners.some((owner) => owners.includes(owner)),
  ).map(({ ref, entry }) => ({ ref, entry, levels }));
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
      .map(({ ref, entry }) => ({ ref, entry, levels: group.level }));
  });
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
    held.set(featureMechanicsKey(feature.entry), feature);
  return [...held.values()];
}
