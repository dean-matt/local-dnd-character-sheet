/**
 * A race or subrace row's `json`, in the shape `data/races.json` writes an entry. Models
 * only what a renderer needs to walk — `name`, `source` and `entries` — since neither
 * table derives a column from anything deeper; everything else upstream carries, such as
 * size, speed and ability score increases, passes through unparsed.
 *
 * A homebrew race's `json` reuses this same shape rather than one of its own — see
 * `homebrewRaceInputSchema` below.
 */
import { EDITIONS } from "@dnd/rules";
import { z } from "zod";
import { entriesSchema } from "./entry.ts";

export const raceEntrySchema = z.looseObject({
  name: z.string().min(1),
  source: z.string().min(1),
  entries: entriesSchema.optional(),
});

export type RaceEntry = z.infer<typeof raceEntrySchema>;

/** A race row from `content.db`'s `races` table, addressed by `(name, source)`. */
export const raceRecordSchema = z.strictObject({
  name: z.string().min(1),
  source: z.string().min(1),
  edition: z.enum(EDITIONS),
  json: raceEntrySchema,
});

export type RaceRecord = z.infer<typeof raceRecordSchema>;

/**
 * A subrace row from `content.db`'s `subraces` table — the race and the subrace already
 * merged by the ETL, not a delta a caller applies. `name` allows the empty string: five
 * `PHB` base variants (Dragonborn, Half-Elf, Half-Orc, Human, Tiefling) have no subrace
 * name of their own. See `docs/data-model.md` for why the key carries the race too.
 */
export const subraceRecordSchema = z.strictObject({
  name: z.string(),
  source: z.string().min(1),
  raceName: z.string().min(1),
  raceSource: z.string().min(1),
  edition: z.enum(EDITIONS),
  json: raceEntrySchema,
});

export type SubraceRecord = z.infer<typeof subraceRecordSchema>;

/**
 * What a caller submits to create or rename a homebrew race. `source` is never here —
 * the server always stamps `HOMEBREW_SOURCE` — and `edition` rides beside the entry
 * rather than inside it, since it is a `homebrew_races` column, not a field the 5etools
 * shape carries. A homebrew race is always full and self-contained: it has no subrace of
 * its own.
 */
export const homebrewRaceInputSchema = raceEntrySchema.omit({ source: true }).extend({
  edition: z.enum(EDITIONS),
});

export type HomebrewRaceInput = z.infer<typeof homebrewRaceInputSchema>;

/** A stored homebrew race, as an endpoint returns it. */
export const homebrewRaceRecordSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  edition: z.enum(EDITIONS),
  json: raceEntrySchema,
  createdAt: z.iso.datetime(),
});

export type HomebrewRaceRecord = z.infer<typeof homebrewRaceRecordSchema>;
