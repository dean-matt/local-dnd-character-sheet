import { parseTags, renderText } from "@dnd/tags";

/** Every string in `entries`, depth first, as 5etools nests a section's text and a list's items. */
function* texts(entries: unknown): Generator<string> {
  if (typeof entries === "string") yield entries;
  else if (Array.isArray(entries)) for (const entry of entries) yield* texts(entry);
  else if (entries && typeof entries === "object") {
    const { entry, entries: nested, items } = entries as Record<string, unknown>;
    yield* texts(entry);
    yield* texts(nested);
    yield* texts(items);
  }
}

/** A lead-in that only introduces the list after it, as every 2024 condition opens with. */
const LEAD_IN = /following effects?\W*$/i;

/** The first of `entries`' text that says something, past a lead-in. */
function firstText(entries: unknown): string | undefined {
  for (const text of texts(entries)) if (!LEAD_IN.test(text)) return text;
  return undefined;
}

/** `text`'s markup flattened and cut at its first sentence. */
function firstSentence(text: string): string {
  const plain = renderText(parseTags(text));
  const end = plain.search(/[.!?](\s|$)/);
  return end === -1 ? plain : plain.slice(0, end + 1);
}

/** One line saying what a catalog row is: the first sentence of its first text past a lead-in. */
export function blurbOf(entries: unknown): string | undefined {
  const text = firstText(entries);
  return text === undefined ? undefined : firstSentence(text);
}
