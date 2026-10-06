/** The catalog references inside rules content, keyed so a block asks for each one once. */
import type { RefQuery } from "@dnd/catalog";
import { parseTags, type Token } from "@dnd/tags";
import { isRecord } from "./entryGuards.ts";

export const refKey = (ref: RefQuery) =>
  JSON.stringify([ref.tag, ref.name, ref.source ?? null, ref.qualifier ?? null, ref.owner ?? null]);

function collectRefs(tokens: Token[], into: Map<string, RefQuery>) {
  for (const token of tokens) {
    if (token.kind === "style") collectRefs(token.children, into);
    if (token.kind !== "ref") continue;
    const ref: RefQuery = { tag: token.tag, name: token.name };
    if (token.source !== undefined) ref.source = token.source;
    if (token.qualifier !== undefined) ref.qualifier = token.qualifier;
    if (token.owner !== undefined) ref.owner = token.owner;
    into.set(refKey(ref), ref);
  }
}

/** Every string anywhere in `content`, a superset of what renders: a `type` parses to no ref. */
export function refsIn(
  content: unknown,
  into = new Map<string, RefQuery>(),
): Map<string, RefQuery> {
  if (typeof content === "string") collectRefs(parseTags(content), into);
  else if (Array.isArray(content)) for (const item of content) refsIn(item, into);
  else if (isRecord(content)) for (const value of Object.values(content)) refsIn(value, into);
  return into;
}
