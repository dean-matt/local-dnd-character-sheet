/**
 * What a character choosing spells reads beside the picker: the spells a grantor gives
 * outright by a level, and the level and list standing of each spell already picked.
 */
import { z } from "zod";

const catalogRefSchema = z.strictObject({ name: z.string().min(1), source: z.string().min(1) });

const spellRefSchema = z.union([
  catalogRefSchema,
  z.strictObject({ homebrewId: z.string().min(1) }),
]);

/** Each kind of row that can grant a spell, as `GET /spells/granted` names it. */
export const SPELL_GRANTORS = [
  "class",
  "subclass",
  "race",
  "subrace",
  "background",
  "feat",
  "optionalFeature",
] as const;

export type SpellGrantor = (typeof SPELL_GRANTORS)[number];

/**
 * The spells one grantor gives outright by a level, never one it leaves to a pick, and
 * how many picks it offers by that level, as `offeredPicks` counts them.
 */
export const grantedSpellsSchema = z.strictObject({
  spells: z.array(catalogRefSchema),
  picks: z.strictObject({
    cantrips: z.int().min(0),
    spells: z.int().min(0),
    alternatives: z.boolean(),
  }),
});

/** Past this a request is refused, a bound on one character rather than a count any reaches. */
const MAX_SPELLS_PER_LOOKUP = 500;

/** A row that can grant a spell, keyed as `GET /spells/granted` names it. */
const spellGrantorSchema = z.strictObject({
  grantor: z.enum(SPELL_GRANTORS),
  ref: catalogRefSchema,
  /** A subclass's class or a subrace's race. */
  parent: catalogRefSchema.optional(),
  /** The level its picks are read at, every level where absent. */
  level: z.int().min(1).max(20).optional(),
});

/** Past this a request is refused, more rows than one character names. */
const MAX_GRANTORS_PER_LOOKUP = 50;

/**
 * Spells to look up, the class whose list each is checked against, and the other rows
 * whose own picks each may be. A subclass widens the list by the spells it adds to it, as
 * the Eldritch Knight's are the wizard's.
 */
export const spellLookupRequestSchema = z.strictObject({
  spells: z.array(spellRefSchema).max(MAX_SPELLS_PER_LOOKUP),
  list: z
    .strictObject({
      class: catalogRefSchema,
      subclass: catalogRefSchema.optional(),
      /** The class level the subclass's additions are read at, every level where absent. */
      level: z.int().min(1).max(20).optional(),
    })
    .optional(),
  offeredBy: z.array(spellGrantorSchema).max(MAX_GRANTORS_PER_LOOKUP).optional(),
});

export type SpellLookupRequest = z.infer<typeof spellLookupRequestSchema>;

/**
 * Positional: each spell's name, level, whether the list holds it, and whether a row in
 * `offeredBy` offers it as a pick, `null` where no row answers. `listed` and `offered` are
 * absent where the request named no list or no rows, and false for a homebrew spell, which
 * no catalog row offers.
 */
export const spellLookupResponseSchema = z.strictObject({
  spells: z.array(
    z
      .strictObject({
        name: z.string().min(1),
        level: z.int().min(0).max(9),
        listed: z.boolean().optional(),
        offered: z.boolean().optional(),
      })
      .nullable(),
  ),
});

export type SpellLookup = z.infer<typeof spellLookupResponseSchema>["spells"][number];

/**
 * How many cantrips and leveled spells a row leaves to the player's pick, and whether it
 * offers its blocks as alternatives, which the counts then take the largest of.
 */
export type OfferedPicks = { cantrips: number; spells: number; alternatives: boolean };

type Choose = { filter?: string; count: number };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Every `choose` under one grant, however deep its frequency and use-count nesting. */
function choosesIn(value: unknown): Choose[] {
  if (Array.isArray(value)) return value.flatMap(choosesIn);
  if (!isRecord(value)) return [];
  const { choose, count } = value;
  const picks = typeof count === "number" ? count : 1;
  if (typeof choose === "string") return [{ filter: choose, count: picks }];
  if (isRecord(choose)) {
    return [{ count: typeof choose.count === "number" ? choose.count : 1 }];
  }
  return Object.values(value).flatMap(choosesIn);
}

/** A filter that names spell level 0 alone picks a cantrip; anything else, a spell. */
const picksCantrip = ({ filter }: Choose) =>
  filter !== undefined && /(^|\|)level=0(\||$)/.test(filter);

/**
 * The picks a row's `additionalSpells` offers by `level`: the `choose` entries under each
 * level key at or below it, a key naming no level arriving with the row. An `expanded`
 * block only widens a list, so it offers none. A row offering several blocks offers them
 * as alternatives, as Magic Initiate offers six classes or an elf its lineages, so the
 * largest block counts and `alternatives` says the counts are a ceiling rather than owed. A
 * `choose` from a list of names reads as a spell, since the names carry no level.
 */
export function offeredPicks(json: unknown, level: number): OfferedPicks {
  const blocks =
    isRecord(json) && Array.isArray(json.additionalSpells) ? json.additionalSpells : [];
  const each = blocks.map((block) => {
    const chooses = Object.entries(isRecord(block) ? block : {})
      .filter(([kind]) => ["innate", "known", "prepared"].includes(kind))
      .flatMap(([, byLevel]) =>
        Object.entries(isRecord(byLevel) ? byLevel : {})
          .filter(([key]) => !/^\d+$/.test(key) || Number(key) <= level)
          .flatMap(([, value]) => choosesIn(value)),
      );
    const total = (cantrip: boolean) =>
      chooses
        .filter((choose) => picksCantrip(choose) === cantrip)
        .reduce((sum, choose) => sum + choose.count, 0);
    return { cantrips: total(true), spells: total(false) };
  });
  const largest = each.reduce(
    (best, block) => (block.cantrips + block.spells > best.cantrips + best.spells ? block : best),
    { cantrips: 0, spells: 0 },
  );
  return { ...largest, alternatives: blocks.length > 1 };
}
