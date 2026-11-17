/**
 * The features with recorded mechanics that a character holds: each catalog feat and option,
 * the trait its subrace gives, and each subclass feature its level has reached. A subclass
 * feature is recorded under its subclass's short name, so `SUBCLASS_NAMES` maps it to the
 * full name a level stores, as `unarmoredDefense.ts` keys its formulas.
 */
import type { CharacterDefinition } from "./definition.ts";
import { FEATURE_MECHANICS } from "./featureMechanicRecords.ts";
import { type FeatureMechanics, featureMechanicsKey } from "./featureMechanics.ts";
import { refKey } from "./keys.ts";
import { type ContentRef, catalogRef } from "./refs.ts";
import { classLevels, totalLevel } from "./summaries.ts";

export const SUBCLASS_NAMES = new Map([
  ["Forge|XGE", "Forge Domain|XGE"],
  ["Draconic|PHB", "Draconic Bloodline|PHB"],
]);

/** A subrace trait, keyed `race|subrace` by the `(name, source)` of each. */
const SUBRACE_TRAITS = new Map([["Dwarven Toughness|PHB", "Dwarf|PHB|Hill|PHB"]]);

export type Held = {
  ref: ContentRef;
  entry: FeatureMechanics;
  /** Levels in the class a subclass feature belongs to, or the character's total level. */
  levels: number;
};

const BY_KEY = new Map(FEATURE_MECHANICS.map((entry) => [featureMechanicsKey(entry), entry]));

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

const SUBRACE_FEATURES = FEATURE_MECHANICS.flatMap((entry) => {
  const owner = SUBRACE_TRAITS.get(featureMechanicsKey(entry));
  return owner ? [{ entry, ref: entry.ref as ContentRef, owner }] : [];
});

export type HoldsFeatures = Pick<
  CharacterDefinition,
  "feats" | "optionalFeatures" | "race" | "subrace" | "levels"
>;

function pickedFeatures(definition: HoldsFeatures, levels: number): Held[] {
  return [...definition.feats, ...definition.optionalFeatures].flatMap(({ ref }) => {
    const catalog = catalogRef(ref);
    const entry = catalog && BY_KEY.get(refKey(catalog));
    return catalog && entry ? [{ ref: catalog, entry, levels }] : [];
  });
}

function subraceTraits(definition: HoldsFeatures, levels: number): Held[] {
  const race = catalogRef(definition.race);
  const subrace = catalogRef(definition.subrace);
  if (!race || !subrace) return [];
  const owner = `${refKey(race)}|${refKey(subrace)}`;
  return SUBRACE_FEATURES.filter((feature) => feature.owner === owner).map(({ ref, entry }) => ({
    ref,
    entry,
    levels,
  }));
}

function subclassFeatures(definition: HoldsFeatures): Held[] {
  return classLevels(definition).flatMap((group) => {
    const subclass = catalogRef(group.subclass);
    if ("homebrewId" in group.class || !subclass) return [];
    const key = `${refKey(group.class)}|${refKey(subclass)}`;
    return SUBCLASS_FEATURES.filter(
      (feature) => feature.key === key && group.level >= feature.level,
    ).map(({ ref, entry }) => ({ ref, entry, levels: group.level }));
  });
}

/** Each feature once, the later source of a repeat winning. */
export function heldFeatures(definition: HoldsFeatures): Held[] {
  const levels = totalLevel(definition);
  const held = new Map<string, Held>();
  for (const feature of [
    ...pickedFeatures(definition, levels),
    ...subraceTraits(definition, levels),
    ...subclassFeatures(definition),
  ])
    held.set(featureMechanicsKey(feature.entry), feature);
  return [...held.values()];
}
