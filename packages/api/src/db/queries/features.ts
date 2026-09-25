/**
 * Resolves what one definition has gained, reading `content.db` for a catalog reference
 * and `homebrew.db` for a homebrew one: each class's features up to its level, its
 * subclass's, the race's traits, the background's feature, and every feat and optional
 * feature the character holds.
 *
 * A reference nothing answers stays in its group, marked unresolved, where the derived
 * block throws instead: a missing feature leaves no number wrong, so the sheet can still
 * say which reference went missing.
 */
import {
  type CharacterFeatures,
  type CharacterOptionEntry,
  characterOptionEntrySchema,
  classFeatureVariantSchema,
  type FeatureGroup,
  type SheetFeature,
} from "@dnd/catalog";
import {
  type CharacterDefinition,
  type ContentRef,
  classLevels,
  displayName,
  type EntryRef,
  houseRule,
} from "@dnd/character";
import {
  type ClassFeatureRow,
  getBackground,
  getClass,
  getClassFeatures,
  getFeat,
  getOptionalFeature,
  getSubclass,
  getSubclassFeatures,
} from "./content.ts";
import { parseJson, raceJson } from "./derived.ts";
import {
  getHomebrewBackground,
  getHomebrewClass,
  getHomebrewFeat,
  type HomebrewDb,
} from "./homebrew.ts";

type Placement = { level?: number; featureType?: string };

const entryOf = (json: unknown): CharacterOptionEntry | undefined =>
  json === undefined ? undefined : parseJson(characterOptionEntrySchema, json);

const unresolved = (ref: EntryRef, placement: Placement = {}): SheetFeature => ({
  resolved: false,
  name: displayName(ref),
  ...("homebrewId" in ref ? {} : { source: ref.source }),
  ...placement,
});

/**
 * A whole catalog or homebrew row as one feature, unresolved where the row is missing or
 * its `json` does not parse.
 */
function rowFeature(json: unknown, ref: EntryRef, placement: Placement = {}): SheetFeature {
  const entry = entryOf(json);
  if (!entry) return unresolved(ref, placement);
  return {
    resolved: true,
    name: entry.name,
    source: entry.source,
    ...placement,
    entries: entry.entries ?? [],
  };
}

type EntryNode = Exclude<NonNullable<CharacterOptionEntry["entries"]>[number], string>;

/** A named node inside a row, such as a race's `Darkvision`, as a feature of its own. */
function nodeFeature(node: EntryNode, name: string, source: string): SheetFeature {
  return { resolved: true, name, source, entries: node.entries ?? [node] };
}

const isNode = (entry: string | EntryNode): entry is EntryNode => typeof entry !== "string";

/** Drops Tasha's optional class features unless the table opted into them. */
function inPlay(definition: CharacterDefinition): (row: ClassFeatureRow) => boolean {
  if (houseRule(definition, "optionalClassFeatures")) return () => true;
  return (row) => parseJson(classFeatureVariantSchema, row.json) !== true;
}

function classGroups(
  dataDir: string,
  homebrewDb: HomebrewDb,
  definition: CharacterDefinition,
): FeatureGroup[] {
  return classLevels(definition).flatMap(({ class: ref, level, subclass }): FeatureGroup[] => {
    const name = displayName(ref);
    if ("homebrewId" in ref) {
      // A homebrew class carries no feature rows, so only a missing one has anything to show.
      if (getHomebrewClass(homebrewDb, ref.homebrewId)) return [];
      return [{ origin: "class", name, features: [unresolved(ref)] }];
    }
    if (!getClass(dataDir, ref.name, ref.source)) {
      return [{ origin: "class", name, features: [unresolved(ref)] }];
    }
    const features = getClassFeatures(dataDir, ref.name, ref.source, level)
      .filter(inPlay(definition))
      .map((row) => rowFeature(row.json, row, { level: row.level }));
    const groups: FeatureGroup[] = [{ origin: "class", name, features }];
    if (subclass) groups.push(subclassGroup(dataDir, definition, ref, subclass, level));
    return groups;
  });
}

function subclassGroup(
  dataDir: string,
  definition: CharacterDefinition,
  classRef: ContentRef,
  subclass: ContentRef,
  level: number,
): FeatureGroup {
  const row = getSubclass(dataDir, subclass.name, subclass.source, classRef.name, classRef.source);
  const features = row
    ? getSubclassFeatures(
        dataDir,
        classRef.name,
        classRef.source,
        row.short_name,
        row.source,
        level,
      )
        .filter(inPlay(definition))
        .map((feature) => rowFeature(feature.json, feature, { level: feature.level }))
    : [unresolved(subclass)];
  return { origin: "subclass", name: subclass.name, features };
}

/** Every named node the race or subrace row carries — `Darkvision`, `Fey Ancestry`. */
function raceGroup(
  dataDir: string,
  homebrewDb: HomebrewDb,
  definition: CharacterDefinition,
): FeatureGroup {
  const { race, subrace } = definition;
  const entry = entryOf(raceJson(dataDir, homebrewDb, definition));
  const raceName = entry && !subrace ? entry.name : displayName(race);
  const name = subrace ? `${raceName} (${subrace.name})` : raceName;
  if (!entry) return { origin: "race", name, features: [unresolved(subrace ?? race)] };
  const features = (entry.entries ?? [])
    .filter(isNode)
    .flatMap((node) =>
      typeof node.name === "string" ? [nodeFeature(node, node.name, entry.source)] : [],
    );
  return { origin: "race", name, features };
}

/**
 * The node a `classic` background flags `data.isFeature` — `Feature: Shelter of the
 * Faithful`. A `one` background flags none, since its feature is the origin feat the
 * feat group already carries.
 */
function backgroundGroup(
  dataDir: string,
  homebrewDb: HomebrewDb,
  definition: CharacterDefinition,
): FeatureGroup {
  const ref = definition.background;
  const entry = entryOf(
    "homebrewId" in ref
      ? getHomebrewBackground(homebrewDb, ref.homebrewId)?.json
      : getBackground(dataDir, ref.name, ref.source)?.json,
  );
  if (!entry) return { origin: "background", name: displayName(ref), features: [unresolved(ref)] };
  const features = (entry.entries ?? [])
    .filter(isNode)
    .filter((node) => (node.data as { isFeature?: unknown } | undefined)?.isFeature === true)
    .map((node) =>
      nodeFeature(
        node,
        typeof node.name === "string" ? node.name.replace(/^Feature:\s*/, "") : entry.name,
        entry.source,
      ),
    );
  return { origin: "background", name: entry.name, features };
}

function featGroup(
  dataDir: string,
  homebrewDb: HomebrewDb,
  definition: CharacterDefinition,
): FeatureGroup {
  const features = definition.feats.map(({ ref, level }) =>
    rowFeature(
      "homebrewId" in ref
        ? getHomebrewFeat(homebrewDb, ref.homebrewId)?.json
        : getFeat(dataDir, ref.name, ref.source)?.json,
      ref,
      level === undefined ? {} : { level },
    ),
  );
  return { origin: "feat", features };
}

/** No homebrew table holds an optional feature, so a homebrew pick never resolves. */
function optionalFeatureGroup(dataDir: string, definition: CharacterDefinition): FeatureGroup {
  const features = definition.optionalFeatures.map(({ ref, featureType }) =>
    rowFeature(
      "homebrewId" in ref ? undefined : getOptionalFeature(dataDir, ref.name, ref.source)?.json,
      ref,
      { featureType },
    ),
  );
  return { origin: "optionalFeature", features };
}

/** Groups in sheet order, dropping any that granted nothing. */
export function resolveCharacterFeatures(
  dataDir: string,
  homebrewDb: HomebrewDb,
  definition: CharacterDefinition,
): CharacterFeatures {
  const groups = [
    ...classGroups(dataDir, homebrewDb, definition),
    raceGroup(dataDir, homebrewDb, definition),
    backgroundGroup(dataDir, homebrewDb, definition),
    featGroup(dataDir, homebrewDb, definition),
    optionalFeatureGroup(dataDir, definition),
  ];
  return { groups: groups.filter((group) => group.features.length > 0) };
}
