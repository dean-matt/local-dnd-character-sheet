/**
 * How many magic items a creature can be attuned to at once. Both rulesets set three,
 * and only the Artificer raises it: Magic Item Adept makes it four at 10th level, Savant
 * five at 14th and Master six at 18th, the same steps in `TCE` and `EFA`.
 */
export function attunementSlots(artificerLevel: number): number {
  if (artificerLevel >= 18) return 6;
  if (artificerLevel >= 14) return 5;
  if (artificerLevel >= 10) return 4;
  return 3;
}
