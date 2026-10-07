import { z } from "zod";

/**
 * The skills a row lets the player pick and how many: `from` holds their names lowercased
 * as upstream writes them, or `null` where any skill will do, as `Bard` (PHB) takes any
 * three.
 */
export type SkillChoice = { from: string[] | null; count: number };

const offerSchema = z.union([
  z.looseObject({ any: z.int().min(1) }).transform(({ any }) => ({ from: null, count: any })),
  z
    .looseObject({
      choose: z.looseObject({ from: z.array(z.string()).min(1), count: z.int().min(1).optional() }),
    })
    .transform(({ choose }) => ({
      from: choose.from.map((name) => name.toLowerCase()),
      count: choose.count ?? 1,
    })),
]);

/**
 * The pick a `skillProficiencies`-shaped list offers. Upstream writes a list of
 * alternatives, and no class, race or background at the pinned tag offers more than one,
 * so only a one-element list offers a pick. A list offering none, or a malformed one, offers
 * nothing rather than refusing the row.
 */
const choiceSchema = z
  .array(z.unknown())
  .optional()
  .catch(undefined)
  .transform((alternatives): SkillChoice | undefined => {
    const [only, ...rest] = alternatives ?? [];
    return rest.length > 0 ? undefined : offerSchema.safeParse(only).data;
  });

/** The skills a class row lets a character who starts in it pick. */
export const classSkillChoiceSchema = z
  .looseObject({
    startingProficiencies: z.looseObject({ skills: choiceSchema }).optional().catch(undefined),
  })
  .transform((row) => row.startingProficiencies?.skills);

/**
 * The skills a race, subrace or background row lets the player pick, beside the ones it
 * grants outright.
 */
export const skillProficienciesChoiceSchema = z
  .looseObject({ skillProficiencies: choiceSchema })
  .transform((row) => row.skillProficiencies);
