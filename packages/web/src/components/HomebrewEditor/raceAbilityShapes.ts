/**
 * A race's `ability` read as the form shows it and written back in upstream's shape: one
 * alternative that raises named abilities by their own amounts, or offers a `choose` of some
 * from a list. Several alternatives, or an alternative that mixes the two or carries a key
 * the form has no control for, read as `undefined`, which the form leaves to the JSON.
 */
import { ABILITIES } from "@dnd/character";
import { isRecord } from "../../lib/entryGuards.ts";

type Ability = (typeof ABILITIES)[number];

/** A count or an amount, `null` while its input is empty. */
type Typed = number | null;

export type RaceAbilityState =
  | { mode: "none" }
  | { mode: "fixed"; amounts: Partial<Record<Ability, number>> }
  | { mode: "choose"; from: string[]; count: Typed; amount: Typed };

export type RaceAbilityMode = RaceAbilityState["mode"];

const isAbility = (name: string): name is Ability =>
  (ABILITIES as readonly string[]).includes(name);

const typed = (value: unknown): value is Typed =>
  value === null || (typeof value === "number" && Number.isFinite(value));

function readChoose(choose: Record<string, unknown>): RaceAbilityState | undefined {
  const { from, count = 1, amount = 1, ...rest } = choose;
  if (Object.keys(rest).length > 0 || !typed(count) || !typed(amount)) return undefined;
  if (!Array.isArray(from) || !from.every((name) => typeof name === "string" && isAbility(name))) {
    return undefined;
  }
  return { mode: "choose", from, count, amount };
}

/** `value` as the form shows it, or `undefined` where the form cannot. */
export function readRaceAbility(value: unknown): RaceAbilityState | undefined {
  if (value === undefined) return { mode: "none" };
  if (!Array.isArray(value) || value.length !== 1) return undefined;
  const [only] = value;
  if (!isRecord(only) || Array.isArray(only)) return undefined;
  const entries = Object.entries(only);
  if (entries.length === 0) return { mode: "none" };
  const [[key, choose]] = entries as [[string, unknown]];
  if (entries.length === 1 && key === "choose") {
    return isRecord(choose) && !Array.isArray(choose) ? readChoose(choose) : undefined;
  }
  const amounts = entries.filter(
    (entry): entry is [Ability, number] =>
      isAbility(entry[0]) && typeof entry[1] === "number" && Number.isFinite(entry[1]),
  );
  return amounts.length === entries.length
    ? { mode: "fixed", amounts: Object.fromEntries(amounts) }
    : undefined;
}

/** `state` written as a race's `ability`; `undefined` where it raises nothing yet. */
export function writeRaceAbility(state: RaceAbilityState): unknown[] | undefined {
  switch (state.mode) {
    case "none":
      return undefined;
    case "fixed": {
      const raised = ABILITIES.filter((ability) => state.amounts[ability]);
      return raised.length === 0
        ? undefined
        : [Object.fromEntries(raised.map((ability) => [ability, state.amounts[ability]]))];
    }
    case "choose":
      return [
        {
          choose: {
            from: state.from,
            count: state.count,
            ...(state.amount === 1 ? {} : { amount: state.amount }),
          },
        },
      ];
  }
}

const whole = (value: Typed) => value !== null && Number.isInteger(value);

/** What is wrong with `value` as the form shows it; nothing for a shape the form leaves to the JSON. */
export function raceAbilityProblem(value: unknown): string | undefined {
  const state = readRaceAbility(value);
  if (state?.mode === "fixed") {
    return Object.values(state.amounts).every(Number.isInteger)
      ? undefined
      : "Increase: a whole number";
  }
  if (state?.mode !== "choose") return undefined;
  if (state.from.length === 0) return "Pick at least one to choose from";
  if (!(whole(state.count) && Number(state.count) >= 1)) {
    return "How many: a whole number of at least 1";
  }
  if (Number(state.count) > state.from.length) {
    return `How many: no more than the ${state.from.length} to choose from`;
  }
  if (!whole(state.amount) || state.amount === 0) return "Increase by: a whole number, not 0";
  return undefined;
}
