/**
 * The charges an item prints, read off its catalog or homebrew row: how many it holds, when
 * it recharges and how many come back. An item that prints a recharge and no charge count,
 * such as a Bag of Tricks, has none.
 */
import { z } from "zod";

const RECHARGES = ["dawn", "dusk", "midnight", "restLong", "special"] as const;

const rechargeSchema = z.enum(RECHARGES);

/** `all` where the row prints no amount or one this cannot read; a `roll` is dice notation such as `1d6 + 4`. */
const itemRegainsSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("all") }),
  z.strictObject({ kind: z.literal("fixed"), count: z.int().min(1) }),
  z.strictObject({ kind: z.literal("roll"), notation: z.string().min(1) }),
]);

export type ItemRegains = z.infer<typeof itemRegainsSchema>;

export const itemChargesSchema = z.strictObject({
  /** What the entry holds: the table's override where it set one, else `printedMax`. */
  max: z.int().min(1),
  printedMax: z.int().min(1),
  recharge: rechargeSchema.nullable(),
  regains: itemRegainsSchema,
});

export type ItemCharges = z.infer<typeof itemChargesSchema>;

const rowSchema = z.object({
  charges: z.int().min(1),
  recharge: rechargeSchema.optional().catch(undefined),
  rechargeAmount: z.union([z.int().min(1), z.string()]).optional(),
});

const DICE = /^\{@dice ([^{}]+)\}$/;

function regainsOf(amount: string | number | undefined): ItemRegains {
  if (typeof amount === "number") return { kind: "fixed", count: amount };
  const notation = amount && DICE.exec(amount.trim())?.[1];
  if (notation) return { kind: "roll", notation: notation.trim() };
  const count = Number(amount);
  return Number.isInteger(count) && count > 0 ? { kind: "fixed", count } : { kind: "all" };
}

/** Whether a rest from the sheet restores the item: every printed recharge but `special`, which has no rule to apply. */
export const rechargesOnLongRest = (recharge: ItemCharges["recharge"]): boolean =>
  recharge !== null && recharge !== "special";

/** The charges `row` prints, null where it prints none; `override` replaces the maximum. */
export function itemCharges(row: unknown, override?: number): ItemCharges | null {
  const parsed = rowSchema.safeParse(row).data;
  if (!parsed) return null;
  return {
    max: override ?? parsed.charges,
    printedMax: parsed.charges,
    recharge: parsed.recharge ?? null,
    regains: regainsOf(parsed.rechargeAmount),
  };
}
