import { type CharacterDefinition, type HitDie, hitPointSource } from "@dnd/character";

type Level = CharacterDefinition["levels"][number];
type Departures = CharacterDefinition["departures"];

export type HitPointMethod = "average" | "roll" | "custom";

const GAIN_FIELD = /^levels\.\d+\.rolled$/;

/** Whether a d`die` cannot roll `gain`, which the step marks typed and notes as a departure. */
export const outsideDie = (gain: number | undefined, die: number) =>
  hitPointSource({ die: die as HitDie, rolled: gain }, false) === "typed";

/**
 * `departures` with one entry for each level after the first whose gain a d`die` cannot
 * roll, replacing every such entry it held, so a level dropped or brought back in range
 * takes its entry with it.
 */
export function withGainDepartures(
  departures: Departures | undefined,
  levels: readonly Level[],
  die: number,
): Departures {
  const others = (departures ?? []).filter((departure) => !GAIN_FIELD.test(departure.field));
  const gains = levels.flatMap((level, index) =>
    index > 0 && outsideDie(level.rolled, die)
      ? [
          {
            field: `levels.${index}.rolled`,
            note: `Level ${index + 1} gains ${level.rolled} hit points, outside the d${die}'s 1 to ${die}.`,
          },
        ]
      : [],
  );
  return [...others, ...gains];
}

/**
 * The method a draft's gains were most likely set by, for a step opened on gains it did not
 * set this visit: Custom where a gain lies outside the die or sits beside a blank level,
 * which a roll never leaves, a roll where every level holds one, and the average where
 * none does. Typed gains the die could have rolled, filling every level, read as a roll.
 */
export function hitPointMethodOf(levels: readonly Level[], die: number): HitPointMethod {
  const gains = levels.slice(1).map((level) => level.rolled);
  const set = gains.filter((gain) => gain !== undefined);
  if (set.length === 0) return "average";
  if (set.length < gains.length || set.some((gain) => outsideDie(gain, die))) return "custom";
  return "roll";
}

/** A typed gain, or `null` for text that is not a whole number; an empty field is `undefined`. */
export function parseGain(text: string): number | undefined | null {
  const trimmed = text.trim();
  if (trimmed === "") return undefined;
  const gain = Number(trimmed);
  return /^-?\d+$/.test(trimmed) && Number.isSafeInteger(gain) ? gain : null;
}
