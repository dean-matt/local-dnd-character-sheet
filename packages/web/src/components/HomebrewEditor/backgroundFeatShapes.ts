/**
 * A background's `feats` read as the form shows it and written back in upstream's shape:
 * one alternative naming the feats it grants, or several alternatives of one feat each, of
 * which the player takes one. Anything else, such as a pick from a category, reads as
 * `undefined`, which the form leaves to the JSON.
 */
import { isRecord } from "../../lib/entryGuards.ts";

export type BackgroundFeatState =
  | { mode: "none" }
  | { mode: "fixed"; names: string[] }
  | { mode: "list"; names: string[] };

/** `value` as the form shows it, or `undefined` where the form cannot. */
export function readFeats(value: unknown): BackgroundFeatState | undefined {
  if (value === undefined) return { mode: "none" };
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const alternatives = value.map((alternative) =>
    isRecord(alternative) && !Array.isArray(alternative) ? Object.entries(alternative) : [],
  );
  const granted = alternatives.every(
    (entries) => entries.length > 0 && entries.every(([, given]) => given === true),
  );
  if (!granted) return undefined;
  if (alternatives.length === 1) {
    return { mode: "fixed", names: (alternatives[0] ?? []).map(([name]) => name) };
  }
  return alternatives.every((entries) => entries.length === 1)
    ? { mode: "list", names: alternatives.flatMap((entries) => entries.map(([name]) => name)) }
    : undefined;
}

/** `state` written as upstream's list; `undefined` where it names no feat. */
export function writeFeats(state: BackgroundFeatState): unknown[] | undefined {
  if (state.mode === "none" || state.names.length === 0) return undefined;
  if (state.mode === "fixed") {
    return [Object.fromEntries(state.names.map((name) => [name, true]))];
  }
  return state.names.map((name) => ({ [name]: true }));
}
