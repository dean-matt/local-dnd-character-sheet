import { ABILITIES } from "@dnd/rules";
import { z } from "zod";

/**
 * A class row's `json` as a character who multiclasses into it starts the class:
 * `multiclassing.proficienciesGained` stands in for `startingProficiencies`, and the row
 * grants no saving throws. Parse the result with the class grant and choice schemas, which
 * read `startingProficiencies` in the same shape. `Wizard` (PHB) gains nothing, and
 * `Monk` (XPHB) carries an empty `multiclassing`.
 */
export const multiclassEntrySchema = z
  .looseObject({
    multiclassing: z
      .looseObject({ proficienciesGained: z.unknown().optional() })
      .optional()
      .catch(undefined),
  })
  .transform((row) => ({ startingProficiencies: row.multiclassing?.proficienciesGained ?? {} }));

type Ability = (typeof ABILITIES)[number];

/** Each ability a multiclass prerequisite names, with the score it needs. */
export type ScoreMinimums = Partial<Record<Ability, number>>;

const abilityKey = z.enum(ABILITIES);
const minimumsSchema = z.record(z.string(), z.unknown()).transform((row) =>
  Object.entries(row).flatMap(([key, value]): [Ability, unknown][] => {
    const ability = abilityKey.safeParse(key).data;
    return ability ? [[ability, value]] : [];
  }),
);

/** `{ str: 13, dex: 13 }` as one minimum per ability. */
const each = (pairs: [Ability, unknown][]): ScoreMinimums[] =>
  pairs.flatMap(([ability, value]) => (typeof value === "number" ? [{ [ability]: value }] : []));

const all = (pairs: [Ability, unknown][]): ScoreMinimums => Object.assign({}, ...each(pairs));

/**
 * The scores a class needs to multiclass in or out of, as alternatives: a character
 * qualifies through any one entry by meeting every minimum it holds, and an empty list
 * needs nothing. A `classic` row writes `multiclassing.requirements` — `{ str: 13, cha:
 * 13 }` for `Paladin` (PHB), `{ or: [{ str: 13, dex: 13 }] }` for `Fighter` (PHB), where
 * each key under `or` is an alternative. A `one` row writes none and needs 13 in its
 * `primaryAbility`, a list of alternatives: `[{ str: true }, { dex: true }]` for `Fighter`
 * (XPHB), `[{ dex: true, wis: true }]` for `Monk` (XPHB). A malformed field needs nothing
 * rather than refusing the row.
 */
export const multiclassPrerequisiteSchema = z
  .looseObject({
    multiclassing: z
      .looseObject({
        requirements: z
          .looseObject({ or: z.array(minimumsSchema).optional().catch(undefined) })
          .optional()
          .catch(undefined),
      })
      .optional()
      .catch(undefined),
    primaryAbility: z.array(minimumsSchema).optional().catch(undefined),
  })
  .transform((row): ScoreMinimums[] => {
    const requirements = row.multiclassing?.requirements;
    if (requirements) {
      const { or, ...rest } = requirements;
      const base = all(minimumsSchema.parse(rest));
      const options = (or ?? []).flatMap(each).map((option) => ({ ...base, ...option }));
      const result = options.length > 0 ? options : [base];
      return result.filter((option) => Object.keys(option).length > 0);
    }
    return (row.primaryAbility ?? [])
      .map((pairs) => all(pairs.map(([ability, value]) => [ability, value === true ? 13 : value])))
      .filter((option) => Object.keys(option).length > 0);
  });
