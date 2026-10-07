import type { CharacterDefinition } from "@dnd/character";

type Level = CharacterDefinition["levels"][number];
type Departures = CharacterDefinition["departures"];

export type HitPointMethod = "average" | "roll" | "custom";

const GAIN_FIELD = /^levels\.\d+\.rolled$/;

const outside = (gain: number | undefined, die: number) =>
  gain !== undefined && (gain < 1 || gain > die);

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
    index > 0 && outside(level.rolled, die)
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
 * set this visit: Custom where a gain lies outside the die, a roll where any is stored, and
 * the average otherwise. A typed gain the die could have rolled reads as a roll.
 */
export function hitPointMethodOf(levels: readonly Level[], die: number): HitPointMethod {
  const gains = levels.slice(1).map((level) => level.rolled);
  if (gains.some((gain) => outside(gain, die))) return "custom";
  return gains.some((gain) => gain !== undefined) ? "roll" : "average";
}

/** A typed gain, or `null` for text that is not a whole number; an empty field is `undefined`. */
export function parseGain(text: string): number | undefined | null {
  const trimmed = text.trim();
  if (trimmed === "") return undefined;
  const gain = Number(trimmed);
  return /^-?\d+$/.test(trimmed) && Number.isSafeInteger(gain) ? gain : null;
}
