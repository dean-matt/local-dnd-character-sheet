import {
  type CharacterDefinition,
  type HitDie,
  hitPointSource,
  MAX_HIT_POINT_GAIN,
} from "@dnd/character";

type Level = CharacterDefinition["levels"][number];
type Departures = CharacterDefinition["departures"];

export type HitPointMethod = "average" | "roll" | "custom";

/** Whether `departures` notes a level's gain at `field`, such as `levels.2.rolled`. */
export const isGainField = (field: string) => /^levels\.\d+\.rolled$/.test(field);

/** Whether a d`die` cannot roll `gain`, which the step marks typed and notes as a departure. */
export const outsideDie = (gain: number | undefined, die: number) =>
  hitPointSource({ die: die as HitDie, rolled: gain }, false) === "typed";

/**
 * `departures` with one entry for each level after the first whose gain its die cannot
 * roll, `dice` holding each level's die in order, replacing every such entry it held, so a
 * level dropped or brought back in range takes its entry with it.
 */
export function withGainDepartures(
  departures: Departures | undefined,
  levels: readonly Level[],
  dice: readonly number[],
): Departures {
  const others = (departures ?? []).filter((departure) => !isGainField(departure.field));
  const gains = levels.flatMap((level, index) => {
    const die = dice[index] ?? 0;
    return index > 0 && outsideDie(level.rolled, die)
      ? [
          {
            field: `levels.${index}.rolled`,
            note: `Level ${index + 1} gains ${level.rolled} hit points, outside the d${die}'s 1 to ${die}.`,
          },
        ]
      : [];
  });
  return [...others, ...gains];
}

/**
 * The method a draft's gains were most likely set by, for a step opened on gains it did not
 * set this visit, `dice` holding each level's die in order: Custom where a gain lies
 * outside its die or sits beside a blank level, which a roll never leaves, a roll where
 * every level holds one, and the average where none does. Typed gains the dice could have
 * rolled, filling every level, read as a roll.
 */
export function hitPointMethodOf(
  levels: readonly Level[],
  dice: readonly number[],
): HitPointMethod {
  const gains = levels.slice(1).map((level) => level.rolled);
  const set = gains.filter((gain) => gain !== undefined);
  if (set.length === 0) return "average";
  const outside = gains.some((gain, index) => outsideDie(gain, dice[index + 1] ?? 0));
  if (set.length < gains.length || outside) return "custom";
  return "roll";
}

/** A typed gain, or `null` for text that is not a whole number the definition can hold; an empty field is `undefined`. */
export function parseGain(text: string): number | undefined | null {
  const trimmed = text.trim();
  if (trimmed === "") return undefined;
  const gain = Number(trimmed);
  return /^[-+]?\d+$/.test(trimmed) && Math.abs(gain) <= MAX_HIT_POINT_GAIN ? gain : null;
}
