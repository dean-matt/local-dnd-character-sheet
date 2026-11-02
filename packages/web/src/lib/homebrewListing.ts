import {
  type Entries,
  homebrewBackgroundRecordSchema,
  homebrewClassRecordSchema,
  homebrewDeityRecordSchema,
  homebrewFeatRecordSchema,
  homebrewItemRecordSchema,
  homebrewOptionalFeatureRecordSchema,
  homebrewRaceRecordSchema,
  homebrewSkillRecordSchema,
  homebrewSpellRecordSchema,
  homebrewSubclassRecordSchema,
  homebrewSubraceRecordSchema,
  itemHitFacts,
} from "@dnd/catalog";
import type { CharacterRecord } from "@dnd/character";
import type { z } from "zod";
import type { HomebrewCollection } from "../hooks/useHomebrew.ts";
import { featureTypeLabel } from "./featureTypeLabel.ts";
import {
  backgroundFacts,
  classFacts,
  deityAlignment,
  type Fact,
  featFacts,
  raceFacts,
  skillFacts,
} from "./homebrewOptionFacts.ts";
import { itemMeta } from "./itemKind.ts";
import { schoolName } from "./spellSchool.ts";

export interface HomebrewRow {
  id: string;
  name: string;
  /** Absent on a kind with no edition, such as a deity. */
  edition?: CharacterRecord["edition"];
  json: { entries?: Entries };
}

/** A kind of homebrew as a list of its rows names it: its route, its record schema and its chips. */
export interface ListingKind<R extends HomebrewRow = HomebrewRow> {
  collection: HomebrewCollection;
  noun: string;
  heading: string;
  recordSchema: z.ZodType<R>;
  /** A method, so a kind of a narrower record still counts as a `ListingKind`. */
  chips(record: R): string[];
}

const factChips =
  (facts: (json: Record<string, unknown>) => Fact[]) =>
  (record: HomebrewRow): string[] =>
    facts(record.json).map(([, value]) => value);

const items: ListingKind<z.infer<typeof homebrewItemRecordSchema>> = {
  collection: "items",
  noun: "item",
  heading: "Items",
  recordSchema: homebrewItemRecordSchema,
  chips: (record) => [itemMeta(itemHitFacts(record.json))],
};

const spells: ListingKind<z.infer<typeof homebrewSpellRecordSchema>> = {
  collection: "spells",
  noun: "spell",
  heading: "Spells",
  recordSchema: homebrewSpellRecordSchema,
  chips: (record) => [
    record.level === 0 ? "Cantrip" : `Level ${record.level}`,
    schoolName(record.school),
    ...(record.concentration ? ["Concentration"] : []),
    ...(record.ritual ? ["Ritual"] : []),
  ],
};

/**
 * A stored subclass as the editor edits it: its parent class, which the record holds beside
 * `json`, moves into the entry as the input names it, and the class fields a read stamps
 * into `json` stay out of it, so a save does not store a class name the parent has since lost.
 */
const subclassRecordSchema = homebrewSubclassRecordSchema.transform((record) => {
  const { className: _name, classSource: _source, shortName, ...json } = record.json;
  return {
    ...record,
    json: {
      ...json,
      ...(shortName === record.name ? {} : { shortName }),
      parent: record.classId
        ? { classId: record.classId }
        : { name: record.className, source: record.classSource },
    },
  };
});

const subclasses: ListingKind<z.infer<typeof subclassRecordSchema>> = {
  collection: "subclasses",
  noun: "subclass",
  heading: "Subclasses",
  recordSchema: subclassRecordSchema,
  chips: (record) => [record.className],
};

/** A stored subrace as the editor edits it: its parent race moves from the columns into the entry. */
const subraceRecordSchema = homebrewSubraceRecordSchema.transform((record) => ({
  ...record,
  json: {
    ...record.json,
    parent: record.raceId
      ? { raceId: record.raceId }
      : { name: record.raceName, source: record.raceSource },
  },
}));

const subraces: ListingKind<z.infer<typeof subraceRecordSchema>> = {
  collection: "subraces",
  noun: "subrace",
  heading: "Subraces",
  recordSchema: subraceRecordSchema,
  chips: (record) => [record.raceName],
};

const deities: ListingKind<z.infer<typeof homebrewDeityRecordSchema>> = {
  collection: "deities",
  noun: "deity",
  heading: "Deities",
  recordSchema: homebrewDeityRecordSchema,
  chips: ({ pantheon, json }) =>
    [pantheon, deityAlignment(json), ...(json.domains ?? [])].filter(Boolean),
};

const optionalFeatures: ListingKind<z.infer<typeof homebrewOptionalFeatureRecordSchema>> = {
  collection: "optional-features",
  noun: "optional feature",
  heading: "Optional features",
  recordSchema: homebrewOptionalFeatureRecordSchema,
  chips: ({ json }) => json.featureType.map(featureTypeLabel),
};

/** Each kind, keyed in the order the Homebrew sidebar lists them. */
export const LISTING_KINDS: Record<HomebrewCollection, ListingKind> = {
  items,
  spells,
  races: {
    collection: "races",
    noun: "race",
    heading: "Races",
    recordSchema: homebrewRaceRecordSchema,
    chips: factChips(raceFacts),
  },
  subraces,
  classes: {
    collection: "classes",
    noun: "class",
    heading: "Classes",
    recordSchema: homebrewClassRecordSchema,
    chips: factChips(classFacts),
  },
  subclasses,
  backgrounds: {
    collection: "backgrounds",
    noun: "background",
    heading: "Backgrounds",
    recordSchema: homebrewBackgroundRecordSchema,
    chips: factChips(backgroundFacts),
  },
  feats: {
    collection: "feats",
    noun: "feat",
    heading: "Feats",
    recordSchema: homebrewFeatRecordSchema,
    chips: factChips(featFacts),
  },
  skills: {
    collection: "skills",
    noun: "skill",
    heading: "Skills",
    recordSchema: homebrewSkillRecordSchema,
    chips: factChips(skillFacts),
  },
  deities,
  "optional-features": optionalFeatures,
};
