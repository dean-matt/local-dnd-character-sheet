import type { HitDie, longRestHitDicePick } from "@dnd/character";

export type HitDicePick = NonNullable<ReturnType<typeof longRestHitDicePick>>;

/**
 * The count typed for each spent size, in `pick.spent`'s order, or `undefined` where it is no
 * whole number from 0 to what was spent.
 */
export function typedCounts(pick: HitDicePick, typed: readonly string[]): (number | undefined)[] {
  return pick.spent.map(({ count }, index) => {
    const raw = typed[index]?.trim() ?? "";
    const value = Number(raw);
    return raw !== "" && Number.isInteger(value) && value >= 0 && value <= count
      ? value
      : undefined;
  });
}

/** The largest dice first, up to what returns: the pick that brings back the most hit points. */
export function largestFirst(pick: HitDicePick): string[] {
  const counts = pick.spent.map(() => 0);
  let left = pick.allowed;
  const order = pick.spent.map((_, index) => index);
  order.sort((a, b) => (pick.spent[b]?.die ?? 0) - (pick.spent[a]?.die ?? 0));
  for (const index of order) {
    const taken = Math.min(pick.spent[index]?.count ?? 0, left);
    counts[index] = taken;
    left -= taken;
  }
  return counts.map(String);
}

/**
 * The dice `rest` reads as `picked`, or `undefined` while a count is invalid or the counts
 * pass what returns.
 */
export function pickedDice(pick: HitDicePick, typed: readonly string[]): HitDie[] | undefined {
  const counts = typedCounts(pick, typed);
  if (counts.some((count) => count === undefined)) return undefined;
  const dice = pick.spent.flatMap(({ die }, index) =>
    Array.from({ length: counts[index] ?? 0 }, () => die),
  );
  return dice.length > pick.allowed ? undefined : dice;
}
