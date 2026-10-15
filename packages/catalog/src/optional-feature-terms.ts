/**
 * An optional feature's `prerequisite`, read into what a sheet can judge against a
 * character and what it can only print. Upstream lists alternatives, every part of one of
 * which must hold; each list inside a part is met by any one of its entries.
 */
import { z } from "zod";

/**
 * One way to meet an option's prerequisite: a level in a named class, or a character level
 * where no class is named; a `PB` pact boon, by the word after `Pact of the`; any one
 * spell known, by lowercased name; any one option held, keyed `name|source` lowercased;
 * and `unjudged`, what the character sheet holds nothing to check, such as an item the
 * option is bound to or a renown, as upstream summarizes it.
 */
export const optionalFeaturePrerequisiteSchema = z.strictObject({
  level: z.int().min(1).optional(),
  className: z.string().min(1).optional(),
  pact: z.string().min(1).optional(),
  spells: z.array(z.string().min(1)),
  options: z.array(z.string().min(1)),
  unjudged: z.array(z.string().min(1)),
});

export type OptionalFeaturePrerequisite = z.infer<typeof optionalFeaturePrerequisiteSchema>;

const levelSchema = z
  .union([
    z.int(),
    z.looseObject({ level: z.int(), class: z.looseObject({ name: z.string() }).optional() }),
  ])
  .optional()
  .catch(undefined)
  .transform((level) =>
    typeof level === "object"
      ? { level: level.level, ...(level.class && { className: level.class.name }) }
      : level === undefined
        ? {}
        : { level },
  );

const summarySchema = z.looseObject({ entrySummary: z.string().min(1) });

/**
 * `eldritch blast#c` is a cantrip and `hex/curse#x` the spell or a feature that curses;
 * the name before either mark is the spell a sheet can find.
 */
const spellName = (tag: string) => (tag.split("#")[0] ?? "").split("/")[0]?.split("|")[0] ?? "";

const partSchema = z
  .looseObject({
    level: levelSchema,
    pact: z.string().min(1).optional().catch(undefined),
    spell: z
      .array(z.union([z.string(), summarySchema]))
      .optional()
      .catch(undefined),
    optionalfeature: z.array(z.string()).optional().catch(undefined),
    item: z.array(z.string()).optional().catch(undefined),
    otherSummary: summarySchema.optional().catch(undefined),
  })
  .transform(({ level, pact, spell = [], optionalfeature = [], item = [], otherSummary }) => ({
    ...level,
    ...(pact && { pact }),
    spells: spell.flatMap((each) =>
      typeof each === "string" ? [spellName(each).toLowerCase()] : [],
    ),
    options: optionalfeature.map((each) => each.toLowerCase()),
    unjudged: [
      ...spell.flatMap((each) => (typeof each === "string" ? [] : [each.entrySummary])),
      ...item,
      ...(otherSummary ? [otherSummary.entrySummary] : []),
    ],
  }));

/** An option's `prerequisite` field, absent or unreadable reading as none. */
export const optionalFeaturePrerequisitesSchema = z
  .array(partSchema)
  .optional()
  .catch(undefined)
  .transform((parts = []): OptionalFeaturePrerequisite[] => parts);
