/**
 * Walks 5etools `{@tag}` markup and turns it into tokens.
 *
 * `parseTags` is the entry point and `renderText` flattens tokens back to the plain
 * string an FTS index needs. No catalog lookups happen here — this package depends on
 * nothing, and resolving a `ref` belongs to a later layer.
 *
 * What each tag means lives in `registry.ts`; this file only knows how to find the
 * arguments and hand them over.
 *
 * Upstream writes no escapes: there is no `\|` or `\{` anywhere in the corpus. A pipe
 * always separates arguments and a brace always nests.
 */

import { isRollable } from "@dnd/dice";
import { SPECS } from "./registry.ts";
import { arg, type RefToken, type Token, text } from "./token.ts";

/**
 * Upstream nests two or three levels deep. The cap is what keeps `parseTags` able to
 * promise it never throws: past it the markup stays literal rather than overflowing the
 * stack, which is the same bargain an unknown tag makes.
 */
const MAX_DEPTH = 32;

/** Flattens nesting inside an argument, because a display is a string and not a tree. */
function plain(value: string, depth: number): string {
  return value.includes("{@") ? renderText(walk(value, depth + 1)) : value;
}

/**
 * The last resort for any tag: the first argument that carries text. A tag whose
 * expected argument is empty would otherwise render as nothing and be dropped, which
 * loses words. `{@homebrew |removals}` and `{@item |a shield}` both keep theirs.
 */
function firstFilled(args: string[], depth: number): string {
  for (let index = 0; index < args.length; index += 1) {
    const value = arg(args, index);
    if (value !== undefined) return plain(value, depth);
  }
  return "";
}

/** Falls back through the tag's own position, then the name, then anything with text. */
function display(args: string[], index: number, depth: number): string {
  const chosen = arg(args, index) ?? arg(args, 0);
  return chosen === undefined ? firstFilled(args, depth) : plain(chosen, depth);
}

/**
 * A computed display can still hold nesting: `{@hit +3|{@hit 3} to hit}` puts a tag in
 * the display argument. Flattening here covers every computed tag rather than each one
 * remembering to do it.
 */
function flatten(token: Token, depth: number): Token {
  switch (token.kind) {
    case "text":
      return token.value.includes("{@") ? text(plain(token.value, depth)) : token;
    case "roll":
    case "ref":
      return token.display.includes("{@")
        ? { ...token, display: plain(token.display, depth) }
        : token;
    default:
      return token;
  }
}

/** Walks forward to the brace that closes `open`, or -1 when nothing does. */
function matchingBrace(input: string, open: number): number {
  let depth = 0;
  for (let index = open; index < input.length; index += 1) {
    const char = input[index];
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

/**
 * Every `{` mapped to the `}` that closes it, in one pass. Built only after a scan has
 * failed, because repeated failures are what made scanning quadratic and a string with
 * no malformed tag never pays for this. Bounding the scan by length instead made a long
 * `{@note}` leak its markup, so neither ceiling is left.
 */
function braceMap(input: string): Map<number, number> {
  const pairs = new Map<number, number>();
  const open: number[] = [];
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (char === "{") open.push(index);
    else if (char === "}") {
      const start = open.pop();
      if (start !== undefined) pairs.set(start, index);
    }
  }
  return pairs;
}

/** Splits on pipes outside any nested tag, so `{@i a|b}` inside an argument survives. */
function splitArgs(body: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < body.length; i += 1) {
    const char = body[i];
    if (char === "{") depth += 1;
    else if (char === "}") depth -= 1;
    else if (char === "|" && depth === 0) {
      args.push(body.slice(start, i));
      start = i + 1;
    }
  }
  args.push(body.slice(start));
  return args;
}

/** Turns the inside of one `{@…}` into tokens. An unknown tag becomes its display text. */
function expand(inner: string, depth: number): Token[] {
  const boundary = inner.search(/[\s|]/);
  const tag = boundary === -1 ? inner : inner.slice(0, boundary);
  const rest =
    boundary === -1
      ? ""
      : inner[boundary] === "|"
        ? inner.slice(boundary)
        : inner.slice(boundary).replace(/^\s+/, "");
  const args = rest === "" ? [] : splitArgs(rest);

  const spec = SPECS.get(tag);
  if (spec === undefined) return [text(firstFilled(args, depth))];

  switch (spec.kind) {
    case "ref": {
      const name = arg(args, 0);
      // Without a name there is nothing to resolve, and a ref carrying prose as its
      // source is a guaranteed miss. The words still render.
      if (name === undefined) return [text(display(args, spec.display, depth))];
      const token: RefToken = {
        kind: "ref",
        tag,
        name: plain(name, depth),
        display: display(args, spec.display, depth),
      };
      for (const index of spec.source) {
        const source = arg(args, index);
        if (source !== undefined) {
          token.source = source;
          break;
        }
      }
      return [token];
    }
    case "roll": {
      const notation = arg(args, spec.notation) ?? "";
      return [
        {
          kind: "roll",
          notation,
          display: display(args, spec.display, depth),
          rollable: isRollable(notation),
        },
      ];
    }
    case "text":
      return [text(display(args, spec.display, depth))];
    case "style":
      return [{ kind: "style", style: spec.style, children: walk(rest, depth + 1) }];
    case "wrapper":
      return walk(rest, depth + 1);
    case "computed":
      return [flatten(spec.render(args), depth)];
  }
}

/**
 * Finds the brace closing each tag. Scans, and switches to a full map the first time a
 * scan fails, so a string with no malformed tag never builds one.
 */
function braceFinder(input: string): (open: number) => number {
  let pairs: Map<number, number> | null = null;
  return (open) => {
    if (pairs !== null) return pairs.get(open) ?? -1;
    const close = matchingBrace(input, open);
    if (close === -1) pairs = braceMap(input);
    return close;
  };
}

/**
 * An argument-less unknown tag has no display at all, and an empty token is only
 * something every renderer would have to skip.
 */
function worthKeeping(token: Token): boolean {
  switch (token.kind) {
    case "text":
      return token.value !== "";
    case "style":
      return token.children.length > 0;
    default:
      return token.display !== "";
  }
}

function walk(input: string, depth: number): Token[] {
  if (depth > MAX_DEPTH) return input === "" ? [] : [text(input)];
  const closeOf = braceFinder(input);
  const tokens: Token[] = [];
  let literal = "";
  let index = 0;

  const flush = (): void => {
    if (literal !== "") {
      tokens.push(text(literal));
      literal = "";
    }
  };

  while (index < input.length) {
    const open = input.indexOf("{@", index);
    if (open === -1) {
      literal += input.slice(index);
      break;
    }
    const close = closeOf(open);
    if (close === -1) {
      // Confine a malformed tag to itself. Homebrew text is hand-written, and one
      // stray brace should not turn the rest of a paragraph into raw markup.
      literal += input.slice(index, open + 2);
      index = open + 2;
      continue;
    }
    literal += input.slice(index, open);
    flush();
    for (const token of expand(input.slice(open + 2, close), depth)) {
      if (worthKeeping(token)) tokens.push(token);
    }
    index = close + 1;
  }

  flush();
  return tokens;
}

/**
 * Tokenizes `input`. Never throws: an unknown tag degrades to its display text,
 * unbalanced markup stays literal, and nesting past `MAX_DEPTH` stays literal too,
 * because upstream adds tags and existing characters must keep rendering when it does.
 */
export function parseTags(input: string): Token[] {
  return walk(input, 0);
}

/** Flattens tokens to plain text, which is what the FTS index stores. */
export function renderText(tokens: Token[]): string {
  let out = "";
  for (const token of tokens) {
    switch (token.kind) {
      case "text":
        out += token.value;
        break;
      case "style":
        out += renderText(token.children);
        break;
      default:
        out += token.display;
    }
  }
  return out;
}
