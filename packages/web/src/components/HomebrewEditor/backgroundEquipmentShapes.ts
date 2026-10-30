/**
 * A background's `startingEquipment` read as the form shows it: one alternative whose `A`
 * lists the items, with coins among them, and whose `B` is coins alone. Coins are copper in
 * upstream and gold pieces here. A shape past that, such as several alternatives or a
 * `special` entry, reads as `undefined` and is left to the JSON; an entry of `A` the form has
 * no control for survives a write.
 */
import { isRecord } from "../../lib/entryGuards.ts";

export interface EquipmentState {
  /** Lowercased `name|source`, as upstream writes an item. */
  items: string[];
  /** Gold pieces listed with the items. */
  coins: number | null;
  /** Gold pieces taken instead of the items. */
  instead: number | null;
}

const COPPER_PER_GOLD = 100;

const asRecord = (value: unknown) => (isRecord(value) && !Array.isArray(value) ? value : undefined);

const itemOf = (entry: unknown): string | undefined => {
  if (typeof entry === "string") return entry.toLowerCase();
  const item = asRecord(entry)?.item;
  return typeof item === "string" ? item.toLowerCase() : undefined;
};

/** The gold an entry of only `value` holds. */
const goldOf = (entry: unknown): number | undefined => {
  const record = asRecord(entry);
  const value = record?.value;
  return record && Object.keys(record).length === 1 && typeof value === "number"
    ? value / COPPER_PER_GOLD
    : undefined;
};

const copper = (gold: number) => ({ value: Math.round(gold * COPPER_PER_GOLD) });

const alternativeOf = (value: unknown) =>
  Array.isArray(value) && value.length === 1 ? asRecord(value[0]) : undefined;

/** `value` as the form shows it, or `undefined` where the form cannot. */
export function readEquipment(value: unknown): EquipmentState | undefined {
  if (value === undefined) return { items: [], coins: null, instead: null };
  const only = alternativeOf(value);
  if (!only) return undefined;
  const { A, B, ...rest } = only;
  if (Object.keys(rest).length > 0 || (A !== undefined && !Array.isArray(A))) return undefined;
  const list: unknown[] = A ?? [];
  const insteadList = B === undefined ? undefined : Array.isArray(B) ? B : null;
  const instead = insteadList?.length === 1 ? goldOf(insteadList[0]) : undefined;
  if (insteadList === null || (insteadList !== undefined && instead === undefined))
    return undefined;
  return {
    items: list.flatMap((entry) => itemOf(entry) ?? []),
    coins: list.map(goldOf).find((gold) => gold !== undefined) ?? null,
    instead: instead ?? null,
  };
}

/** `state` written over `value`, keeping the entries of `A` the form has no control for. */
export function writeEquipment(value: unknown, state: EquipmentState): unknown[] | undefined {
  const original = alternativeOf(value)?.A;
  let placed = false;
  const kept = (Array.isArray(original) ? original : []).flatMap((entry) => {
    const item = itemOf(entry);
    if (item !== undefined) return state.items.includes(item) ? [entry] : [];
    if (goldOf(entry) === undefined) return [entry];
    if (placed || state.coins === null) return [];
    placed = true;
    return [copper(state.coins)];
  });
  const listed = new Set(kept.flatMap((entry) => itemOf(entry) ?? []));
  const list = [
    ...kept,
    ...state.items.filter((item) => !listed.has(item)).map((item) => ({ item })),
    ...(placed || state.coins === null ? [] : [copper(state.coins)]),
  ];
  const alternative = {
    ...(list.length > 0 && { A: list }),
    ...(state.instead !== null && { B: [copper(state.instead)] }),
  };
  return Object.keys(alternative).length > 0 ? [alternative] : undefined;
}

/** What is wrong with `value` as the form shows it; nothing for a shape the form leaves to the JSON. */
export function equipmentProblem(value: unknown): string | undefined {
  const state = readEquipment(value);
  return (state?.coins ?? 0) < 0 || (state?.instead ?? 0) < 0
    ? "Coins: zero or more gold pieces"
    : undefined;
}
