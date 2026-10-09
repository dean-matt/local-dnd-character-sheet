import { z } from "zod";

/**
 * The rules this table plays differently. Every option names a rule the sheet computes,
 * so what the sheet implements bounds the vocabulary rather than what 5e prints:
 * flanking earns an option the day something computes it, and until then a table that
 * plays it writes a note.
 *
 * An option carries whatever type its rule needs rather than a flag. Encumbrance is on
 * or off, but a fixed hit point maximum per level is a number, and a critical that
 * maxes dice rather than rolling them twice is a mode.
 */
export const houseRulesSchema = z
  .strictObject({
    /**
     * The 2014 encumbrance variant applies. It is a variant the table opts into and the
     * 2024 ruleset drops entirely, so absent, weight costs a creature no speed and
     * carrying capacity alone limits what it holds.
     */
    encumbrance: z.boolean().optional(),
    /**
     * Tasha's optional class features apply: the class and subclass feature rows the
     * catalog flags `isClassFeatureVariant`, such as `Martial Versatility` (TCE) on the
     * `Fighter` (PHB). Upstream prints them as a variant the table opts into, so absent,
     * a class grants only its own table's features. All or nothing, where a table picks
     * them one at a time and some replace a printed feature — `Deft Explorer` (TCE) for
     * `Natural Explorer` (PHB) — so turning it on lists both. The way out is a per-feature
     * pick on the definition.
     */
    optionalClassFeatures: z.boolean().optional(),
    /**
     * Tasha's custom origin applies: a classic race's increases keep their amounts, and
     * the player places each on any ability. Absent, an increase goes where the race
     * prints it. A 2024 race grants none, so the option changes nothing there.
     */
    customOrigin: z.boolean().optional(),
    /**
     * A 2024 character who would gain the same skill from two sources picks any other
     * skill in its place, as the 2014 rules give. The 2024 rules print no such
     * replacement, so absent, the second source earns nothing there. A classic
     * character earns it either way.
     */
    duplicateSkillReplacement: z.boolean().optional(),
    /**
     * A 2024 character who would gain the same tool from two sources picks any other tool
     * in its place, as the 2014 rules give. Absent, the second source earns nothing there,
     * and a classic character earns it either way, as for skills.
     */
    duplicateToolReplacement: z.boolean().optional(),
    /**
     * A classic character may take a feat in place of an Ability Score Improvement. The
     * 2014 rules print feats as an option the table opts into, so absent, a classic
     * improvement raises scores. The 2024 rules offer feats either way.
     */
    feats: z.boolean().optional(),
  })
  .prefault({});

export type HouseRules = z.infer<typeof houseRulesSchema>;

export type HouseRule = keyof HouseRules;

/**
 * What an option the table has not set means. `Required` is what closes the vocabulary:
 * an option added above fails to compile until it names its printed value.
 */
export const PRINTED_RULE: Required<HouseRules> = {
  encumbrance: false,
  optionalClassFeatures: false,
  customOrigin: false,
  duplicateSkillReplacement: false,
  duplicateToolReplacement: false,
  feats: false,
};
