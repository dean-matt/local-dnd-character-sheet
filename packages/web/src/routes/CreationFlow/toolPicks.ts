import { needed, type Offer, spent, type Tally, tally } from "./pickTally.ts";

/** The tools a class or a background lets the player pick, named as a sheet prints them. */
export type ToolOffer = Offer<string> & {
  by: "Class" | "Background";
  /** The row's name, for saying whose list it is. */
  name: string;
  /** What the list holds, such as `musical instruments`, where it is every tool of a kind. */
  kind?: string;
  options: string[];
};

/** A tool granted outright, and what grants it. */
export type ToolGrant = { name: string; by: "Race" | "Background" | "Class" };

/** Where `departures` notes the tools taken against what the class and background offer. */
export const TOOLS_FIELD = "proficiencies.tools";

/** A tool's name as the definition keys it, `Thieves' Tools` and `thieves' tools` alike. */
const toolKey = (name: string) => name.toLowerCase();

const grantedKeys = (granted: readonly ToolGrant[]) =>
  new Set(granted.map((grant) => toolKey(grant.name)));

/** Which offer each held tool spends; a granted tool spends nothing. */
export const tallyTools = (
  offers: readonly ToolOffer[],
  granted: readonly ToolGrant[],
  held: readonly string[],
): Tally<string> => tally(offers, grantedKeys(granted), held, toolKey);

/** How many of `offer`'s picks can be spent once the grants are counted. */
export const toolsNeeded = (offer: ToolOffer, granted: readonly ToolGrant[]): number =>
  needed(offer, grantedKeys(granted), toolKey);

/** Whether the held tools fill as many picks as the tools nothing grants can. */
export const toolsSpent = (
  offers: readonly ToolOffer[],
  granted: readonly ToolGrant[],
  toolTally: Tally<string>,
): boolean => spent(offers, grantedKeys(granted), toolTally, toolKey);

/** Whether `name` is among `names`, ignoring case. */
export const holdsTool = (names: readonly string[], name: string) =>
  names.some((each) => toolKey(each) === toolKey(name));

/** What the tally departs from the rules in, or `undefined` where it keeps to them. */
export function toolDeparture(
  offers: readonly ToolOffer[],
  { picked, outside }: Tally<string>,
): string | undefined {
  const notes = [
    ...offers.flatMap((offer, index) => {
      const taken = picked[index]?.length ?? 0;
      const list = offer.kind ? `${offer.name} list of ${offer.kind}` : `${offer.name} list`;
      return taken > offer.count
        ? [`${taken} tools taken from the ${list}, which offers ${offer.count}`]
        : [];
    }),
    ...(outside.length > 0
      ? [`${outside.join(", ")} taken outside what the class and background offer`]
      : []),
  ];
  return notes.length > 0 ? `${notes.join("; ")}.` : undefined;
}
