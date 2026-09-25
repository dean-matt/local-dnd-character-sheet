/**
 * A race or subrace row's `json`, in the shape `data/races.json` writes an entry. Models
 * only what a renderer needs to walk — `name`, `source` and `entries` — since neither
 * table derives a column from anything deeper; everything else upstream carries, such as
 * ability score increases, passes through unparsed. `raceTraitsSchema` reads size and
 * speed off the same entry for a derived block.
 *
 * A homebrew race's `json` reuses this same shape rather than one of its own — see
 * `homebrewRaceInputSchema` below.
 */
import { EDITIONS, SIZES, type Size } from "@dnd/rules";
import { z } from "zod";
import { entriesSchema } from "./entry.ts";

export const raceEntrySchema = z.looseObject({
  name: z.string().min(1),
  source: z.string().min(1),
  entries: entriesSchema.optional(),
});

export type RaceEntry = z.infer<typeof raceEntrySchema>;

/** `V` is upstream's "varies": Verdan grows from Small to Medium, and nothing records when. */
const SIZE_CODES = {
  T: "tiny",
  S: "small",
  M: "medium",
  V: "medium",
  L: "large",
  H: "huge",
  G: "gargantuan",
} as const satisfies Record<string, Size>;

type SizeCode = keyof typeof SIZE_CODES;

/** `true` is upstream's "equal to your walking speed", written for `fly`, `climb` and `swim`. */
const speedModeSchema = z.union([z.int().min(0), z.literal(true)]);

const SPEED_MODES = ["burrow", "climb", "fly", "swim"] as const;

type RaceSpeed = { walk: number } & Partial<Record<(typeof SPEED_MODES)[number], number>>;

const speedSchema = z.union([
  z
    .int()
    .min(0)
    .transform((walk) => ({ walk })),
  z
    .looseObject({
      walk: z.int().min(0),
      burrow: speedModeSchema.optional(),
      climb: speedModeSchema.optional(),
      fly: speedModeSchema.optional(),
      swim: speedModeSchema.optional(),
    })
    .transform((stated) => {
      const speed: RaceSpeed = { walk: stated.walk };
      for (const mode of SPEED_MODES) {
        const feet = stated[mode];
        if (feet !== undefined) speed[mode] = feet === true ? stated.walk : feet;
      }
      return speed;
    }),
]);

/**
 * The size and speeds a race or subrace row states, read off the same `json` a renderer
 * walks. A subrace row is already merged over its race, so either row answers alone.
 *
 * A character stores no size choice, so a race offering several — 43 upstream rows
 * write `["S", "M"]` — reads as the largest it offers. The way out is a `size` on the
 * character definition.
 */
export const raceTraitsSchema = z
  .looseObject({
    size: z.array(z.enum(Object.keys(SIZE_CODES) as [SizeCode, ...SizeCode[]])).min(1),
    speed: speedSchema,
  })
  .transform(({ size, speed }) => ({
    size: size
      .map((code): Size => SIZE_CODES[code])
      .reduce((largest, next) => (SIZES.indexOf(next) > SIZES.indexOf(largest) ? next : largest)),
    speed,
  }));

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
