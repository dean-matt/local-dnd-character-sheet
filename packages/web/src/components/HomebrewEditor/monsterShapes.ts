import { isRecord } from "../../lib/entryGuards.ts";

export const MONSTER_SPEED_MODES = ["walk", "burrow", "climb", "fly", "swim"] as const;

export type MonsterSpeedMode = (typeof MONSTER_SPEED_MODES)[number];

const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** A speed in feet: upstream writes either the number or `{number, condition}`. */
const feetOf = (value: unknown): number | undefined =>
  finite(value) ? value : isRecord(value) && finite(value.number) ? value.number : undefined;

/** The feet a monster's `speed` states for `mode`. */
export const speedFeet = (speed: unknown, mode: MonsterSpeedMode): number | undefined =>
  isRecord(speed) ? feetOf(speed[mode]) : undefined;

/**
 * `speed` with `mode` set to `feet`, or dropped where `feet` is `undefined`; a conditional
 * speed keeps its condition. An empty speed stays `{}` so the schema's "A speed" reason shows.
 */
export function withSpeed(
  speed: unknown,
  mode: MonsterSpeedMode,
  feet: number | undefined,
): Record<string, unknown> {
  const stated = isRecord(speed) ? speed : {};
  const { [mode]: old, ...rest } = stated;
  if (feet === undefined) return rest;
  return { ...rest, [mode]: isRecord(old) ? { ...old, number: feet } : feet };
}

/** The first armor class as the form edits it: a number, or `{ac}` upstream writes for a source. */
export function firstArmorClass(ac: unknown): number | undefined {
  const [first] = Array.isArray(ac) ? ac : [];
  return finite(first) ? first : isRecord(first) && finite(first.ac) ? first.ac : undefined;
}

/** True where the first armor class is stated as prose, which the form leaves to JSON. */
export const armorClassIsProse = (ac: unknown): boolean => {
  const [first] = Array.isArray(ac) ? ac : [];
  return isRecord(first) && first.special !== undefined && !finite(first.ac);
};

/**
 * `ac` with its first entry's number set to `value`, keeping the rest of the list and any
 * source the first carries; the list is dropped when no number is left to hold.
 */
export function withArmorClass(ac: unknown, value: number | undefined): unknown[] | undefined {
  const [first, ...rest] = Array.isArray(ac) ? ac : [];
  if (value === undefined) return rest.length > 0 ? rest : undefined;
  return [isRecord(first) ? { ...first, ac: value } : value, ...rest];
}

/** The challenge rating text, whether written plainly or as `{cr}`. */
export const ratingOf = (cr: unknown): string =>
  typeof cr === "string" ? cr : isRecord(cr) && typeof cr.cr === "string" ? cr.cr : "";

/** `cr` with its rating replaced, keeping a lair or coven rating beside it. */
export const withRating = (cr: unknown, rating: string): unknown =>
  isRecord(cr) ? { ...cr, cr: rating } : rating;
