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

/** What ends an effect early: falling incapacitated, or donning armor of a category. */
export const effectEndSchema = z.enum(["incapacitated", "medium", "heavy", "shield"]);
export type EffectEnd = z.infer<typeof effectEndSchema>;

/**
 * A feature's effect the player starts and ends from its card, spending what a use of the
 * feature spends. Its mechanics marked `while: "active"` hold only while it runs. `endsOn`
 * names what ends it early; an armor category it names also refuses the start while worn.
 */
const activeMechanicSchema = z.strictObject({
  kind: z.literal("active"),
  endsOn: z.array(effectEndSchema).min(1).optional(),
});

/** Held only while the feature's effect runs, or only during a rage. */
const whileSchema = z.enum(["active", "raging"]).optional();
const whileActive = z.literal("active").optional();

/** Keeps a mechanic of a trait shared across races to those it names, keyed as the entry's `races`. */
const sharedRaces = z.array(z.string().min(1)).min(1).optional();

/**
 * Armor class added, a number or an ability's modifier of at least +1, while `when` holds:
 * any armor worn, heavy armor worn, or a melee weapon in each hand; always where absent.
 */
const armorClassMechanicSchema = z.strictObject({
  kind: z.literal("armorClass"),
  value: z.union([z.int().min(1), abilitySchema]),
  when: z.enum(["armor", "heavyArmor", "dualWield"]).optional(),
  while: whileActive,
  races: sharedRaces,
});

/**
 * An unarmored base of 10 plus `value`, a flat number or an ability's modifier, which a shield
 * ends only where `unlessShield` says so. `plus` raises an ability's modifier by a flat number. `fixed` leaves Dexterity out of the Armor Class, and
 * `races` keeps it to those of a shared trait's races that name it, keyed as the entry's.
 */
const unarmoredBaseMechanicSchema = z.strictObject({
  kind: z.literal("unarmoredBase"),
  value: z.union([z.int().min(1), abilitySchema]),
  unlessShield: z.literal(true).optional(),
  plus: z.int().min(1).optional(),
  fixed: z.literal(true).optional(),
  races: sharedRaces,
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
    races: sharedRaces,
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

/** Resistances, damage immunities and condition immunities a feature grants, each lowercased as upstream writes it. */
const defenseMechanicSchema = z
  .strictObject({
    kind: z.literal("defense"),
    resist: names,
    immune: names,
    conditionImmune: names,
    while: whileSchema,
  })
  .refine((grant) => [grant.resist, grant.immune, grant.conditionImmune].some(Boolean), {
    error: "a defense mechanic grants something",
  });

const SPEED_MODES = z
  .array(z.enum(["climb", "swim", "fly"]))
  .min(1)
  .optional();

/**
 * The walking speed raised by `bonus` feet, named `label` where the feature's own name is not
 * what the table calls it. `unlessHeavyArmor` withholds it while heavy armor is worn, and
 * `whileArmored` while no armor is. `alsoOn` gives the same increase to those speeds where the
 * character already has them; `equalToWalk` gives the character those speeds at the final
 * walking speed, after every later bonus, where it has less, and `fly` a flying speed of that
 * many feet where it has less.
 */
const speedMechanicSchema = z
  .strictObject({
    kind: z.literal("speed"),
    bonus: z.int().min(1).optional(),
    unlessHeavyArmor: z.literal(true).optional(),
    whileArmored: z.literal(true).optional(),
    alsoOn: SPEED_MODES,
    equalToWalk: SPEED_MODES,
    fly: z.int().min(1).optional(),
    label: z.string().min(1).optional(),
    while: whileActive,
  })
  .refine(({ bonus, equalToWalk, fly }) => bonus !== undefined || equalToWalk || fly, {
    error: "a speed mechanic raises a speed",
  })
  .refine(({ bonus, alsoOn }) => bonus !== undefined || !alsoOn, {
    error: "only a bonus falls on other speeds",
  });

/**
 * Advantage, or a bonus, on saving throws, ability checks, initiative or death saves: of the
 * `abilities` named, or of every one, and for a check of the `skills` named alone. A bonus is
 * a number, an ability's modifier of at least +1, or the levels in the feature's class, and
 * falls on saves or named skills. `against` says when it holds, and the roll offers it rather
 * than applying it. `races` keeps it to those of a shared trait's races that name it.
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
    while: whileSchema,
    races: sharedRaces,
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

const diceSchema = z.string().regex(/^\d+d\d+$/);

const scalesSchema = z
  .array(z.strictObject({ level: z.int().min(2).max(20), dice: diceSchema }))
  .min(1);

/**
 * A change to the character's own weapon attacks, unarmed strikes included: `attack` and
 * `damage` added to the rolls, `attack` a number or an ability's modifier of at least +1, a
 * critical hit on `critical` or more, or advantage on the attacks using `ability`, or on all
 * of them. `weapons` narrows a bonus or a critical range to any weapon; to melee, ranged,
 * thrown or heavy melee weapons; or to a melee weapon held in one hand with no other weapon
 * equipped. Every `weapons` value leaves out the unarmed strike, and `unarmed` adds it back.
 * `proficient` narrows it to a weapon the character is proficient with. `option` says when it
 * holds, and the attack offers it rather than applying it. `dice` adds a die to the attack
 * roll instead, `scales` replacing it from a level in the feature's class, and `afterRoll`
 * has the player add a die or an `attack` number once the roll shows a miss; both are offered.
 * A die with `oncePerTurn` is spent by the roll that takes it; one without lasts until unticked.
 */
const attackMechanicSchema = z
  .strictObject({
    kind: z.literal("attack"),
    weapons: z
      .enum(["any", "melee", "ranged", "thrown", "heavyMelee", "oneHandedMelee"])
      .optional(),
    unarmed: z.literal(true).optional(),
    proficient: z.literal(true).optional(),
    attack: z.union([z.int(), abilitySchema]).optional(),
    damage: z.int().optional(),
    critical: z.int().min(2).max(19).optional(),
    advantage: z.literal(true).optional(),
    ability: abilitySchema.optional(),
    dice: diceSchema.optional(),
    scales: scalesSchema.optional(),
    afterRoll: z.literal(true).optional(),
    oncePerTurn: z.literal(true).optional(),
    option: z.string().min(1).optional(),
    while: whileActive,
  })
  .refine(
    ({ attack, damage, critical, advantage, dice }) =>
      [attack !== undefined || damage !== undefined, critical, advantage, dice].filter(Boolean)
        .length === 1,
    {
      error: "an attack mechanic gives a bonus, a critical range, advantage or a die, one of them",
    },
  )
  .refine(({ dice, scales }) => dice !== undefined || !scales, {
    error: "only a die scales",
  })
  .refine(
    ({ dice, afterRoll, attack, damage, option }) =>
      (dice === undefined && !afterRoll) ||
      (option !== undefined && (dice !== undefined || (typeof attack === "number" && !damage))),
    { error: "a die or a bonus after the roll is offered, and the bonus is a number" },
  )
  .refine(({ advantage, ability }) => !ability || advantage, {
    error: "only advantage names the ability its attacks use",
  })
  .refine(({ advantage, weapons, proficient }) => !advantage || (!weapons && !proficient), {
    error: "advantage falls on attacks by ability, never by weapon",
  })
  .refine(({ unarmed, weapons }) => !unarmed || weapons, {
    error: "the unarmed strike is added back to a narrowed set of weapons",
  });

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
 * one more `versus` the creatures it names.
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
    scales: scalesSchema.optional(),
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
    while: whileSchema,
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

export const dieSizeSchema = z.union([
  z.literal(4),
  z.literal(6),
  z.literal(8),
  z.literal(10),
  z.literal(12),
]);

const poolKeySchema = z.string().regex(/^[a-z]+(?:_[a-z]+)*$/);

const restoreTermSchema = z.union([
  z.int().min(1),
  abilitySchema,
  z.enum(["level", "proficiency", "halfMaximum"]),
]);

/**
 * What a use of the feature restores: `dice` rolled, as notation or a class table column's
 * die, plus each of `bonus`, a number, an ability's modifier, the levels in the feature's
 * class, the proficiency bonus or half the hit point maximum, the bonus `times` over.
 * `scales` replaces the dice, or a bonus of one number, from a level in the feature's class,
 * and `levelsIn` counts the levels of another class for a feature that knows only the
 * character's total level. `dice` may be the size of the dice the class pool keyed `pool`
 * holds, `die` where the character holds none. On `others`, it lands on another creature, so
 * the sheet restores no one. A `per` amount lands once for each level of the spell slot the
 * player expends, or each creature that accepts, at most `most`'s modifier and at least one.
 * `on` names the event a feature waits on instead of a use: `zeroHp`, a creature reduced to 0
 * hit points, which the player says happened by applying the effect from the feature's card.
 */
const restoreFields = {
  dice: z
    .union([
      diceSchema,
      z.strictObject({ column: z.string().min(1) }),
      z.strictObject({ pool: poolKeySchema, die: dieSizeSchema }),
    ])
    .optional(),
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
  levelsIn: contentRefSchema.optional(),
  others: z.literal(true).optional(),
  per: z.enum(["slotLevel", "creature"]).optional(),
  most: abilitySchema.optional(),
  on: z.literal("zeroHp").optional(),
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
    )
    .refine(
      ({ per, dice }) => per === undefined || dice === undefined || typeof dice === "string",
      {
        error: "an amount per choice is notation dice or a bonus",
      },
    )
    .refine(({ most, per }) => most === undefined || per === "creature", {
      error: "only an amount per creature is limited by an ability",
    });

/** Hit points a use of the feature restores. */
const healMechanicSchema = restoreRefinements(
  z.strictObject({ kind: z.literal("heal"), ...restoreFields }),
);

/** Temporary hit points a use of the feature gives. */
const tempHpMechanicSchema = restoreRefinements(
  z.strictObject({ kind: z.literal("tempHp"), ...restoreFields }),
);

const resetSchema = z.enum(["short", "long", "manual"]);

/** What besides a rest restores a feature's uses; the sheet says so and the player restores them. */
export const USES_RESTORED_BY = ["initiative", "soulTrinket"] as const;

/** The count a feature keeps beside its main one, when it limits two things apart. */
export const USES_PARTS = ["conjuring", "recovery", "infusion"] as const;

/**
 * The uses a feature counts, restored by a `reset` rest, where `short` means either rest and
 * `manual` no rest, only the player's word: `count`, a number, an ability's modifier or the
 * proficiency bonus, `times` over, plus `plus`, at least `minimum`. Absent, `minimum` is 1, as a
 * feature printing "a minimum of once" has it; 0 records a feature that prints none, 2 one that
 * prints "a minimum of twice". Each of `scales` replaces a number count, the reset or both from a
 * level in the feature's class, or in `levelsIn` for a feature that knows only the character's
 * total level, such as an optional feature. `restoredBy` names what else restores them: rolling
 * initiative with none left restores them on the sheet, any other is the player's to restore. A
 * `part` is a second count of the feature, apart from its main one.
 */
const usesMechanicSchema = z
  .strictObject({
    kind: z.literal("uses"),
    count: z.union([z.int().min(1), abilitySchema, z.literal("proficiency")]),
    times: z.int().min(2).optional(),
    plus: z.int().min(1).optional(),
    minimum: z.union([z.literal(0), z.literal(2)]).optional(),
    reset: resetSchema,
    restoredBy: z.enum(USES_RESTORED_BY).optional(),
    part: z.enum(USES_PARTS).optional(),
    levelsIn: contentRefSchema.optional(),
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
  )
  .refine(({ count, times }) => times === undefined || typeof count !== "number", {
    error: "times multiplies only an ability or proficiency count",
  })
  .refine(({ levelsIn, scales }) => levelsIn === undefined || scales !== undefined, {
    error: "levelsIn is read only by scales",
  });

/**
 * A class pool the feature gives where no class table prints a column for it: `count` dice
 * of `die` sides, or plain uses where it has no die, keyed `key` as a table's `resource_key`
 * would be. Each of `scales` replaces the count, the die or both from a level in the
 * feature's class.
 */
const poolMechanicSchema = z.strictObject({
  kind: z.literal("pool"),
  key: poolKeySchema,
  count: z.int().min(1),
  die: dieSizeSchema.optional(),
  scales: z
    .array(
      z
        .strictObject({
          level: z.int().min(2).max(20),
          count: z.int().min(1).optional(),
          die: dieSizeSchema.optional(),
        })
        .refine((scale) => scale.count !== undefined || scale.die !== undefined, {
          error: "a scale replaces the count, the die or both",
        }),
    )
    .min(1)
    .optional(),
});

/**
 * A trade between the class pool keyed `pool` and spell slots: one expended slot regained for
 * `costs` from the pool, the first cost a level 1 slot's, and no slot above the last; under
 * `upTo`, none above half the proficiency bonus, rounded up. Where `refund` says so, a slot
 * can be expended for as many of the pool's uses as its level.
 */
const convertMechanicSchema = z.strictObject({
  kind: z.literal("convert"),
  pool: poolKeySchema,
  costs: z.array(z.int().min(1)).min(1).max(9),
  upTo: z.literal("halfProficiency").optional(),
  refund: z.literal(true).optional(),
});

/**
 * Expended spell slots a use of the feature recovers: a combined level of at most half the
 * levels in the feature's class, rounded up, no slot above `maxLevel`.
 */
const slotRecoveryMechanicSchema = z.strictObject({
  kind: z.literal("slotRecovery"),
  maxLevel: z.int().min(1).max(9),
});

/**
 * What a use of the feature regains: `count` expended uses of the class pool keyed `pool`, all
 * the expended pact slots, or `count` expended uses of the main count of the feature itself or,
 * where `of` names one of the same source, of that feature. `on` regains them without a use,
 * as rolling initiative finds none left, which is how each feature that prints it reads.
 */
const regainMechanicSchema = z
  .strictObject({
    kind: z.literal("regain"),
    target: z.enum(["pool", "pactSlots", "uses"]),
    pool: poolKeySchema.optional(),
    count: z.int().min(1).optional(),
    of: z.string().min(1).optional(),
    on: z.literal("initiative").optional(),
  })
  .refine(({ target, pool }) => (target === "pool") === (pool !== undefined), {
    error: "only a pool regain names its pool, and it must",
  })
  .refine(({ target, count }) => (target === "pactSlots") === (count === undefined), {
    error: "pact slots regain all of them, any other target a count",
  })
  .refine(({ target, of }) => of === undefined || target === "uses", {
    error: "only a regain of uses names the feature whose uses it regains",
  })
  .refine(({ target, on }) => on === undefined || target !== "pactSlots", {
    error: "a regain on an event restores a count",
  });

/** The standard actions a feature lets the character take as a bonus action, as each edition names them. */
const BONUS_ACTION_ACTIONS = [
  "Dash",
  "Disengage",
  "Dodge",
  "Help",
  "Hide",
  "Use an Object",
] as const;
export type BonusActionAction = (typeof BONUS_ACTION_ACTIONS)[number];

/**
 * What a feature changes about the character's turn, one of: the `attacks` the Attack action
 * allows, with the pact weapon alone where `pact` says so; `more` attacks added to whatever
 * count the character holds; an action a use of the feature adds to the current turn; or the
 * standard actions it lets the character take as a bonus action. An attack count carrying an
 * `option` holds only under that condition, so it is named and never added to the count. `while`
 * holds the mechanic only during a rage or while the feature's effect runs.
 */
const turnMechanicSchema = z
  .strictObject({
    kind: z.literal("turn"),
    attacks: z.int().min(2).max(4).optional(),
    more: z.literal(1).optional(),
    pact: z.literal(true).optional(),
    option: z.string().min(1).optional(),
    action: z.literal(true).optional(),
    bonusAction: z.array(z.enum(BONUS_ACTION_ACTIONS)).min(1).optional(),
    while: whileSchema,
  })
  .refine(
    ({ attacks, more, action, bonusAction }) =>
      [attacks !== undefined, more, action, bonusAction].filter(Boolean).length === 1,
    {
      error:
        "a turn mechanic sets attacks, adds attacks, adds an action or names bonus actions, one of them",
    },
  )
  .refine(({ pact, attacks }) => !pact || attacks !== undefined, {
    error: "only an attack count is the pact weapon's",
  })
  .refine(({ option, attacks, more }) => !option || attacks !== undefined || more, {
    error: "only an attack count carries a condition",
  });

/**
 * A spell pick a class or subclass feature leaves to the player: `count` spells of `level`,
 * or cantrips and any level the class can cast where `level` is absent, from `from` —
 * `any` for every class's list, `book` for the spells the character already holds, or the
 * name of the class whose list it is.
 */
const spellPickSchema = z.strictObject({
  count: z.int().min(1),
  level: z.int().min(0).max(9).optional(),
  from: z.string().min(1),
});

/**
 * Spells the feature grants outright or leaves to the player's pick. The sheet lists a grant
 * from the `additionalSpells` of the row that gives it, at the level each arrives: the feat's
 * or optional feature's own, or a race trait's race or subrace. `picks` is what a class or
 * subclass feature has the player choose, which no `additionalSpells` states; a pick is stored
 * on the character, under the feature it was made for. The row's daily and rest counts limit
 * a feat's or optional feature's casts without a slot; `casting` says where the text differs:
 * `slot` for a spell cast with a pact slot, which the count limits to one cast, and `atWill`
 * for one the count does not limit. A race trait whose spells upstream lists as known, with no
 * `daily` or `rest` key, records `casts`: each spell is cast that many times without a slot
 * between `reset` rests, the count the trait prints. A class or subclass feature that teaches
 * a spell by name, which no `additionalSpells` lists, records it in `learns`: the sheet lists it
 * as granted, so it counts against no spells known.
 */
const spellsMechanicSchema = z.strictObject({
  kind: z.literal("spells"),
  picks: z.array(spellPickSchema).min(1).optional(),
  casting: z.enum(["slot", "atWill"]).optional(),
  casts: z.strictObject({ count: z.int().min(1), reset: z.enum(["short", "long"]) }).optional(),
  learns: z.array(z.string().min(1)).min(1).optional(),
});

/**
 * The save DC the feature sets, as the table calls it by `label`, the feature's own name where
 * absent: 8 plus the proficiency bonus plus the modifier of `ability`, the higher modifier of
 * those a list names, or the spell save DC of the class `spell` names.
 */
const dcMechanicSchema = z
  .strictObject({
    kind: z.literal("dc"),
    ability: z.union([abilitySchema, z.array(abilitySchema).min(2)]).optional(),
    spell: z.string().min(1).optional(),
    label: z.string().min(1).optional(),
  })
  .refine(({ ability, spell }) => (ability === undefined) !== (spell === undefined), {
    error: "a dc mechanic names an ability or a class's spell save DC, one of them",
  });

const mechanicSchema = z.union([
  dcMechanicSchema,
  activeMechanicSchema,
  spellsMechanicSchema,
  turnMechanicSchema,
  usesMechanicSchema,
  poolMechanicSchema,
  convertMechanicSchema,
  slotRecoveryMechanicSchema,
  regainMechanicSchema,
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
export type SpellPick = z.infer<typeof spellPickSchema>;

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

/** The mechanics a feature records: each target bonused once, one DC, and `while active` only on a feature that starts. */
export const mechanicListSchema = z
  .array(mechanicSchema)
  .min(1)
  .refine(
    (all) => {
      const targets = all.flatMap((m) => (m.kind === "bonus" ? [m.target] : []));
      return new Set(targets).size === targets.length;
    },
    { error: "a feature bonuses each target once" },
  )
  .refine(
    (all) => {
      const parts = all.flatMap((m) => (m.kind === "uses" ? [m.part] : []));
      return new Set(parts).size === parts.length;
    },
    { error: "a feature counts its uses once, and each part once" },
  )
  .refine((all) => all.filter((m) => m.kind === "dc").length <= 1, {
    error: "a feature sets one save DC",
  })
  .refine(
    (all) =>
      all.some((m) => m.kind === "active") ||
      all.every((m) => !("while" in m) || m.while !== "active"),
    { error: "only a feature whose effect starts holds a mechanic while active" },
  );

/** A class or subclass feature carries its whole key; a feat, race trait or the like, its `(name, source)`. */
const featureRefSchema = z.union([featureKeySchema, contentRefSchema]);

export const featureMechanicsSchema = z
  .strictObject({
    ref: featureRefSchema,
    /** The feature whose choice of options this is one of; held only where the character took it. */
    offeredBy: featureKeySchema.optional(),
    /** The house rule a table turns on for the feature to apply; absent, the rule as printed. */
    houseRule: z.literal("optionalClassFeatures").optional(),
    /** The races, keyed `race` or `race|subrace` by the `(name, source)` of each, that give a trait. */
    races: z.array(z.string().min(1)).min(1).optional(),
    mechanics: mechanicListSchema.optional(),
    narrative: z.literal(true).optional(),
  })
  .refine((entry) => (entry.mechanics === undefined) !== (entry.narrative === undefined), {
    error: "a feature records its mechanics or the narrative mark, never both or neither",
  })
  .refine((entry) => !entry.races || !("className" in entry.ref), {
    error: "only a trait with a `(name, source)` ref belongs to races",
  });

export type FeatureMechanics = z.infer<typeof featureMechanicsSchema>;

export const featureMechanicsKey = ({ ref }: FeatureMechanics): string =>
  "className" in ref ? featureKey(ref) : refKey(ref);
