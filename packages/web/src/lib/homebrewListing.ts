import {
  type Entries,
  homebrewBackgroundRecordSchema,
  homebrewClassRecordSchema,
  homebrewFeatRecordSchema,
  homebrewItemRecordSchema,
  homebrewRaceRecordSchema,
  homebrewSkillRecordSchema,
  homebrewSpellRecordSchema,
  itemHitFacts,
} from "@dnd/catalog";
import type { CharacterRecord } from "@dnd/character";
import type { z } from "zod";
import type { HomebrewCollection } from "../hooks/useHomebrew.ts";
import {
  backgroundFacts,
  classFacts,
  type Fact,
  featFacts,
  raceFacts,
  skillFacts,
} from "./homebrewOptionFacts.ts";
import { itemMeta } from "./itemKind.ts";
import { schoolName } from "./spellSchool.ts";

/** What every homebrew record carries, whichever kind it is. */
export interface HomebrewRow {
  id: string;
  name: string;
  edition: CharacterRecord["edition"];
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

/** Each kind, keyed in the order the Homebrew settings page lists them. */
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
  classes: {
    collection: "classes",
    noun: "class",
    heading: "Classes",
    recordSchema: homebrewClassRecordSchema,
    chips: factChips(classFacts),
  },
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
};
