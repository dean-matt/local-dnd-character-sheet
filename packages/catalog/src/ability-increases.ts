import { ABILITIES } from "@dnd/rules";
import { z } from "zod";

type Ability = (typeof ABILITIES)[number];

/** One increase the player places: `amount` to an ability from `from`, distinct from the other slots. */
type IncreaseSlot = { from: readonly Ability[]; amount: number };

/** One way to take a row's increases: some fixed, the rest placed by the player. */
export type IncreaseAlternative = {
  fixed: Partial<Record<Ability, number>>;
  slots: IncreaseSlot[];
};

const abilitySchema = z.enum(ABILITIES);

const chooseSchema = z.union([
  z.strictObject({
    from: z.array(abilitySchema).min(1),
    count: z.int().min(1).optional(),
    amount: z.int().optional(),
  }),
  z.strictObject({
    weighted: z.strictObject({
      from: z.array(abilitySchema).min(1),
      weights: z.array(z.int()).min(1),
    }),
  }),
]);

const alternativeSchema = z
  .looseObject({ choose: chooseSchema.optional() })
  .transform(({ choose, ...rest }): IncreaseAlternative => {
    const fixed = Object.fromEntries(
      Object.entries(rest).filter(
        (entry): entry is [Ability, number] =>
          abilitySchema.safeParse(entry[0]).success && typeof entry[1] === "number",
      ),
    );
    if (choose === undefined) return { fixed, slots: [] };
    if ("weighted" in choose) {
      const { from, weights } = choose.weighted;
      return { fixed, slots: weights.map((amount) => ({ from, amount })) };
    }
    const slot = { from: choose.from, amount: choose.amount ?? 1 };
    return { fixed, slots: Array.from({ length: choose.count ?? 1 }, () => slot) };
  });

/**
 * Tasha's custom origin, which upstream marks with `lineage` rather than spelling out:
 * +2 to one ability and +1 to another, or +1 to three.
 */
const LINEAGE: IncreaseAlternative[] = [
  { fixed: {}, slots: [2, 1].map((amount) => ({ from: ABILITIES, amount })) },
  { fixed: {}, slots: [1, 1, 1].map((amount) => ({ from: ABILITIES, amount })) },
];

/**
 * The ways a race, merged subrace or background row offers to raise ability scores — one
 * alternative where the row has one, none where it grants no increase. A 2024 background
 * offers two, +2 and +1 or +1 to three, and a 2024 race none. A malformed `ability` offers
 * nothing rather than refusing the row.
 */
export const abilityIncreasesSchema = z
  .looseObject({
    ability: z.array(alternativeSchema).optional().catch(undefined),
    lineage: z.unknown().optional(),
  })
  .transform(({ ability, lineage }) => ability ?? (lineage ? LINEAGE : []));

/**
 * `alternatives` under Tasha's custom origin: each increase keeps its amount, fixed ones
 * included, and goes to any ability the player picks. The rule moves increases alone, so
 * a printed decrease stays fixed where the race puts it.
 */
export const customOrigin = (alternatives: readonly IncreaseAlternative[]): IncreaseAlternative[] =>
  alternatives.map((alternative) => {
    const fixed = Object.entries(alternative.fixed) as [Ability, number][];
    return {
      fixed: Object.fromEntries(fixed.filter(([, amount]) => amount < 0)),
      slots: [
        ...fixed
          .filter(([, amount]) => amount > 0)
          .map(([, amount]) => ({ from: ABILITIES, amount })),
        ...alternative.slots.map((slot) => ({ from: ABILITIES, amount: slot.amount })),
      ],
    };
  });
