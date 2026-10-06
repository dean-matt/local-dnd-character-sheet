/** A challenge rating as upstream writes it, `"5"` or `"1/4"`, as a number: NaN where it is neither. */
export function challengeRatingValue(rating: string): number {
  const [numerator, denominator] = rating.split("/");
  return Number(numerator) / Number(denominator ?? 1);
}

/**
 * Not `proficiencyBonus`, which takes a character level and refuses anything outside
 * 1-20. The curve is the same, but ratings run from 0 to 30, and everything below 1
 * shares the bonus of a rating of 1.
 */
export function creatureProficiencyBonus(rating: number): number {
  return 2 + Math.floor((Math.max(rating, 1) - 1) / 4);
}
