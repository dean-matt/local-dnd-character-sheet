/**
 * A background's `startingEquipment` read as the form shows it: one alternative whose `A`
 * (or, in a classic list, `_`) lists the items, with coins among them, and whose `B` is coins
 * alone. Coins are copper in upstream and gold pieces here. A shape past that, such as
 * several alternatives or a `special` entry, reads as `undefined` and is left to the JSON;
 * an entry of `A` the form has no control for survives a write.
 */
import { isRecord } from "../../lib/entryGuards.ts";

interface EquipmentItem {
  /** Lowercased `name|source`, as upstream writes an item. */
  item: string;
  quantity: number;
}

export interface EquipmentState {
  items: EquipmentItem[];
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

const quantityOf = (entry: unknown) => {
  const quantity = asRecord(entry)?.quantity;
  return typeof quantity === "number" ? quantity : 1;
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

/** `_` in a classic list, `A` otherwise. */
const listKeyOf = (alternative: Record<string, unknown> | undefined) =>
  alternative && "_" in alternative && !("A" in alternative) ? "_" : "A";

/** `value` as the form shows it, or `undefined` where the form cannot. */
export function readEquipment(value: unknown): EquipmentState | undefined {
  if (value === undefined) return { items: [], coins: null, instead: null };
  const only = alternativeOf(value);
  if (!only) return undefined;
  const key = listKeyOf(only);
  const { [key]: listed, B, ...rest } = only;
  if (Object.keys(rest).length > 0 || (listed !== undefined && !Array.isArray(listed)))
    return undefined;
  const list: unknown[] = listed ?? [];
  const insteadList = B === undefined ? undefined : Array.isArray(B) ? B : null;
  const instead = insteadList?.length === 1 ? goldOf(insteadList[0]) : undefined;
  if (insteadList === null || (insteadList !== undefined && instead === undefined))
    return undefined;
  return {
    items: list.flatMap((entry) => {
      const item = itemOf(entry);
      return item === undefined ? [] : [{ item, quantity: quantityOf(entry) }];
    }),
    coins: list.map(goldOf).find((gold) => gold !== undefined) ?? null,
    instead: instead ?? null,
  };
}

/** `entry` with `quantity` written; the entry as it was where that is already its quantity. */
const withQuantity = (entry: unknown, quantity: number) => {
  if (quantityOf(entry) === quantity) return entry;
  const { quantity: _dropped, ...rest } = asRecord(entry) ?? { item: entry };
  return quantity === 1 ? rest : { ...rest, quantity };
};

/** `state` written over `value`, keeping the entries of the list the form has no control for. */
export function writeEquipment(value: unknown, state: EquipmentState): unknown[] | undefined {
  const alternative = alternativeOf(value);
  const key = listKeyOf(alternative);
  const original = alternative?.[key];
  const wanted = new Map(state.items.map((entry) => [entry.item, entry.quantity]));
  let seenCoins = false;
  let placed = false;
  const kept = (Array.isArray(original) ? original : []).flatMap((entry) => {
    const item = itemOf(entry);
    if (item !== undefined) {
      const quantity = wanted.get(item);
      return quantity === undefined ? [] : [withQuantity(entry, quantity)];
    }
    if (goldOf(entry) === undefined) return [entry];
    if (seenCoins) return [entry];
    seenCoins = true;
    if (state.coins === null) return [];
    placed = true;
    return [copper(state.coins)];
  });
  const listed = new Set(kept.flatMap((entry) => itemOf(entry) ?? []));
  const list = [
    ...kept,
    ...state.items
      .filter(({ item }) => !listed.has(item))
      .map(({ item, quantity }) => (quantity === 1 ? { item } : { item, quantity })),
    ...(placed || state.coins === null ? [] : [copper(state.coins)]),
  ];
  const result = {
    ...(list.length > 0 && { [key]: list }),
    ...(state.instead !== null && { B: [copper(state.instead)] }),
  };
  return Object.keys(result).length > 0 ? [result] : undefined;
}

/** What is wrong with `value` as the form shows it; nothing for a shape the form leaves to the JSON. */
export function equipmentProblem(value: unknown): string | undefined {
  const state = readEquipment(value);
  return (state?.coins ?? 0) < 0 || (state?.instead ?? 0) < 0
    ? "Coins: zero or more gold pieces"
    : undefined;
}
