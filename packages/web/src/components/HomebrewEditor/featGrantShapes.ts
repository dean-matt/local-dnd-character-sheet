/**
 * A feat's grant fields — `ability`, `savingThrowProficiencies` and the other proficiency
 * lists — read as the form shows one and written back in upstream's shape: a list of one
 * alternative that grants names outright, offers a `choose` from a list, or offers a count of
 * any. A list of several alternatives, or an alternative mixing a grant with a pick, reads as
 * `undefined`, which the form leaves to the JSON.
 */
import { ABILITIES } from "@dnd/character";
import { isRecord } from "../../lib/entryGuards.ts";

export type GrantMode = "none" | "fixed" | "list" | "any";

/** How one field writes each way of granting. */
export interface GrantSpec {
  /**
   * The key a pick of any writes its count under, as `{any: 2}`; absent where a pick of any is
   * a `choose` from `everyName`, as a saving throw of any ability.
   */
  anyKey?: "any" | "anyProficientSkill";
  /** Every name a pick of any offers, where `anyKey` is absent. */
  everyName?: readonly string[];
  /** A fixed grant raises each name by an amount, as an ability score, rather than naming it `true`. */
  amounts?: boolean;
  /** Only a fixed grant, as armor and weapons. */
  fixedOnly?: boolean;
  /** Keys of the alternative the form shows no control for and keeps, as an Epic Boon's `max`. */
  kept?: readonly string[];
}

/** How each grant field the form shows writes, by its key. */
export const FEAT_GRANT_SPECS = {
  ability: { everyName: ABILITIES, amounts: true, kept: ["max"] },
  savingThrowProficiencies: { everyName: ABILITIES },
  skillProficiencies: { anyKey: "any" },
  expertise: { anyKey: "anyProficientSkill" },
  toolProficiencies: { anyKey: "any" },
  languageProficiencies: { anyKey: "any" },
  armorProficiencies: { fixedOnly: true },
  weaponProficiencies: { fixedOnly: true },
} satisfies Record<string, GrantSpec>;

export type FeatGrantKey = keyof typeof FEAT_GRANT_SPECS;

/** A count or an amount, `null` while its input is empty. */
type Typed = number | null;

export type GrantState =
  | { mode: "none" }
  | { mode: "fixed"; names: string[]; amount: Typed }
  | { mode: "list"; from: string[]; count: Typed }
  | { mode: "any"; count: Typed };

const typed = (value: unknown): value is Typed =>
  value === null || (typeof value === "number" && Number.isFinite(value));

/** The one alternative of a one-element list; `undefined` for anything else. */
function onlyAlternative(value: unknown): Record<string, unknown> | undefined {
  if (!Array.isArray(value) || value.length !== 1) return undefined;
  const [only] = value;
  return isRecord(only) && !Array.isArray(only) ? only : undefined;
}

const sameNames = (names: string[], every: readonly string[]) =>
  names.length === every.length && every.every((name) => names.includes(name));

function readChoose(choose: unknown, spec: GrantSpec): GrantState | undefined {
  if (!isRecord(choose) || Array.isArray(choose)) return undefined;
  const { from, count = 1, amount: _amount, ...rest } = choose;
  if (Object.keys(rest).length > 0 || !Array.isArray(from) || !typed(count)) return undefined;
  if (!from.every((name) => typeof name === "string")) return undefined;
  const names = from.map((name: string) => name.toLowerCase());
  return spec.everyName && sameNames(names, spec.everyName)
    ? { mode: "any", count }
    : { mode: "list", from: names, count };
}

/** `value` as the form shows it, or `undefined` where the form cannot. */
export function readGrant(value: unknown, spec: GrantSpec): GrantState | undefined {
  if (value === undefined) return { mode: "none" };
  const alternative = onlyAlternative(value);
  if (!alternative) return undefined;
  const shown = Object.entries(alternative).filter(([key]) => !spec.kept?.includes(key));
  const [first] = shown;
  if (!first) return { mode: "none" };
  const [key, granted] = first;
  const fixedOnly = (state: GrantState | undefined) =>
    spec.fixedOnly && state?.mode !== "fixed" ? undefined : state;
  if (shown.length === 1 && key === "choose") return fixedOnly(readChoose(granted, spec));
  if (shown.length === 1 && key === spec.anyKey && typed(granted)) {
    return fixedOnly({ mode: "any", count: granted });
  }
  const names = shown.map(([key]) => key.toLowerCase());
  if (!spec.amounts) {
    return shown.every(([, granted]) => granted === true)
      ? { mode: "fixed", names, amount: null }
      : undefined;
  }
  const amounts = new Set(shown.map(([, amount]) => amount));
  const [amount] = amounts;
  return amounts.size === 1 && typed(amount) ? { mode: "fixed", names, amount } : undefined;
}

/** `state` written over `value`, keeping the keys `spec` keeps and a `choose`'s amount. */
export function writeGrant(
  value: unknown,
  spec: GrantSpec,
  state: GrantState,
): unknown[] | undefined {
  const alternative = onlyAlternative(value) ?? {};
  const kept = Object.fromEntries(
    Object.entries(alternative).filter(([key]) => spec.kept?.includes(key)),
  );
  const choose = isRecord(alternative.choose) ? alternative.choose : {};
  const amount = "amount" in choose ? { amount: choose.amount } : {};
  switch (state.mode) {
    case "none":
      return undefined;
    case "fixed":
      return state.names.length === 0
        ? undefined
        : [
            {
              ...kept,
              ...Object.fromEntries(
                state.names.map((name) => [name, spec.amounts ? state.amount : true]),
              ),
            },
          ];
    case "list":
      return [{ ...kept, choose: { from: state.from, count: state.count, ...amount } }];
    case "any":
      return spec.anyKey
        ? [{ ...kept, [spec.anyKey]: state.count }]
        : [
            {
              ...kept,
              choose: { from: [...(spec.everyName ?? [])], count: state.count, ...amount },
            },
          ];
  }
}

const whole = (value: Typed) => value !== null && Number.isInteger(value);

/** What is wrong with `value` as the form shows it; nothing for a shape the form leaves to the JSON. */
export function grantProblem(value: unknown, spec: GrantSpec): string | undefined {
  const state = readGrant(value, spec);
  if (state?.mode === "fixed" && spec.amounts && !whole(state.amount)) {
    return "Increase by: a whole number";
  }
  if (state?.mode === "list" && state.from.length === 0) return "Pick at least one to choose from";
  if (
    (state?.mode === "list" || state?.mode === "any") &&
    !(whole(state.count) && Number(state.count) >= 1)
  ) {
    return "How many: a whole number of at least 1";
  }
  if (state?.mode === "list" && Number(state.count) > state.from.length) {
    return `How many: no more than the ${state.from.length} to choose from`;
  }
  return undefined;
}
