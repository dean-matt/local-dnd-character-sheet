/**
 * What the sheet records about a feature's mechanics, never its rules text: the mechanics
 * it applies, or that it has none. A feature absent from the records is a gap, not a
 * narrative one. A kind joins the vocabulary the day something applies it.
 */
import { SENSES } from "@dnd/rules";
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

/**
 * An unarmored base of 10 plus `value`, a flat number or an ability's modifier, which a shield
 * ends only where `unlessShield` says so.
 */
const unarmoredBaseMechanicSchema = z.strictObject({
  kind: z.literal("unarmoredBase"),
  value: z.union([z.int().min(1), abilitySchema]),
  unlessShield: z.literal(true).optional(),
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

/**
 * A pick the player makes: `count` names, each landing in one of `fields`, from `from` where it
 * names them and from the field's own pool where it does not. A tool pick restricted to
 * `types` takes only those kinds. `expertise` doubles the proficiency of each skill picked, as
 * the Knowledge domain does. The picks live on the character's `featureChoices`.
 */
const pickMechanicSchema = z
  .strictObject({
    kind: z.literal("pick"),
    fields: z.array(z.enum(["skills", "expertise", "tools", "languages"])).min(1),
    count: z.int().min(1),
    from: names,
    types: z
      .array(z.enum(["artisan", "instrument", "gaming", "other"]))
      .min(1)
      .optional(),
    expertise: z.literal(true).optional(),
  })
  .refine((pick) => !pick.expertise || (pick.fields.length === 1 && pick.fields[0] === "skills"), {
    error: "only a pick of skills can carry expertise",
  })
  .refine((pick) => !pick.types || pick.fields.includes("tools"), {
    error: "only a pick of tools names tool types",
  });

/** Half the proficiency bonus on `abilities` checks that do not already use proficiency, rounded as the feature says. */
const halfProficiencyMechanicSchema = z.strictObject({
  kind: z.literal("halfProficiency"),
  abilities: z.array(abilitySchema).min(1),
  rounding: z.enum(["down", "up"]),
});

/** A sense out to `range` feet; `raceBonus` instead lengthens the same sense the race gives, where it gives one. */
const senseMechanicSchema = z.strictObject({
  kind: z.literal("sense"),
  name: z.enum(SENSES),
  range: z.int().min(1),
  raceBonus: z.int().min(1).optional(),
});

/**
 * Resistances, damage immunities and condition immunities a feature grants, each lowercased as
 * upstream writes it. `while: "raging"` holds them only during a rage.
 */
const defenseMechanicSchema = z
  .strictObject({
    kind: z.literal("defense"),
    resist: names,
    immune: names,
    conditionImmune: names,
    while: z.literal("raging").optional(),
  })
  .refine((grant) => [grant.resist, grant.immune, grant.conditionImmune].some(Boolean), {
    error: "a defense mechanic grants something",
  });

const SPEED_MODES = z
  .array(z.enum(["climb", "swim"]))
  .min(1)
  .optional();

/**
 * The walking speed raised by `bonus` feet, named `label` where the feature's own name is not
 * what the table calls it. `unlessHeavyArmor` withholds it while heavy armor is worn, and
 * `whileArmored` while no armor is. `alsoOn` gives the same increase to those speeds where the
 * character already has them; `equalToWalk` gives the character those speeds at the final
 * walking speed, after every later bonus, where it has less.
 */
const speedMechanicSchema = z.strictObject({
  kind: z.literal("speed"),
  bonus: z.int().min(1),
  unlessHeavyArmor: z.literal(true).optional(),
  whileArmored: z.literal(true).optional(),
  alsoOn: SPEED_MODES,
  equalToWalk: SPEED_MODES,
  label: z.string().min(1).optional(),
});

/**
 * Advantage, or a bonus, on saving throws, ability checks, initiative or death saves: of the
 * `abilities` named, or of every one, and for a check of the `skills` named alone. A bonus is
 * a number, an ability's modifier of at least +1, or the levels in the feature's class, and
 * falls on saves or named skills. `against` says when it holds, and the roll offers it rather
 * than applying it; `while: "raging"` holds it only during a rage.
 */
const rollMechanicSchema = z
  .strictObject({
    kind: z.literal("roll"),
    roll: z.enum(["save", "check", "initiative", "deathSave"]),
    abilities: z.array(abilitySchema).min(1).optional(),
    skills: names,
    advantage: z.literal(true).optional(),
    bonus: z.union([z.int().min(1), abilitySchema, z.literal("level")]).optional(),
    against: z.string().min(1).optional(),
    while: z.literal("raging").optional(),
  })
  .refine(({ advantage, bonus }) => (advantage === undefined) !== (bonus === undefined), {
    error: "a roll mechanic gives advantage or a bonus, never both or neither",
  })
  .refine(
    ({ roll, skills, abilities }) =>
      (!skills || roll === "check") && (!abilities || roll === "save" || roll === "check"),
    { error: "only a check names skills, and only a save or check names abilities" },
  )
  .refine(({ bonus, roll, skills }) => bonus === undefined || roll === "save" || skills, {
    error: "a bonus falls on saves or on named skills",
  });

const mechanicSchema = z.union([
  rollMechanicSchema,
  speedMechanicSchema,
  defenseMechanicSchema,
  senseMechanicSchema,
  proficiencyMechanicSchema,
  pickMechanicSchema,
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

/** The picks a feature's mechanics ask the player for, in the shape `allocatePicks` reads. */
export const featureOffers = (
  entry: FeatureMechanics,
): (Omit<Extract<Mechanic, { kind: "pick" }>, "kind" | "from"> & { from: string[] | null })[] =>
  mechanicsOfKind(entry, "pick").map(({ fields, count, from, types, expertise }) => ({
    fields,
    count,
    from: from ?? null,
    ...(types && { types }),
    ...(expertise && { expertise }),
  }));

/** A class or subclass feature carries its whole key; a feat, race trait or the like, its `(name, source)`. */
const featureRefSchema = z.union([featureKeySchema, contentRefSchema]);

export const featureMechanicsSchema = z
  .strictObject({
    ref: featureRefSchema,
    /** The feature whose choice of options this is one of; held only where the character took it. */
    offeredBy: featureKeySchema.optional(),
    /** The house rule a table turns on for the feature to apply; absent, the rule as printed. */
    houseRule: z.literal("optionalClassFeatures").optional(),
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
