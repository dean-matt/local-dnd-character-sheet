import { type ContentRef, refKey } from "@dnd/character";
import { fillable, needed as neededOf, spent, type Tally, tally } from "./pickTally.ts";

/**
 * The skills a class, a background or a race lets the player pick, and how many. A `Replacement`
 * offer is the 2014 rule's pick of any skill in place of one the character would gain
 * twice, and its `name` says which.
 */
export type SkillOffer = {
  by: "Class" | "Background" | "Race" | "Replacement";
  /** The row's name, for saying whose list it is, or what a replacement replaces. */
  name: string;
  count: number;
  options: ContentRef[];
};

/** A skill granted outright, and what grants it. */
export type SkillGrant = { ref: ContentRef; by: string };

/** Where `departures` notes the skills taken against what the race, class and background offer. */
export const SKILLS_FIELD = "proficiencies.skills";

export type SkillTally = Tally<ContentRef>;

const grantedKeys = (granted: readonly SkillGrant[]) =>
  new Set(granted.map((grant) => refKey(grant.ref)));

/**
 * Which offer each held skill spends. A skill no offer has room for overspends the first
 * that holds it. A granted skill spends nothing.
 */
export const tallySkills = (
  offers: readonly SkillOffer[],
  granted: readonly SkillGrant[],
  held: readonly ContentRef[],
): SkillTally => tally(offers, grantedKeys(granted), held, refKey);

/** How many of `offer`'s picks can be spent, which a list the grants already cover cuts short. */
export const needed = (offer: SkillOffer, granted: readonly SkillGrant[]): number =>
  neededOf(offer, grantedKeys(granted), refKey);

/**
 * The 2014 rule's replacement: a character who would gain the same skill from two sources
 * picks any other skill instead. That is each skill granted twice, and each pick the
 * class, background and race lists cannot fill once the grants are counted. `undefined` where
 * nothing is gained twice.
 */
export function replacementOffer(
  offers: readonly SkillOffer[],
  granted: readonly SkillGrant[],
  everySkill: readonly ContentRef[],
): SkillOffer | undefined {
  const bys = new Map<string, { ref: ContentRef; by: string[] }>();
  for (const grant of granted) {
    const each = bys.get(refKey(grant.ref)) ?? { ref: grant.ref, by: [] };
    each.by.push(grant.by);
    bys.set(refKey(grant.ref), each);
  }
  const twice = [...bys.values()].filter((each) => each.by.length > 1);
  const unfilled =
    offers.reduce((sum, offer) => sum + offer.count, 0) -
    fillable(offers, grantedKeys(granted), refKey);
  const count = twice.reduce((sum, each) => sum + each.by.length - 1, 0) + unfilled;
  if (count === 0) return undefined;
  const reasons = [
    ...twice.map((each) => `${each.ref.name}, granted by both ${each.by.join(" and ")}`),
    ...(unfilled > 0
      ? [
          `${unfilled === 1 ? "a pick" : `${unfilled} picks`} the ${new Intl.ListFormat("en").format(offers.map((offer) => offer.name))} ${offers.length === 1 ? "list has" : "lists have"} no skill left for`,
        ]
      : []),
  ];
  return { by: "Replacement", name: reasons.join("; "), count, options: [...everySkill] };
}

/** Whether the held skills fill as many picks as the skills nothing grants can. */
export const skillsSpent = (
  offers: readonly SkillOffer[],
  granted: readonly SkillGrant[],
  skillTally: SkillTally,
): boolean => spent(offers, grantedKeys(granted), skillTally, refKey);

/** What the tally departs from the rules in, or `undefined` where it keeps to them. */
export function skillDeparture(
  offers: readonly SkillOffer[],
  { picked, outside }: SkillTally,
): string | undefined {
  const notes = [
    ...offers.flatMap((offer, index) => {
      const taken = picked[index]?.length ?? 0;
      if (taken <= offer.count) return [];
      return offer.by === "Replacement"
        ? [`${taken} skills taken in place of skills gained twice, which earn ${offer.count}`]
        : [`${taken} skills taken from the ${offer.name} list, which offers ${offer.count}`];
    }),
    ...(outside.length > 0
      ? [
          `${outside.map((skill) => skill.name).join(", ")} taken outside what the race, class and background offer`,
        ]
      : []),
  ];
  return notes.length > 0 ? `${notes.join("; ")}.` : undefined;
}
