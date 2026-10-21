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
  /** The alternative blocks the row offers, by label and in block order, none where it offers one. */
  blocks: z.array(z.string().min(1)),
  picks: z.strictObject({
    cantrips: z.int().min(0),
    spells: z.int().min(0),
    learned: z.int().min(0),
    alternatives: z.boolean(),
  }),
});

/** Past this a request is refused, a bound on one character rather than a count any reaches. */
const MAX_SPELLS_PER_LOOKUP = 500;

/**
 * A row's offer of spell picks by a level, as `GET /spells/granted` reads the row: the
 * spells its `choose` filters admit, never one it gives outright.
 */
const spellOfferSchema = z.strictObject({
  grantor: z.enum(SPELL_GRANTORS),
  ref: catalogRefSchema,
  /** A subclass's class or a subrace's race, which the grantor's key carries. */
  parent: catalogRefSchema.optional(),
  level: z.int().min(1).max(20),
  /** The alternative block the player chose, any block's offer where absent. */
  block: z.int().min(0).optional(),
});

export type SpellOffer = z.infer<typeof spellOfferSchema>;

/**
 * Spells to look up, and the class whose list or the row whose offer each is checked
 * against. A subclass widens the list by the spells it adds to it, as the Eldritch
 * Knight's are the wizard's.
 */
export const spellLookupRequestSchema = z
  .strictObject({
    spells: z.array(spellRefSchema).max(MAX_SPELLS_PER_LOOKUP),
    list: z
      .strictObject({
        class: catalogRefSchema,
        subclass: catalogRefSchema.optional(),
        /** The class level the subclass's additions are read at, every level where absent. */
        level: z.int().min(1).max(20).optional(),
      })
      .optional(),
    offer: spellOfferSchema.optional(),
  })
  .refine((request) => !(request.list && request.offer), {
    error: "a lookup checks against a class's list or a row's offer, not both",
  });

export type SpellLookupRequest = z.infer<typeof spellLookupRequestSchema>;

/**
 * Positional: each spell's name, level and whether the list or the offer holds it, `null`
 * where no row answers. `listed` is absent where the request named neither, and false for a
 * homebrew spell, which no class's list and no row's offer holds.
 */
export const spellLookupResponseSchema = z.strictObject({
  spells: z.array(
    z
      .strictObject({
        name: z.string().min(1),
        level: z.int().min(0).max(9),
        listed: z.boolean().optional(),
      })
      .nullable(),
  ),
});

export type SpellLookup = z.infer<typeof spellLookupResponseSchema>["spells"][number];

/**
 * How many cantrips and leveled spells a row leaves to the player's pick, and whether it
 * offers its blocks as alternatives, which the counts then take the largest of. `learned`
 * is how many of `spells` a `known` key offers, which a class that prepares its spells
 * learns rather than prepares, as a 2024 Evoker adds its Savant picks to its spellbook.
 */
export type OfferedPicks = {
  cantrips: number;
  spells: number;
  learned: number;
  alternatives: boolean;
};

type Choose = { filter?: string; from?: unknown[]; count: number };

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
    const from = Array.isArray(choose.from) ? choose.from : [];
    return [{ from, count: typeof choose.count === "number" ? choose.count : 1 }];
  }
  return Object.values(value).flatMap(choosesIn);
}

/**
 * A filter that names spell level 0 alone picks a cantrip, as does a list whose every name
 * carries upstream's `#c` cantrip mark; anything else, a spell.
 */
const picksCantrip = ({ filter, from }: Choose) =>
  filter !== undefined
    ? /(^|\|)level=0(\||$)/.test(filter)
    : from !== undefined &&
      from.length > 0 &&
      from.every((name) => typeof name === "string" && name.endsWith("#c"));

const blocksOf = (json: unknown): unknown[] =>
  isRecord(json) && Array.isArray(json.additionalSpells) ? json.additionalSpells : [];

/**
 * The labels of the alternative blocks a row offers: each block's name, or its position
 * where upstream leaves it unnamed. A row offering one block offers no alternatives.
 */
export function blockLabels(json: unknown): string[] {
  const blocks = blocksOf(json);
  if (blocks.length < 2) return [];
  return blocks.map((block, index) =>
    isRecord(block) && typeof block.name === "string" ? block.name : `Option ${index + 1}`,
  );
}

/** `block` where the row has that alternative block, else undefined: a stored index past the last block is no choice. */
export function chosenBlock(json: unknown, block: number | undefined): number | undefined {
  return block !== undefined && block < blocksOf(json).length ? block : undefined;
}

/**
 * A filter naming spell level 0 beside another level picks a cantrip or a spell, as College
 * of Lore's Magical Discoveries does.
 */
const picksEither = (choose: Choose) =>
  !picksCantrip(choose) &&
  choose.filter
    ?.match(/(?:^|\|)level=([^|]*)/)?.[1]
    ?.split(";")
    .includes("0") === true;

/** The largest of the chosen blocks' picks, counted as `offeredPicks` and `eitherPicks` read them. */
function largestBlock(json: unknown, level: number, block?: number) {
  const all = blocksOf(json);
  const at = chosenBlock(json, block);
  const blocks = at === undefined ? all : [all[at]];
  const each = blocks.map((block) => {
    const chooses = Object.entries(isRecord(block) ? block : {})
      .filter(([kind]) => ["innate", "known", "prepared"].includes(kind))
      .flatMap(([kind, byLevel]) =>
        Object.entries(isRecord(byLevel) ? byLevel : {})
          .filter(([key]) => !/^\d+$/.test(key) || Number(key) <= level)
          .flatMap(([, value]) => choosesIn(value).map((choose) => ({ ...choose, kind }))),
      );
    const total = (keep: (choose: (typeof chooses)[number]) => boolean) =>
      chooses.filter(keep).reduce((sum, choose) => sum + choose.count, 0);
    const known = (choose: (typeof chooses)[number]) => choose.kind === "known";
    return {
      cantrips: total(picksCantrip),
      spells: total((choose) => !picksCantrip(choose)),
      learned: total((choose) => !picksCantrip(choose) && known(choose)),
      either: total(picksEither),
      eitherLearned: total((choose) => picksEither(choose) && known(choose)),
    };
  });
  const largest = each.reduce(
    (best, block) => (block.cantrips + block.spells > best.cantrips + best.spells ? block : best),
    { cantrips: 0, spells: 0, learned: 0, either: 0, eitherLearned: 0 },
  );
  return { ...largest, alternatives: blocks.length > 1 };
}

/**
 * The picks a row's `additionalSpells` offers by `level`: the `choose` entries under each
 * level key at or below it, a key naming no level arriving with the row. An `expanded`
 * block only widens a list, so it offers none. A row offering several blocks offers them
 * as alternatives, as Magic Initiate offers six classes or an elf its lineages, so the
 * largest block counts and `alternatives` says the counts are a ceiling rather than owed.
 * Where `block` names one of them, that block's picks are owed. A
 * `choose` from a list of names reads as a spell unless every name is marked a cantrip.
 */
export function offeredPicks(json: unknown, level: number, block?: number): OfferedPicks {
  const { cantrips, spells, learned, alternatives } = largestBlock(json, level, block);
  return { cantrips, spells, learned, alternatives };
}

/**
 * How many of `offeredPicks`' `spells` a cantrip may fill instead, as `either`, and how many
 * of those a `known` key offers, as `learned`. A row offering alternative blocks reads its
 * largest block here, so read this only where `offeredPicks` reports no `alternatives`.
 */
export function eitherPicks(json: unknown, level: number) {
  const { either, eitherLearned } = largestBlock(json, level);
  return { either, learned: eitherLearned };
}
