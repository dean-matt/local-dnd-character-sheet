/**
 * A homebrew monster's `json`, in the 5etools bestiary entry shape that `monsterEntries`
 * renders. Only what the stat block cannot omit is required; every other field upstream
 * writes passes through untouched. A monster carries an edition because a 2024 stat block
 * reads it, and a catalog monster's name recurs across editions.
 */
import { EDITIONS } from "@dnd/rules";
import { z } from "zod";

const SIZES = ["T", "S", "M", "L", "H", "G"] as const;

const score = z.number().int().min(1).max(30);
const armorClass = z.number().int().min(0);

/** Upstream writes a rating as a string, a fraction below 1. */
const rating = z.string().regex(/^(0|1\/[248]|[1-9]|[12]\d|30)$/, "A rating from 0 to 30");

export const homebrewMonsterEntrySchema = z.looseObject({
  name: z.string().min(1),
  source: z.string().min(1),
  size: z.array(z.enum(SIZES)).min(1),
  type: z.union([z.string().min(1), z.looseObject({ type: z.unknown() })]),
  ac: z
    .array(
      z.union([
        armorClass,
        z.looseObject({ ac: armorClass }),
        z.looseObject({ special: z.string().min(1) }),
      ]),
    )
    .min(1),
  hp: z.union([
    z.looseObject({ average: z.number().int().min(0) }),
    z.looseObject({ special: z.string().min(1) }),
  ]),
  speed: z.looseObject({}).refine((speed) => Object.keys(speed).length > 0, "A speed"),
  str: score,
  dex: score,
  con: score,
  int: score,
  wis: score,
  cha: score,
  cr: z.union([rating, z.looseObject({ cr: rating })]),
  legendaryActions: z.number().int().min(1, "At least 1").optional(),
});

export type HomebrewMonster = z.infer<typeof homebrewMonsterEntrySchema>;

/** What a caller submits to create or replace a homebrew monster; the server stamps `source`. */
export const homebrewMonsterInputSchema = homebrewMonsterEntrySchema
  .omit({ source: true })
  .extend({ edition: z.enum(EDITIONS) });

export type HomebrewMonsterInput = z.infer<typeof homebrewMonsterInputSchema>;

/** A stored homebrew monster, as an endpoint returns it. */
export const homebrewMonsterRecordSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  edition: z.enum(EDITIONS),
  json: homebrewMonsterEntrySchema,
  createdAt: z.iso.datetime(),
});

export type HomebrewMonsterRecord = z.infer<typeof homebrewMonsterRecordSchema>;
