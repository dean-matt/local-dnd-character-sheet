/** How a level-up finds its hit points: the die's average, a roll, or a face typed in. */
export type HitPointMethod = "average" | "roll" | "custom";

/** A typed face a d`die` can show, or `undefined` for any other text. */
export function typedFace(text: string, die: number): number | undefined {
  const typed = Number(text);
  return text.trim() !== "" && Number.isInteger(typed) && typed >= 1 && typed <= die
    ? typed
    : undefined;
}
