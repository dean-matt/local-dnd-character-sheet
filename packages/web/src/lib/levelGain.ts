import { type CharacterDefinition, MAX_HIT_POINT_GAIN } from "@dnd/character";
import { withGainDepartures } from "./hitPointGains.ts";

/** How Level History sets one level's gain: the class table's average, a die face, or a typed number. */
export type GainEdit =
  | { kind: "average" }
  | { kind: "roll"; face: number }
  | { kind: "typed"; gain: number };

/** A typed gain at least 1 the definition can hold, which may pass the die; `undefined` for anything else. */
export function typedGain(text: string): number | undefined {
  const trimmed = text.trim();
  const gain = Number(trimmed);
  return /^\d+$/.test(trimmed) && gain >= 1 && gain <= MAX_HIT_POINT_GAIN ? gain : undefined;
}

/** A gain the Edit dialog holds until Apply: a `GainEdit`, or typed text Apply checks. */
export type GainDraft =
  | { kind: "average" }
  | { kind: "roll"; face: number }
  | { kind: "typed"; text: string };

/** The edit `draft` makes, or `undefined` for typed text that is no gain. */
export function draftedGain(draft: GainDraft): GainEdit | undefined {
  if (draft.kind !== "typed") return draft;
  const gain = typedGain(draft.text);
  return gain === undefined ? undefined : { kind: "typed", gain };
}

export const typedGainMessage = `A typed gain is a whole number from 1 to ${MAX_HIT_POINT_GAIN}.`;

/**
 * `definition` with level `index`'s gain set by `edit`, and the departure notes for gains past
 * their die recomputed, `dice` holding each level's die in order. The first level takes its
 * die's highest face whatever it stores, so it is left alone. A `dice` that does not match
 * the levels, as when a level-up lands first, changes nothing.
 */
export function withLevelGain(
  definition: CharacterDefinition,
  index: number,
  edit: GainEdit,
  dice: readonly number[],
): CharacterDefinition {
  if (index < 1 || dice.length !== definition.levels.length) return definition;
  const levels = definition.levels.map((level, at) => {
    if (at !== index) return level;
    const { rolled: _, typed: __, ...rest } = level;
    if (edit.kind === "average") return rest;
    return edit.kind === "roll"
      ? { ...rest, rolled: edit.face }
      : { ...rest, rolled: edit.gain, typed: true as const };
  });
  return {
    ...definition,
    levels,
    departures: withGainDepartures(definition.departures, levels, dice),
  };
}
