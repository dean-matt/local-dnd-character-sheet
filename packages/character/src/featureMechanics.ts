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

/**
 * A change to the character's own weapon attacks, unarmed strikes included: `attack` and
 * `damage` added to the rolls, a critical hit on `critical` or more, or advantage on the
 * attacks using `ability`, or on all of them. `weapons` narrows a bonus to ranged weapons,
 * heavy melee weapons, or a melee weapon held in one hand with no other weapon equipped, and
 * `proficient` to a weapon the character is proficient with. `option` says when it holds,
 * and the attack offers it rather than applying it.
 */
const attackMechanicSchema = z
  .strictObject({
    kind: z.literal("attack"),
    weapons: z.enum(["ranged", "heavyMelee", "oneHandedMelee"]).optional(),
    proficient: z.literal(true).optional(),
    attack: z.int().optional(),
    damage: z.int().optional(),
    critical: z.int().min(2).max(19).optional(),
    advantage: z.literal(true).optional(),
    ability: abilitySchema.optional(),
    option: z.string().min(1).optional(),
  })
  .refine(
    ({ attack, damage, critical, advantage }) =>
      [attack !== undefined || damage !== undefined, critical, advantage].filter(Boolean).length ===
      1,
    { error: "an attack mechanic gives a bonus, a critical range or advantage, one of them" },
  )
  .refine(({ advantage, ability }) => !ability || advantage, {
    error: "only advantage names the ability its attacks use",
  })
  .refine(({ advantage, weapons, proficient }) => !advantage || (!weapons && !proficient), {
    error: "advantage falls on attacks by ability, never by weapon",
  })
  .refine(({ critical, option }) => critical === undefined || option === undefined, {
    error: "a critical range always holds",
  });

const diceSchema = z.string().regex(/^\d+d\d+$/);

const flatSchema = z.union([abilitySchema, z.enum(["proficiency", "halfLevel"])]);

/**
 * Damage a feature adds to the character's own weapon attacks on a hit: `dice` as notation, a
 * class table column's cell, or as many `die`-sided dice as that cell's number; or a flat
 * amount, an ability's modifier of at least 1, the proficiency bonus, or half the levels in
 * the feature's class. `plus` adds a flat amount to the dice, an ability's modifier as it
 * stands. `scales` replaces the dice from a level in the feature's class. `type` is the
 * damage's, the weapon's own where absent. `weapons` narrows it to melee weapons, ranged
 * ones, finesse and ranged ones, or the unarmed strike alone, and `unarmed` adds the unarmed
 * strike. `option` says when it holds, and the attack offers it rather than adding it: once a
 * turn where `oncePerTurn` says so, and for a spell slot where `slot` does, a pact slot alone
 * where `pact` says so, a die more for each slot level past the first up to `max` dice, and
 * one more `versus` the creatures it names. `while: "raging"` holds it only during a rage.
 */
const extraDamageMechanicSchema = z
  .strictObject({
    kind: z.literal("extraDamage"),
    dice: z.union([
      diceSchema,
      z.strictObject({ column: z.string().min(1), die: z.int().min(2).optional() }),
      flatSchema,
    ]),
    plus: z.union([abilitySchema, z.literal("halfLevel")]).optional(),
    scales: z
      .array(z.strictObject({ level: z.int().min(2).max(20), dice: diceSchema }))
      .min(1)
      .optional(),
    type: z.string().min(1).optional(),
    weapons: z.enum(["melee", "ranged", "finesseOrRanged", "unarmed"]).optional(),
    unarmed: z.literal(true).optional(),
    option: z.string().min(1).optional(),
    oncePerTurn: z.literal(true).optional(),
    slot: z
      .strictObject({
        max: z.int().min(2),
        versus: z.string().min(1).optional(),
        pact: z.literal(true).optional(),
      })
      .optional(),
    while: z.literal("raging").optional(),
  })
  .refine(({ option, oncePerTurn, slot }) => option || (!oncePerTurn && !slot), {
    error: "extra damage the attack offers says when it holds",
  })
  .refine(({ slot, dice }) => !slot || diceSchema.safeParse(dice).success, {
    error: "a slot adds dice to notation",
  })
  .refine(({ plus, dice }) => !plus || !flatSchema.safeParse(dice).success, {
    error: "a flat amount is added to dice",
  });

/**
 * A Monk's Martial Arts, on the unarmed strike and on the `classic` or `one` edition's monk
 * weapons, while no armor or shield is worn and every equipped weapon is a monk weapon: `die`
 * names the class table column whose die replaces a smaller one, and `dexterity` lets the
 * attack use Dexterity.
 */
const martialArtsMechanicSchema = z
  .strictObject({
    kind: z.literal("martialArts"),
    monkWeapons: z.enum(["classic", "one"]),
    die: z.string().min(1).optional(),
    dexterity: z.literal(true).optional(),
  })
  .refine(({ die, dexterity }) => die !== undefined || dexterity !== undefined, {
    error: "a martial arts mechanic gives a die or Dexterity",
  });

const restoreTermSchema = z.union([
  z.int().min(1),
  abilitySchema,
  z.enum(["level", "proficiency", "halfMaximum"]),
]);

/**
 * What a use of the feature restores: `dice` rolled, as notation or a class table column's
 * die, plus each of `bonus`, a number, an ability's modifier, the levels in the feature's
 * class, the proficiency bonus or half the hit point maximum, the bonus `times` over.
 * `scales` replaces the dice, or a bonus of one number, from a level in the feature's class.
 * On `others`, it lands on another creature, so the sheet restores no one.
 */
const restoreFields = {
  dice: z.union([diceSchema, z.strictObject({ column: z.string().min(1) })]).optional(),
  bonus: z.array(restoreTermSchema).min(1).optional(),
  times: z.int().min(2).optional(),
  scales: z
    .array(
      z.strictObject({
        level: z.int().min(2).max(20),
        dice: diceSchema.optional(),
        bonus: z.int().min(1).optional(),
      }),
    )
    .min(1)
    .optional(),
  others: z.literal(true).optional(),
};

type RestoreFields = z.infer<z.ZodObject<typeof restoreFields>>;

const restoreRefinements = <T extends z.ZodType<RestoreFields>>(schema: T) =>
  schema
    .refine(({ dice, bonus }) => dice !== undefined || bonus !== undefined, {
      error: "a feature restores dice, a bonus or both",
    })
    .refine(({ times, bonus }) => times === undefined || bonus !== undefined, {
      error: "only a bonus is multiplied",
    })
    .refine(
      ({ scales = [], dice, bonus }) =>
        scales.every(
          (scale) =>
            (scale.dice === undefined) !== (scale.bonus === undefined) &&
            (scale.dice === undefined || typeof dice === "string") &&
            (scale.bonus === undefined || (bonus?.length === 1 && typeof bonus[0] === "number")),
        ),
      { error: "a scale replaces notation dice or a bonus of one number, one of them" },
    );

/** Hit points a use of the feature restores. */
const healMechanicSchema = restoreRefinements(
  z.strictObject({ kind: z.literal("heal"), ...restoreFields }),
);

/** Temporary hit points a use of the feature gives. */
const tempHpMechanicSchema = restoreRefinements(
  z.strictObject({ kind: z.literal("tempHp"), ...restoreFields }),
);

const resetSchema = z.enum(["short", "long"]);

/**
 * The uses a feature counts, restored by a `reset` rest, where `short` means either rest:
 * `count`, a number or an ability's modifier, plus `plus`, at least `minimum`. Absent,
 * `minimum` is 1, as a feature printing "a minimum of once" has it; 0 records a feature that
 * prints none. Each of `scales` replaces a number count, the reset or both from a level in
 * the feature's class.
 */
const usesMechanicSchema = z
  .strictObject({
    kind: z.literal("uses"),
    count: z.union([z.int().min(1), abilitySchema]),
    plus: z.int().min(1).optional(),
    minimum: z.literal(0).optional(),
    reset: resetSchema,
    scales: z
      .array(
        z
          .strictObject({
            level: z.int().min(2).max(20),
            count: z.int().min(1).optional(),
            reset: resetSchema.optional(),
          })
          .refine((scale) => scale.count !== undefined || scale.reset !== undefined, {
            error: "a scale replaces the count, the reset or both",
          }),
      )
      .min(1)
      .optional(),
  })
  .refine(
    ({ count, scales = [] }) =>
      typeof count === "number" || scales.every((scale) => scale.count === undefined),
    { error: "a scale replaces only a number count" },
  );

const mechanicSchema = z.union([
  usesMechanicSchema,
  healMechanicSchema,
  tempHpMechanicSchema,
  extraDamageMechanicSchema,
  martialArtsMechanicSchema,
  attackMechanicSchema,
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
      .refine((all) => all.filter((m) => m.kind === "uses").length <= 1, {
        error: "a feature counts its uses once",
      })
      .optional(),
    narrative: z.literal(true).optional(),
  })
  .refine((entry) => (entry.mechanics === undefined) !== (entry.narrative === undefined), {
    error: "a feature records its mechanics or the narrative mark, never both or neither",
  });

export type FeatureMechanics = z.infer<typeof featureMechanicsSchema>;

export const featureMechanicsKey = ({ ref }: FeatureMechanics): string =>
  "className" in ref ? featureKey(ref) : refKey(ref);
