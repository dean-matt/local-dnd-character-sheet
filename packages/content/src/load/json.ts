/** The narrowing every loader needs before it can read an upstream entry. */
export type Entry = Record<string, unknown>;

export function isRecord(value: unknown): value is Entry {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** An entry's string field, refused rather than coerced when it is missing or blank. */
export function text(entry: Entry, key: string, context: string): string {
  const value = entry[key];
  if (typeof value !== "string" || value === "") {
    throw new Error(`${context}: ${key} is missing or not a string`);
  }
  return value;
}

/** An entry's list of strings, refused rather than coerced when it is missing or empty. */
export function strings(entry: Entry, key: string, context: string): string[] {
  const values = entry[key];
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error(`${context}: ${key} is missing or empty`);
  }
  return values.map((value, index) => {
    if (typeof value !== "string" || value === "") {
      throw new Error(`${context}: ${key}[${index}] is not a string`);
    }
    return value;
  });
}
