import { z } from "zod";
import { defenseTraitSchema } from "./defense.ts";
import type { ToolType } from "./item-kind.ts";
import { grantedSchema, proficiencyGrantsSchema } from "./proficiency-grants.ts";
import { senseGrantsSchema } from "./sense.ts";
import { skillProficienciesChoiceSchema } from "./skill-choice.ts";
import { backgroundToolChoicesSchema } from "./tool-choice.ts";

/** A definition field a feat's pick lands in. */
type FeatPickField = "savingThrows" | "skills" | "expertise" | "tools" | "languages" | "resist";

/**
 * One pick a feat offers: `count` names, each landing in one of `fields` — two for `Skilled`
 * (PHB), whose three picks are skills or tools. `from` holds the names lowercased, or is
 * `null` where any of the field's own pool will do: any skill, any language, any skill the
 * character is proficient in for `expertise`. A pick among tools names the kinds of tool it
 * also offers in `types`.
 */
export type FeatOffer = {
  fields: FeatPickField[];
  count: number;
  from: string[] | null;
  types?: ToolType[];
};

const countSchema = z.int().min(1);

const chooseSchema = z.looseObject({
  from: z.array(z.string()).min(1),
  count: countSchema.optional(),
});

/** The one alternative of a one-element list, `undefined` for a list of several or none. */
function onlyOf(alternatives: unknown): Record<string, unknown> | undefined {
  if (!Array.isArray(alternatives) || alternatives.length !== 1) return undefined;
  const [only] = alternatives;
  return typeof only === "object" && only !== null ? (only as Record<string, unknown>) : undefined;
}

/** A `{choose: {from, count}}` element, lowercased, or `undefined`. */
function chosen(element: unknown): { from: string[]; count: number } | undefined {
  const choose = z.looseObject({ choose: chooseSchema }).safeParse(element).data?.choose;
  return (
    choose && { from: choose.from.map((name) => name.toLowerCase()), count: choose.count ?? 1 }
  );
}

/** The picks every field but the skill and tool lists offers, which their own schemas read. */
function otherOffers(row: Record<string, unknown>): FeatOffer[] {
  const offers: FeatOffer[] = [];
  const saves = chosen(onlyOf(row.savingThrowProficiencies));
  if (saves) offers.push({ fields: ["savingThrows"], ...saves });
  const languages = countSchema.safeParse(onlyOf(row.languageProficiencies)?.any).data;
  if (languages) offers.push({ fields: ["languages"], count: languages, from: null });
  const expertise = countSchema.safeParse(onlyOf(row.expertise)?.anyProficientSkill).data;
  if (expertise) offers.push({ fields: ["expertise"], count: expertise, from: null });
  const mixed = z
    .looseObject({ choose: z.array(chooseSchema) })
    .safeParse(onlyOf(row.skillToolLanguageProficiencies)).data?.choose;
  for (const { from, count } of mixed ?? []) {
    if (from.includes("anySkill") && from.includes("anyTool")) {
      offers.push({ fields: ["skills", "tools"], count: count ?? 1, from: null });
    }
  }
  for (const element of Array.isArray(row.resist) ? row.resist : []) {
    const resist = chosen(element);
    if (resist) offers.push({ fields: ["resist"], ...resist });
  }
  return offers;
}

const outrightSchema = z.looseObject({
  savingThrowProficiencies: grantedSchema,
  expertise: grantedSchema,
});

/**
 * What a feat row grants through the fields races and items carry: the names it grants
 * outright, lowercased as upstream writes them, and the picks it offers.
 *
 * Upstream writes each proficiency list as alternatives; a list of several, such as the
 * languages of `Cult of the Dragon Initiate` (FRHoF), grants and offers nothing, and so does
 * a pick by filter, such as the weapons of `Weapon Master` (PHB). Asking the alternative, and
 * resolving the filter against the item rows, are the ways out. A malformed field reads as
 * absent rather than refusing the row.
 */
export const featGrantsSchema = z.looseObject({}).transform((row) => {
  const outright = outrightSchema.parse(row);
  const { skills, languages, tools, weapons, armor } = proficiencyGrantsSchema.parse(row);
  const { resist, immune, conditionImmune } = defenseTraitSchema.parse(row);
  const senses = senseGrantsSchema.parse(row);
  const skillPick = skillProficienciesChoiceSchema.parse(row);
  const toolPicks = backgroundToolChoicesSchema.parse(row);
  return {
    savingThrows: outright.savingThrowProficiencies,
    skills,
    expertise: outright.expertise,
    tools,
    languages,
    armor,
    weapons,
    resist,
    immune,
    conditionImmune,
    senses,
    offers: [
      ...(skillPick ? [{ fields: ["skills"], ...skillPick } satisfies FeatOffer] : []),
      ...toolPicks.map(
        ({ names, types, count }): FeatOffer => ({
          fields: ["tools"],
          count,
          from: names.length > 0 ? names : null,
          ...(types.length > 0 && { types }),
        }),
      ),
      ...otherOffers(row),
    ],
  };
});
