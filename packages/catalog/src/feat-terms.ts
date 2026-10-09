import { ABILITIES } from "@dnd/rules";
import { z } from "zod";
import type { ScoreMinimums } from "./multiclass.ts";

/**
 * One way to meet a feat's prerequisite: a character level, a class the character holds,
 * and scores, any one of which suffices — `Ritual Caster` (PHB) needs 13 in Intelligence
 * or Wisdom. An absent part needs nothing.
 */
export type FeatPrerequisite = { level?: number; className?: string; scores: ScoreMinimums[] };

const scoresSchema = z
  .array(z.partialRecord(z.enum(ABILITIES), z.int()))
  .optional()
  .catch(undefined)
  .transform((scores): ScoreMinimums[] => scores ?? []);

const levelSchema = z
  .union([z.int(), z.looseObject({ level: z.int(), class: z.looseObject({ name: z.string() }) })])
  .optional()
  .catch(undefined)
  .transform((level) =>
    typeof level === "object" ? { level: level.level, className: level.class.name } : { level },
  );

const prerequisiteSchema = z
  .looseObject({ level: levelSchema, ability: scoresSchema })
  .transform(({ level, ability }): FeatPrerequisite => {
    const { level: at, className } = level;
    return {
      ...(at === undefined ? {} : { level: at }),
      ...(className === undefined ? {} : { className }),
      scores: ability,
    };
  });

/**
 * What a feat row says about who may take it: its 2024 category — `G` general, `O`
 * origin, `EB` epic boon, `FS` fighting style — whether it may be taken more than once,
 * and its prerequisites as alternatives, any one of which qualifies. An empty list needs
 * nothing.
 *
 * Only the level, class and scores are read. A race, a proficiency, spellcasting or
 * another feat goes unread, so a feat needing only those reads as open to everyone;
 * reading each kind against the definition is the way out. A malformed field reads as
 * absent rather than refusing the row.
 */
export const featTermsSchema = z
  .looseObject({
    category: z.string().optional().catch(undefined),
    repeatable: z.boolean().optional().catch(undefined),
    prerequisite: z.array(prerequisiteSchema).optional().catch(undefined),
  })
  .transform(({ category, repeatable, prerequisite }) => ({
    category,
    repeatable: repeatable === true,
    prerequisites: prerequisite ?? [],
  }));
