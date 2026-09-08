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

import { SPECS } from "./registry.ts";
import { arg, type RefToken, rollable, type Token, text } from "./token.ts";

/** Flattens nesting inside an argument, because a display is a string and not a tree. */
function plain(value: string): string {
  return value.includes("{@") ? renderText(parseTags(value)) : value;
}

/** Falls back to the first argument, which is the name or notation for every tag. */
function display(args: string[], index: number): string {
  return plain(arg(args, index) ?? arg(args, 0) ?? "");
}

/**
 * A computed display can still hold nesting: `{@hit +3|{@hit 3} to hit}` puts a tag in
 * the display argument. Flattening here covers every computed tag rather than each one
 * remembering to do it.
 */
function flatten(token: Token): Token {
  switch (token.kind) {
    case "text":
      return token.value.includes("{@") ? text(plain(token.value)) : token;
    case "roll":
      return token.display.includes("{@") ? { ...token, display: plain(token.display) } : token;
    default:
      return token;
  }
}

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
function expand(inner: string): Token[] {
  const boundary = inner.search(/[\s|]/);
  const tag = boundary === -1 ? inner : inner.slice(0, boundary);
  const rest =
    boundary === -1 ? "" : inner.slice(inner[boundary] === "|" ? boundary : boundary + 1);
  const args = rest === "" ? [] : splitArgs(rest);

  const spec = SPECS.get(tag);
  if (spec === undefined) return [text(display(args, 0))];

  switch (spec.kind) {
    case "ref": {
      const token: RefToken = {
        kind: "ref",
        tag,
        name: plain(arg(args, 0) ?? ""),
        display: display(args, spec.display),
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
          display: display(args, spec.display),
          rollable: rollable(notation),
        },
      ];
    }
    case "text":
      return [text(display(args, spec.display))];
    case "style":
      return [{ kind: "style", style: spec.style, children: parseTags(rest) }];
    case "wrapper":
      return parseTags(rest);
    case "computed":
      return [flatten(spec.render(args))];
  }
}

/**
 * Tokenizes `input`. Never throws: an unknown tag degrades to its display text and
 * unbalanced markup stays literal, because upstream adds tags and existing characters
 * must keep rendering when it does.
 */
export function parseTags(input: string): Token[] {
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
    const close = matchingBrace(input, open);
    if (close === -1) {
      literal += input.slice(index);
      break;
    }
    literal += input.slice(index, open);
    flush();
    for (const token of expand(input.slice(open + 2, close))) {
      // An argument-less unknown tag has no display at all, and an empty token is only
      // something every renderer would have to skip.
      if (token.kind === "text" && token.value === "") continue;
      tokens.push(token);
    }
    index = close + 1;
  }

  flush();
  return tokens;
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
