/**
 * The catalog rows a URL can name, each under `/catalog/` at the path of the API route
 * that reads it, so a row's address carries its whole identity key. A class feature has
 * no API route of its own and is read from its class's grants at its level, which is
 * why its address names the class and the level. Its address takes the parts
 * `{@classFeature}` and `{@subclassFeature}` carry, a subclass's short name included.
 */
import {
  backgroundRecordSchema,
  classGrantsSchema,
  classRecordSchema,
  type Entries,
  entriesSchema,
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
import { z } from "zod";
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

type Row = { name: string; json: { entries?: Entries; entriesHigherLevel?: unknown } };

/** A spell keeps its upcast rule apart from `entries`, and the text reads complete only with it. */
const toRow = (record: Row & { source?: string }): CatalogRow => ({
  name: record.name,
  source: record.source,
  entries: [
    ...(record.json.entries ?? []),
    ...(entriesSchema.safeParse(record.json.entriesHigherLevel).data ?? []),
  ],
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

const LEVEL = /^([1-9]|1\d|20)$/;

/**
 * A feature the grants list does not name at exactly that level is as missing as a 404,
 * and so is a level no class reaches, which the API would refuse as a bad request.
 */
async function feature(
  grantsPath: () => string | Promise<string>,
  key: Params,
): Promise<CatalogRow> {
  const missing = new ApiError("No feature with that name, source and level", 404);
  if (!LEVEL.test(key.level ?? "")) throw missing;
  const grants = await apiGet(`${await grantsPath()}/at/${segments(key.level)}`, classGrantsSchema);
  const match = grants.features.find(
    (f) => f.name === key.name && f.source === key.source && `${f.level}` === key.level,
  );
  if (!match) throw missing;
  return toRow(match);
}

const classPath = (key: Params) => `/classes/${segments(key.className, key.classSource)}`;

const subclassListSchema = z.object({ items: z.array(subclassRecordSchema) });

/**
 * `{@subclassFeature}` names its subclass by short name, and the API reads a subclass by
 * its full one, so the short name resolves against the class's subclasses of each edition.
 * One page of 200, the API's cap, is read per edition: a class past 200 subclasses in one
 * edition would miss the rest, and following `total` is the way out.
 */
async function subclassPath(key: Params): Promise<string> {
  const lists = await Promise.all(
    subclassRecordSchema.shape.edition.options.map((edition) =>
      apiGet(`${classPath(key)}/subclasses?edition=${edition}&limit=200`, subclassListSchema),
    ),
  );
  const subclass = lists
    .flatMap((list) => list.items)
    .find((s) => s.shortName === key.subclassShortName && s.source === key.subclassSource);
  if (!subclass) throw new ApiError("No subclass with that short name and source", 404);
  return `${classPath(key)}/subclasses/${segments(subclass.name, subclass.source)}`;
}

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
    load: (key) => feature(() => classPath(key), key),
  },
  {
    path: "classes/:className/:classSource/subclasses/:subclassShortName/:subclassSource/features/:name/:source/:level",
    lookedFor: (key) =>
      `the subclass feature ${pair(key.name, key.source)} of ${pair(key.subclassShortName, key.subclassSource)}, ${pair(key.className, key.classSource)}, at level ${key.level}`,
    load: (key) => feature(() => subclassPath(key), key),
  },
  homebrew("spells", "spell", homebrewSpellRecordSchema),
  homebrew("items", "item", homebrewItemRecordSchema),
  homebrew("races", "race", homebrewRaceRecordSchema),
  homebrew("backgrounds", "background", homebrewBackgroundRecordSchema),
  homebrew("feats", "feat", homebrewFeatRecordSchema),
  homebrew("classes", "class", homebrewClassRecordSchema),
];
