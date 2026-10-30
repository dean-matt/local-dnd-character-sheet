import { isRecord } from "../../lib/entryGuards.ts";

export const SPEED_MODES = ["walk", "burrow", "climb", "fly", "swim"] as const;

export type SpeedMode = (typeof SPEED_MODES)[number];

/** A mode's speed: feet, or `true` for upstream's "equal to your walking speed". */
export type ModeSpeed = number | true | undefined;

const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** The speed each mode of a race's `speed` states, a bare number being the walking speed. */
export function readSpeed(speed: unknown): Record<SpeedMode, ModeSpeed> {
  const stated = isRecord(speed) && !Array.isArray(speed) ? speed : { walk: speed };
  const read = (mode: SpeedMode): ModeSpeed => {
    const feet = stated[mode];
    return finite(feet) || (mode !== "walk" && feet === true) ? feet : undefined;
  };
  return Object.fromEntries(SPEED_MODES.map((mode) => [mode, read(mode)])) as Record<
    SpeedMode,
    ModeSpeed
  >;
}

/**
 * `speed` with `mode` set to `value`, or dropped where `value` is `undefined`, written as
 * upstream does: a bare number for a walking speed alone, an object once there is more, and
 * whatever else the object holds kept. `undefined` where nothing is left.
 */
export function writeSpeed(speed: unknown, mode: SpeedMode, value: ModeSpeed): unknown {
  const stated =
    isRecord(speed) && !Array.isArray(speed) ? speed : speed === undefined ? {} : { walk: speed };
  const { [mode]: _old, ...rest } = stated;
  const next = value === undefined ? rest : { ...rest, [mode]: value };
  const keys = Object.keys(next);
  if (keys.length === 0) return undefined;
  const bareWalk = keys.length === 1 && keys[0] === "walk" && !isRecord(speed);
  return bareWalk ? next.walk : next;
}
