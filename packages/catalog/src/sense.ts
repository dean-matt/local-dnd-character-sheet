import { SENSES, type Sense } from "@dnd/rules";
import { z } from "zod";

const rangeSchema = z.int().min(1);

/** A `senses` list as a feat or a homebrew item writes it: one object per grant, a sense and its range in feet. */
export const senseListSchema = z.array(z.partialRecord(z.enum(SENSES), rangeSchema));

const stated = rangeSchema.optional().catch(undefined);

/**
 * What a race, subrace, feat or item row grants as senses, each once at its longest range.
 * A race states a sense as a field of its own, such as `darkvision: 60`; a feat or an item
 * states a `senses` list. A malformed field grants nothing rather than refusing the row.
 */
export const senseGrantsSchema = z
  .looseObject({
    darkvision: stated,
    blindsight: stated,
    tremorsense: stated,
    truesight: stated,
    senses: senseListSchema.optional().catch(undefined),
  })
  .transform((row) => {
    const longest = new Map<Sense, number>();
    const grants = [...SENSES.map((sense) => ({ [sense]: row[sense] })), ...(row.senses ?? [])];
    for (const grant of grants) {
      for (const sense of SENSES) {
        const range = grant[sense];
        if (range !== undefined && range > (longest.get(sense) ?? 0)) longest.set(sense, range);
      }
    }
    return SENSES.flatMap((name) => {
      const range = longest.get(name);
      return range === undefined ? [] : [{ name, range }];
    });
  });
