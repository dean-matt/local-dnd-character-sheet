/** Why `typed` is no amount of hit points, or the whole number it is. */
export function parseAmount(typed: string): { amount: number } | { error: string } {
  if (typed.trim() === "") return { error: "Enter an amount." };
  const amount = Number(typed);
  if (!Number.isInteger(amount)) return { error: "The amount is a whole number." };
  if (amount < 1) return { error: "The amount is 1 or more." };
  return { amount };
}

export const BUTTON =
  "h-8 rounded-control border bg-surface px-3 font-semibold text-row hover:bg-subtle aria-disabled:cursor-not-allowed aria-disabled:opacity-50";
