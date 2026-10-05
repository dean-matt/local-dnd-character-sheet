/**
 * `GET /catalog/{type}/{name}/{source}`: one row of a type with no route of its own — an
 * optional feature, a Tier B `lookups` row or a Tier C `entities` row — read by the `type`
 * a search hit carries.
 */
import { EDITIONS } from "@dnd/rules";
import { z } from "zod";

export const catalogRowRecordSchema = z.strictObject({
  type: z.string().min(1),
  name: z.string().min(1),
  source: z.string().min(1),
  /** A deity's pantheon or a card's deck, absent on every other type. */
  qualifier: z.string().min(1).optional(),
  edition: z.enum(EDITIONS).nullable(),
  /**
   * The upstream entry whole, unparsed: its prose sits in `entries` on most types, in `rows`
   * on a table, and in neither on a monster, whose stat block `catalogRowEntries` builds.
   */
  json: z.looseObject({}),
});
