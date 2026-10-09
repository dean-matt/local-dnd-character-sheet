import type { CharacterRecord } from "@dnd/character";
import type { z } from "zod";
import { isRecord } from "../../lib/entryGuards.ts";

/** One 5etools-shaped entry as the editor holds it, without the `source` the server stamps. */
export type HomebrewEntry = Record<string, unknown>;

/**
 * What is wrong and where: `field` is the full path, as `duration[0].type`, and `key` the
 * top-level field it sits under, which the form shows it beside. A problem with the whole
 * entry has `entry` for both.
 */
export interface HomebrewProblem {
  key: string;
  field: string;
  message: string;
}

/** A homebrew entry, read as `schema`'s input or as its problems. */
export type HomebrewDraft<T> = { input: T } | { problems: HomebrewProblem[] };

/** `entries[0].name` from `["entries", 0, "name"]`; the root reads as `entry`. */
function fieldName(path: readonly PropertyKey[]): string {
  const named = path.reduce<string>(
    (name, key) =>
      typeof key === "number" ? `${name}[${key}]` : name ? `${name}.${String(key)}` : String(key),
    "",
  );
  return named || "entry";
}

const wholeEntry = (message: string): { problems: HomebrewProblem[] } => ({
  problems: [{ key: "entry", field: "entry", message }],
});

/** Parses `text` as one entry, dropping a pasted `source`, since the server stamps Homebrew's own. */
export function parseHomebrewEntry(
  text: string,
): { entry: HomebrewEntry } | { problems: HomebrewProblem[] } {
  let entry: unknown;
  try {
    entry = JSON.parse(text);
  } catch (error) {
    return wholeEntry(`Not valid JSON: ${(error as Error).message}`);
  }
  if (!isRecord(entry) || Array.isArray(entry)) {
    return wholeEntry("Expected one JSON object, in braces");
  }
  const { source: _source, ...rest } = entry;
  return { entry: rest };
}

/**
 * Checks `entry`, with `edition` beside it, against the schema the route parses its body
 * with, so a problem names its field before a request is made.
 */
export function checkHomebrewEntry<T>(
  entry: HomebrewEntry,
  edition: CharacterRecord["edition"],
  schema: z.ZodType<T>,
): HomebrewDraft<T> {
  const result = schema.safeParse({ ...entry, edition });
  return result.success
    ? { input: result.data }
    : {
        problems: result.error.issues.map((issue) => ({
          key: issue.path.length > 0 ? String(issue.path[0]) : "entry",
          field: fieldName(issue.path),
          message: issue.message,
        })),
      };
}
