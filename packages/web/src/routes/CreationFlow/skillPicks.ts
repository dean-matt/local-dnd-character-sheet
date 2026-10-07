import { type ContentRef, refKey } from "@dnd/character";

/**
 * The skills a class or a background lets the player pick, and how many. A `Replacement`
 * offer is the 2014 rule's pick of any skill in place of one the character would gain
 * twice, and its `name` says which.
 */
export type SkillOffer = {
  by: "Class" | "Background" | "Replacement";
  /** The row's name, for saying whose list it is, or what a replacement replaces. */
  name: string;
  count: number;
  options: ContentRef[];
};

/** A skill granted outright, and what grants it. */
export type SkillGrant = { ref: ContentRef; by: string };

/** Where `departures` notes the skills taken against what the class and background offer. */
export const SKILLS_FIELD = "proficiencies.skills";

export type SkillTally = {
  /** What each offer's picks spend, in the order of `offers`. */
  picked: ContentRef[][];
  /** Skills held that no offer lists and nothing grants. */
  outside: ContentRef[];
};

/**
 * The offer each of `skills` fills, or -1, filling as many of the offers' picks as any
 * assignment can. A skill two lists hold goes to the first with room, and moves to the
 * other where that frees room for a skill only the first holds, so the order the player
 * clicked in never strands a pick. Kuhn's augmenting paths, with each offer's count as its
 * capacity.
 */
function assign(offers: readonly SkillOffer[], skills: readonly ContentRef[]): number[] {
  const owner = skills.map(() => -1);
  const holders = skills.map((skill) =>
    offers.flatMap((offer, index) =>
      offer.options.some((option) => refKey(option) === refKey(skill)) ? [index] : [],
    ),
  );
  const takers = (index: number) => owner.flatMap((each, other) => (each === index ? [other] : []));
  const roomy = (index: number) => takers(index).length < (offers[index]?.count ?? 0);
  const place = (skill: number, seen: Set<number>): boolean => {
    const mine = holders[skill] ?? [];
    const free = mine.find(roomy);
    if (free !== undefined) {
      owner[skill] = free;
      return true;
    }
    return mine.some((index) => {
      if (seen.has(index)) return false;
      seen.add(index);
      if (!takers(index).some((other) => place(other, seen))) return false;
      owner[skill] = index;
      return true;
    });
  };
  for (const skill of skills.keys()) place(skill, new Set());
  return owner;
}

const notGranted = (granted: readonly SkillGrant[]) => {
  const keys = new Set(granted.map((grant) => refKey(grant.ref)));
  return (ref: ContentRef) => !keys.has(refKey(ref));
};

/**
 * Which offer each held skill spends. A skill no offer has room for overspends the first
 * that holds it. A granted skill spends nothing.
 */
export function tallySkills(
  offers: readonly SkillOffer[],
  granted: readonly SkillGrant[],
  held: readonly ContentRef[],
): SkillTally {
  const skills = held.filter(notGranted(granted));
  const owner = assign(offers, skills);
  const picked: ContentRef[][] = offers.map(() => []);
  const outside: ContentRef[] = [];
  skills.forEach((skill, index) => {
    const matched = owner[index] ?? -1;
    const spends =
      matched !== -1
        ? matched
        : offers.findIndex((offer) =>
            offer.options.some((option) => refKey(option) === refKey(skill)),
          );
    if (spends === -1) outside.push(skill);
    else picked[spends]?.push(skill);
  });
  return { picked, outside };
}

/** How many of the offers' picks the skills nothing grants can fill at most. */
function fillable(offers: readonly SkillOffer[], granted: readonly SkillGrant[]): number {
  const open = [
    ...new Map(
      offers
        .flatMap((offer) => offer.options.filter(notGranted(granted)))
        .map((ref) => [refKey(ref), ref]),
    ).values(),
  ];
  return assign(offers, open).filter((index) => index !== -1).length;
}

/** How many of `offer`'s picks can be spent, which a list the grants already cover cuts short. */
export function needed(offer: SkillOffer, granted: readonly SkillGrant[]): number {
  return Math.min(offer.count, offer.options.filter(notGranted(granted)).length);
}

/**
 * The 2014 rule's replacement: a character who would gain the same skill from two sources
 * picks any other skill instead. That is each skill granted twice, and each pick the
 * class and background lists cannot fill once the grants are counted. `undefined` where
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
  const unfilled = offers.reduce((sum, offer) => sum + offer.count, 0) - fillable(offers, granted);
  const count = twice.reduce((sum, each) => sum + each.by.length - 1, 0) + unfilled;
  if (count === 0) return undefined;
  const reasons = [
    ...twice.map((each) => `${each.ref.name}, granted by both ${each.by.join(" and ")}`),
    ...(unfilled > 0
      ? [
          `${unfilled === 1 ? "a pick" : `${unfilled} picks`} the ${offers.map((offer) => offer.name).join(" and ")} ${offers.length === 1 ? "list has" : "lists have"} no skill left for`,
        ]
      : []),
  ];
  return { by: "Replacement", name: reasons.join("; "), count, options: [...everySkill] };
}

/** Whether the held skills fill as many picks as the skills nothing grants can. */
export function skillsSpent(
  offers: readonly SkillOffer[],
  granted: readonly SkillGrant[],
  { picked }: SkillTally,
): boolean {
  const spent = offers.reduce(
    (sum, offer, index) => sum + Math.min(picked[index]?.length ?? 0, offer.count),
    0,
  );
  return spent >= fillable(offers, granted);
}

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
          `${outside.map((skill) => skill.name).join(", ")} taken outside what the class and background offer`,
        ]
      : []),
  ];
  return notes.length > 0 ? `${notes.join("; ")}.` : undefined;
}
