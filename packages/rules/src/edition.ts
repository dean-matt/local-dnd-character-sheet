/**
 * Which of the two rulesets a row or a character follows.
 *
 * The vocabulary is a rule rather than a storage detail, so it lives here, and both
 * the character schema and the ETL validate against it. Where the rulesets
 * disagree on arithmetic, the function takes an edition rather than branching on
 * a global.
 */
export const EDITIONS = ["classic", "one"] as const;

export type Edition = (typeof EDITIONS)[number];
