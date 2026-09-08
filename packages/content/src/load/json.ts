/** The narrowing every loader needs before it can read an upstream entry. */
export type Entry = Record<string, unknown>;

export function isRecord(value: unknown): value is Entry {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
