import { parseTags, renderText } from "@dnd/tags";
import { isRecord } from "./entryGuards.ts";

/**
 * A row's prose as plain paragraphs, because a popover sits inside the sentence that
 * cites it, where a block element is invalid markup. A table is left to the row's own page.
 */
export function paragraphs(entries: unknown, into: string[] = []): string[] {
  if (typeof entries === "string") into.push(renderText(parseTags(entries)));
  else if (Array.isArray(entries)) for (const entry of entries) paragraphs(entry, into);
  else if (isRecord(entries)) {
    for (const key of ["name", "entry", "entries", "items"]) paragraphs(entries[key], into);
  }
  return into;
}

/** The first paragraph of `entries` as plain text, for a one-line preview of a row. */
export function firstLine(entries: unknown): string | undefined {
  return paragraphs(entries).find((text) => text.trim() !== "");
}
