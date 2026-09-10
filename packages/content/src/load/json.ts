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

/** A document's array of entries under one key, each narrowed to an object. */
export function entriesOf(parsed: unknown, key: string, path: string): Entry[] {
  const entries = isRecord(parsed) ? parsed[key] : undefined;
  if (!Array.isArray(entries)) throw new Error(`${path} carries no ${key} array`);
  return entries.map((entry, index) => {
    if (!isRecord(entry)) throw new Error(`${path} ${key}[${index}] is not an object`);
    return entry;
  });
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

/**
 * An upstream file's entry array, refused when the file carries none and when
 * an element is not an object. Every loader reads its sources this way, so a
 * file that changed shape names itself rather than surfacing as a missing field
 * on the first entry a mapper touches.
 */
export function entriesOf(parsed: unknown, key: string, path: string): Entry[] {
  const entries = isRecord(parsed) ? parsed[key] : undefined;
  if (!Array.isArray(entries)) throw new Error(`${path} carries no ${key} array`);
  return entries.map((entry, index) => {
    if (!isRecord(entry)) throw new Error(`${path} ${key}[${index}] is not an object`);
    return entry;
  });
}
