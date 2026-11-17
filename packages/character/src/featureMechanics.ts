/**
 * What the sheet records about a feature's mechanics, never its rules text: the mechanics
 * it applies, or that it has none. A feature absent from the records is a gap, not a
 * narrative one. A kind joins the vocabulary the day something applies it.
 */
import { z } from "zod";
import { featureKey, refKey } from "./keys.ts";
import { abilitySchema, contentRefSchema, featureKeySchema } from "./refs.ts";

const bonusMechanicSchema = z.strictObject({
  kind: z.literal("bonus"),
  target: z.enum(["initiative", "hitPointsPerLevel", "walk"]),
  value: z.union([z.number(), z.literal("proficiency")]),
});

const bonusKindSchema = bonusMechanicSchema.refine(
  ({ target, value }) => value !== "proficiency" || target === "initiative",
  { error: "only an initiative bonus can be the proficiency bonus" },
);

/** Armor class added while `when` holds: any armor worn, heavy armor worn, or a melee weapon in each hand. */
const armorClassMechanicSchema = z.strictObject({
  kind: z.literal("armorClass"),
  value: z.int().min(1),
  when: z.enum(["armor", "heavyArmor", "dualWield"]),
});

/** An unarmored base of 10 plus `value`, which a shield does not end. */
const unarmoredBaseMechanicSchema = z.strictObject({
  kind: z.literal("unarmoredBase"),
  value: z.int().min(1),
});

/** Medium armor admits `cap` of Dexterity, at a Dexterity score of `minimum` or more. */
const mediumArmorDexterityMechanicSchema = z.strictObject({
  kind: z.literal("mediumArmorDexterity"),
  cap: z.int().min(0),
  minimum: z.int().min(1),
});

const names = z.array(z.string().min(1)).min(1).optional();

/**
 * Proficiencies a feature grants outright, each name lowercased as upstream writes it: a
 * saving throw by ability, a skill, expertise in a skill the feature also grants or the
 * character holds, a tool, an armor or weapon category or kind. A choice the player makes is
 * not recorded here.
 */
const proficiencyMechanicSchema = z
  .strictObject({
    kind: z.literal("proficiency"),
    savingThrows: z.array(abilitySchema).min(1).optional(),
    skills: names,
    expertise: names,
    tools: names,
    armor: names,
    weapons: names,
  })
  .refine(
    (grant) => Object.entries(grant).some(([key, list]) => key !== "kind" && list !== undefined),
    {
      error: "a proficiency mechanic grants something",
    },
  );

/** Half the proficiency bonus on `abilities` checks that do not already use proficiency, rounded as the feature says. */
const halfProficiencyMechanicSchema = z.strictObject({
  kind: z.literal("halfProficiency"),
  abilities: z.array(abilitySchema).min(1),
  rounding: z.enum(["down", "up"]),
});

const mechanicSchema = z.union([
  proficiencyMechanicSchema,
  halfProficiencyMechanicSchema,
  bonusKindSchema,
  armorClassMechanicSchema,
  unarmoredBaseMechanicSchema,
  mediumArmorDexterityMechanicSchema,
]);

export type Mechanic = z.infer<typeof mechanicSchema>;

/** The mechanics of one kind a feature records. */
export const mechanicsOfKind = <K extends Mechanic["kind"]>(
  entry: FeatureMechanics,
  kind: K,
): Extract<Mechanic, { kind: K }>[] =>
  (entry.mechanics ?? []).filter((m): m is Extract<Mechanic, { kind: K }> => m.kind === kind);

/** A class or subclass feature carries its whole key; a feat, race trait or the like, its `(name, source)`. */
const featureRefSchema = z.union([featureKeySchema, contentRefSchema]);

export const featureMechanicsSchema = z
  .strictObject({
    ref: featureRefSchema,
    mechanics: z
      .array(mechanicSchema)
      .min(1)
      .refine(
        (all) => {
          const targets = all.flatMap((m) => (m.kind === "bonus" ? [m.target] : []));
          return new Set(targets).size === targets.length;
        },
        { error: "a feature bonuses each target once" },
      )
      .optional(),
    narrative: z.literal(true).optional(),
  })
  .refine((entry) => (entry.mechanics === undefined) !== (entry.narrative === undefined), {
    error: "a feature records its mechanics or the narrative mark, never both or neither",
  });

export type FeatureMechanics = z.infer<typeof featureMechanicsSchema>;

export const featureMechanicsKey = ({ ref }: FeatureMechanics): string =>
  "className" in ref ? featureKey(ref) : refKey(ref);
