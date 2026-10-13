import type { ScoreMinimums } from "@dnd/catalog";
import { ABILITY_LABEL, type Ability, type CharacterDefinition } from "@dnd/character";

type Departures = CharacterDefinition["departures"];

/** One class the prerequisite judges, by its name and the position of its first level. */
type Judged = { name: string; firstIndex: number; prerequisite: ScoreMinimums[] | undefined };

/** Whether `departures` notes an unmet multiclass prerequisite at `field`, such as `levels.3.class`. */
const isPrerequisiteField = (field: string) => /^levels\.\d+\.class$/.test(field);

export const prerequisiteField = (firstIndex: number) => `levels.${firstIndex}.class`;

/** `[{ str: 13 }, { dex: 13 }]` as `Strength 13 or Dexterity 13`. */
export function prerequisiteText(alternatives: readonly ScoreMinimums[]): string {
  return alternatives
    .map((minimums) =>
      Object.entries(minimums)
        .map(([ability, minimum]) => `${ABILITY_LABEL[ability as Ability]} ${minimum}`)
        .join(" and "),
    )
    .join(" or ");
}

/** Whether `score` meets every minimum of any one alternative; an empty list needs nothing. */
export function meetsPrerequisite(
  alternatives: readonly ScoreMinimums[],
  score: (ability: Ability) => number,
): boolean {
  return (
    alternatives.length === 0 ||
    alternatives.some((minimums) =>
      Object.entries(minimums).every(
        ([ability, minimum]) => score(ability as Ability) >= (minimum ?? 0),
      ),
    )
  );
}

/**
 * `departures` with one entry for each class whose multiclass prerequisite `score` leaves
 * unmet, replacing every such entry it held. The rule binds every class a multiclassed
 * character holds, the first included, and a character of one class has none to meet; nor
 * does one whose scores are not set, so `score` is absent until they are.
 */
export function withPrerequisiteDepartures(
  departures: Departures | undefined,
  classes: readonly Judged[],
  score: ((ability: Ability) => number) | undefined,
): Departures {
  const others = (departures ?? []).filter((departure) => !isPrerequisiteField(departure.field));
  if (classes.length < 2 || score === undefined) return others;
  const unmet = classes.flatMap(({ name, firstIndex, prerequisite = [] }) =>
    meetsPrerequisite(prerequisite, score)
      ? []
      : [
          {
            field: prerequisiteField(firstIndex),
            note: `Multiclassing in or out of ${name} needs ${prerequisiteText(prerequisite)}.`,
          },
        ],
  );
  return [...others, ...unmet];
}
