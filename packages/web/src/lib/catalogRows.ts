/**
 * The catalog rows a URL can name, each under `/catalog/` at the path of the API route
 * that reads it, so a row's address carries its whole identity key. A class feature has
 * no API route of its own and is read from its class's grants at its level, which is
 * why its address names the class and the level.
 */
import {
  backgroundRecordSchema,
  classGrantsSchema,
  classRecordSchema,
  type Entries,
  featRecordSchema,
  homebrewBackgroundRecordSchema,
  homebrewClassRecordSchema,
  homebrewFeatRecordSchema,
  homebrewItemRecordSchema,
  homebrewRaceRecordSchema,
  homebrewSpellRecordSchema,
  itemRecordSchema,
  raceRecordSchema,
  spellRecordSchema,
  subclassRecordSchema,
  subraceRecordSchema,
} from "@dnd/catalog";
import type { Params } from "react-router";
import type { z } from "zod";
import { ApiError, apiGet } from "./api.ts";

/** `source` is absent on a homebrew row, the shape difference the sheet reads everywhere. */
interface CatalogRow {
  name: string;
  source?: string;
  entries: Entries;
}

export interface CatalogTarget {
  path: string;
  lookedFor: (key: Params) => string;
  load: (key: Params) => Promise<CatalogRow>;
}

type Row = { name: string; json: { entries?: Entries } };

const toRow = (record: Row & { source?: string }): CatalogRow => ({
  name: record.name,
  source: record.source,
  entries: record.json.entries ?? [],
});

const segments = (...parts: (string | undefined)[]) =>
  parts.map((part) => encodeURIComponent(part ?? "")).join("/");

const pair = (name?: string, source?: string) => `${name} (${source})`;

function nameSource(
  collection: string,
  label: string,
  schema: z.ZodType<Row & { source: string }>,
) {
  return {
    path: `${collection}/:name/:source`,
    lookedFor: (key: Params) => `the ${label} ${pair(key.name, key.source)}`,
    load: async (key: Params) =>
      toRow(await apiGet(`/${collection}/${segments(key.name, key.source)}`, schema)),
  };
}

function homebrew(collection: string, label: string, schema: z.ZodType<Row>) {
  return {
    path: `homebrew/${collection}/:id`,
    lookedFor: (key: Params) => `the homebrew ${label} ${key.id}`,
    load: async (key: Params) =>
      toRow(await apiGet(`/homebrew/${collection}/${segments(key.id)}`, schema)),
  };
}

/** A feature the grants list does not name at exactly that level is as missing as a 404. */
async function feature(grantsPath: string, key: Params): Promise<CatalogRow> {
  const grants = await apiGet(`${grantsPath}/at/${segments(key.level)}`, classGrantsSchema);
  const match = grants.features.find(
    (f) => f.name === key.name && f.source === key.source && `${f.level}` === key.level,
  );
  if (!match) throw new ApiError("No feature with that name, source and level", 404);
  return toRow(match);
}

const classPath = (key: Params) => `/classes/${segments(key.className, key.classSource)}`;
const subclassPath = (key: Params) =>
  `${classPath(key)}/subclasses/${segments(key.subclassName, key.subclassSource)}`;

export const CATALOG_TARGETS: CatalogTarget[] = [
  nameSource("spells", "spell", spellRecordSchema),
  nameSource("items", "item", itemRecordSchema),
  {
    path: "items/:name/:source/variants/:variantName/:variantSource",
    lookedFor: (key) =>
      `the magic variant ${pair(key.variantName, key.variantSource)} of ${pair(key.name, key.source)}`,
    load: async (key) =>
      toRow(
        await apiGet(
          `/items/${segments(key.name, key.source, "variants", key.variantName, key.variantSource)}`,
          itemRecordSchema,
        ),
      ),
  },
  nameSource("races", "race", raceRecordSchema),
  {
    path: "races/:raceName/:raceSource/subraces/:name/:source",
    lookedFor: (key) =>
      `the subrace ${pair(key.name, key.source)} of ${pair(key.raceName, key.raceSource)}`,
    load: async (key) =>
      toRow(
        await apiGet(
          `/races/${segments(key.raceName, key.raceSource, "subraces", key.name, key.source)}`,
          subraceRecordSchema,
        ),
      ),
  },
  nameSource("backgrounds", "background", backgroundRecordSchema),
  nameSource("feats", "feat", featRecordSchema),
  nameSource("classes", "class", classRecordSchema),
  {
    path: "classes/:className/:classSource/subclasses/:name/:source",
    lookedFor: (key) =>
      `the subclass ${pair(key.name, key.source)} of ${pair(key.className, key.classSource)}`,
    load: async (key) =>
      toRow(
        await apiGet(
          `${classPath(key)}/subclasses/${segments(key.name, key.source)}`,
          subclassRecordSchema,
        ),
      ),
  },
  {
    path: "classes/:className/:classSource/features/:name/:source/:level",
    lookedFor: (key) =>
      `the class feature ${pair(key.name, key.source)} of ${pair(key.className, key.classSource)} at level ${key.level}`,
    load: (key) => feature(classPath(key), key),
  },
  {
    path: "classes/:className/:classSource/subclasses/:subclassName/:subclassSource/features/:name/:source/:level",
    lookedFor: (key) =>
      `the subclass feature ${pair(key.name, key.source)} of ${pair(key.subclassName, key.subclassSource)}, ${pair(key.className, key.classSource)}, at level ${key.level}`,
    load: (key) => feature(subclassPath(key), key),
  },
  homebrew("spells", "spell", homebrewSpellRecordSchema),
  homebrew("items", "item", homebrewItemRecordSchema),
  homebrew("races", "race", homebrewRaceRecordSchema),
  homebrew("backgrounds", "background", homebrewBackgroundRecordSchema),
  homebrew("feats", "feat", homebrewFeatRecordSchema),
  homebrew("classes", "class", homebrewClassRecordSchema),
];
