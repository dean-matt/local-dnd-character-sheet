/**
 * A homebrew monster's `json`, in the 5etools bestiary entry shape that `monsterEntries`
 * renders. Only what the stat block cannot omit is required; every other field upstream
 * writes passes through untouched. A monster carries an edition because a 2024 stat block
 * reads it, and a catalog monster's name recurs across editions.
 */
import { EDITIONS } from "@dnd/rules";
import { z } from "zod";
import { isRecord } from "./entry-text.ts";

const SIZES = ["T", "S", "M", "L", "H", "G"] as const;

const score = z.number().int().min(1).max(30);
const armorClass = z.number().int().min(0);

/** Upstream writes a rating as a string, a fraction below 1. */
const rating = z.string().regex(/^(0|1\/[248]|[1-9]|[12]\d|30)$/, "A rating from 0 to 30");

/** A key a per-use spell list counts its uses with, as `2` or `2e`, whatever its count. */
const COUNTED = /^-?\d*e?$/;
const USES = /^[1-9]\d*e?$/;

/**
 * Refuses a per-use list counted below 1 or not at all. A list keyed in words, and a block
 * in any other shape, pass through as upstream may write them.
 */
const spellcasting = z.unknown().superRefine((blocks, ctx) => {
  if (!Array.isArray(blocks)) return;
  blocks.forEach((block, index) => {
    if (!isRecord(block)) return;
    for (const key of ["daily", "rest", "restLong", "charges"]) {
      const lists = block[key];
      if (!isRecord(lists)) continue;
      for (const uses of Object.keys(lists)) {
        if (COUNTED.test(uses) && !USES.test(uses)) {
          ctx.addIssue({ code: "custom", message: "Uses of 1 or more", path: [index, key, uses] });
        }
      }
    }
  });
});

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
  .extend({ edition: z.enum(EDITIONS), spellcasting: spellcasting.optional() });

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
