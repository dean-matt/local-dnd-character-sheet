import type { CharacterRecord } from "@dnd/character";
import type { z } from "zod";
import { isRecord } from "../../lib/entryGuards.ts";

/** A pasted homebrew entry, read as `schema`'s input or as one message per problem. */
export type HomebrewDraft<T> = { input: T } | { problems: string[] };

/** `entries[0].name` from `["entries", 0, "name"]`; the root reads as `entry`. */
function fieldName(path: readonly PropertyKey[]): string {
  const named = path.reduce<string>(
    (name, key) =>
      typeof key === "number" ? `${name}[${key}]` : name ? `${name}.${String(key)}` : String(key),
    "",
  );
  return named || "entry";
}

/**
 * Parses `text` as one 5etools-shaped entry and checks it, with `edition` beside it, against
 * the schema the route parses its body with, so a problem names its field before a request
 * is made. A pasted `source` is dropped, since the server stamps Homebrew's own.
 */
export function readHomebrewDraft<T>(
  text: string,
  edition: CharacterRecord["edition"],
  schema: z.ZodType<T>,
): HomebrewDraft<T> {
  let entry: unknown;
  try {
    entry = JSON.parse(text);
  } catch (error) {
    return { problems: [`Not valid JSON: ${(error as Error).message}`] };
  }
  if (!isRecord(entry) || Array.isArray(entry)) {
    return { problems: ["entry: Expected one JSON object, in braces"] };
  }
  const { source: _source, ...rest } = entry;
  const result = schema.safeParse({ ...rest, edition });
  return result.success
    ? { input: result.data }
    : {
        problems: result.error.issues.map((issue) => `${fieldName(issue.path)}: ${issue.message}`),
      };
}
