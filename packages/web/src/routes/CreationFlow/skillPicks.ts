import { type ContentRef, refKey } from "@dnd/character";

/** The skills a class or a background lets the player pick, and how many. */
export type SkillOffer = {
  by: "Class" | "Background";
  /** The row's name, for saying whose list it is. */
  name: string;
  count: number;
  options: ContentRef[];
};

/** Where `departures` notes the skills taken against what the class and background offer. */
export const SKILLS_FIELD = "proficiencies.skills";

export type SkillTally = {
  /** What each offer's picks spend, in the order of `offers`. */
  picked: ContentRef[][];
  /** Skills held that no offer lists and nothing grants. */
  outside: ContentRef[];
};

/**
 * Which offer each held skill spends. A skill two lists hold spends the first with room
 * left, so a pick the class list has no room for falls to the background's; one no list
 * has room for overspends the first that holds it. A granted skill spends nothing.
 */
export function tallySkills(
  offers: readonly SkillOffer[],
  granted: readonly ContentRef[],
  held: readonly ContentRef[],
): SkillTally {
  const grantedKeys = new Set(granted.map(refKey));
  const picked: ContentRef[][] = offers.map(() => []);
  const outside: ContentRef[] = [];
  for (const skill of held) {
    if (grantedKeys.has(refKey(skill))) continue;
    const holders = offers.flatMap((offer, index) =>
      offer.options.some((option) => refKey(option) === refKey(skill)) ? [index] : [],
    );
    const spends =
      holders.find((index) => (picked[index]?.length ?? 0) < (offers[index]?.count ?? 0)) ??
      holders[0];
    if (spends === undefined) outside.push(skill);
    else picked[spends]?.push(skill);
  }
  return { picked, outside };
}

/** How many of `offer`'s picks can be spent, which a list the grants already cover cuts short. */
export function needed(offer: SkillOffer, granted: readonly ContentRef[]): number {
  const grantedKeys = new Set(granted.map(refKey));
  const open = offer.options.filter((option) => !grantedKeys.has(refKey(option))).length;
  return Math.min(offer.count, open);
}

/** What the tally departs from the rules in, or `undefined` where it keeps to them. */
export function skillDeparture(
  offers: readonly SkillOffer[],
  { picked, outside }: SkillTally,
): string | undefined {
  const notes = [
    ...offers.flatMap((offer, index) => {
      const taken = picked[index]?.length ?? 0;
      return taken > offer.count
        ? [`${taken} skills taken from the ${offer.name} list, which offers ${offer.count}`]
        : [];
    }),
    ...(outside.length > 0
      ? [
          `${outside.map((skill) => skill.name).join(", ")} taken outside what the class and background offer`,
        ]
      : []),
  ];
  return notes.length > 0 ? `${notes.join("; ")}.` : undefined;
}
