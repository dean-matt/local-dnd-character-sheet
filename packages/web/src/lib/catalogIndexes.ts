/**
 * The catalog types a reader can browse: each lists a page of one edition from its API
 * route, and addresses a row at the detail route `catalogRows.ts` registers for it. A
 * `/search` hit's `type` names one of these, or a type with no detail route yet.
 */
import {
  backgroundRecordSchema,
  classRecordSchema,
  featRecordSchema,
  homebrewItemRecordSchema,
  homebrewSpellRecordSchema,
  itemRecordSchema,
  raceRecordSchema,
  spellRecordSchema,
} from "@dnd/catalog";
import { z } from "zod";

/** A catalog row carries `source`; a homebrew row merged into the same list carries `id`. */
export type CatalogIndexRow = { name: string; source: string } | { id: string; name: string };

export interface CatalogIndex {
  /** The `type` a `/search` hit of this kind carries. */
  type: string;
  label: string;
  /** The API collection, which is also the path under `/catalog/`. */
  collection: string;
  schema: z.ZodType<{ items: CatalogIndexRow[]; total: number }>;
}

const page = (row: z.ZodType<CatalogIndexRow>) => z.object({ items: z.array(row), total: z.int() });

export const CATALOG_INDEXES: CatalogIndex[] = [
  {
    type: "background",
    label: "Backgrounds",
    collection: "backgrounds",
    schema: page(backgroundRecordSchema),
  },
  { type: "class", label: "Classes", collection: "classes", schema: page(classRecordSchema) },
  { type: "feat", label: "Feats", collection: "feats", schema: page(featRecordSchema) },
  {
    type: "item",
    label: "Items",
    collection: "items",
    schema: page(z.union([itemRecordSchema, homebrewItemRecordSchema])),
  },
  { type: "race", label: "Races", collection: "races", schema: page(raceRecordSchema) },
  {
    type: "spell",
    label: "Spells",
    collection: "spells",
    schema: page(z.union([spellRecordSchema, homebrewSpellRecordSchema])),
  },
];

/** The detail route of one row in `collection`, catalog or homebrew. */
export function catalogRowPath(collection: string, row: CatalogIndexRow): string {
  return "id" in row
    ? `/catalog/homebrew/${collection}/${encodeURIComponent(row.id)}`
    : `/catalog/${collection}/${encodeURIComponent(row.name)}/${encodeURIComponent(row.source)}`;
}
