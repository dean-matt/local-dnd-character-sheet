/**
 * Checks every `{@tag}` in the vendored 5etools data against the invariants the
 * committed tests cannot reach: they assert a few dozen verbatim strings, this asserts
 * all of them.
 *
 * Needs `pnpm content:sync` first, because `vendor/` is WotC's data and is never
 * committed. Takes a directory so a fixture subset can stand in for the real thing.
 *
 * It cannot catch a display read from the wrong argument when both arguments are
 * plausible — `{@scaledice 8d6|3-9|1d6}` rendering "8d6" passes every check here.
 * `vendor/5etools/data/renderdemo.json` is what settles that.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { rollDice } from "../packages/dice/src/index.ts";
import { KNOWN_TAGS, parseTags, renderText, type Token } from "../packages/tags/src/index.ts";

const vendor = resolve(process.argv[2] ?? "vendor/5etools/data");

if (!existsSync(vendor)) {
  console.error(`no data at ${vendor} — run pnpm content:sync first`);
  process.exit(1);
}

function* jsonFiles(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* jsonFiles(path);
    else if (name.endsWith(".json")) yield path;
  }
}

function* tagged(value: unknown): Generator<string> {
  if (typeof value === "string") {
    if (value.includes("{@")) yield value;
  } else if (Array.isArray(value)) {
    for (const item of value) yield* tagged(item);
  } else if (value !== null && typeof value === "object") {
    for (const item of Object.values(value)) yield* tagged(item);
  }
}

/** Nesting is why: a ref inside `{@i …}` is a token like any other and gets checked. */
function* flat(tokens: Token[]): Generator<Token> {
  for (const token of tokens) {
    yield token;
    if (token.kind === "style") yield* flat(token.children);
  }
}

/**
 * A registered tag that yields no token has deleted itself, and the deletion is
 * invisible in the rendered string. The empty-token rule cannot see this, because the
 * parser drops empty tokens before they reach here.
 */
function spanEnd(source: string, open: number): number {
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

/** An ALLCAPS display beside a name that is not ALLCAPS is a source read as a display. */
const SOURCE_LIKE = /^[A-Z]{2,6}$/;

type Violation = { rule: string; detail: string };
const violations: Violation[] = [];
const report = (rule: string, detail: string): void => {
  if (violations.length < 40) violations.push({ rule, detail });
};

let strings = 0;
let tokens = 0;
let rolls = 0;
const unregistered = new Map<string, number>();

for (const file of jsonFiles(vendor)) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    continue;
  }

  for (const source of tagged(parsed)) {
    strings += 1;
    let found: Token[];
    try {
      found = parseTags(source);
    } catch (error) {
      report("throws", `${file}: ${String(error)} — ${source.slice(0, 80)}`);
      continue;
    }
    tokens += found.length;

    for (const match of source.matchAll(/\{@(\w+)/g)) {
      const tag = match[1] ?? "";
      if (!KNOWN_TAGS.has(tag)) {
        unregistered.set(tag, (unregistered.get(tag) ?? 0) + 1);
        continue;
      }
      const close = spanEnd(source, match.index);
      if (close === -1) continue;
      const span = source.slice(match.index, close + 1);
      if (parseTags(span).length === 0) {
        report("registered tag renders nothing", `${file}: ${span}`);
      }
    }

    const rendered = renderText(found);
    if (rendered.includes("{@")) {
      report("markup survives a render", `${file}: ${rendered.slice(0, 90)}`);
    }

    for (const token of flat(found)) {
      if (token.kind === "ref") {
        if (token.display === "") report("ref with no display", `${file}: ${token.name}`);
        if (token.source !== undefined && token.display === token.source) {
          report("ref displays its own source", `${file}: {@${token.tag}} -> ${token.display}`);
        }
        if (SOURCE_LIKE.test(token.display) && !SOURCE_LIKE.test(token.name)) {
          report(
            "ref display looks like a source code",
            `${file}: {@${token.tag} ${token.name}} -> ${token.display}`,
          );
        }
      }
      if (token.kind === "roll") {
        rolls += 1;
        let accepted = true;
        try {
          rollDice(token.notation);
        } catch {
          accepted = false;
        }
        if (token.rollable !== accepted) {
          report(
            "rollable disagrees with @dnd/dice",
            `${file}: "${token.notation}" rollable=${token.rollable}, dice says ${accepted}`,
          );
        }
      }
    }
  }
}

console.log(`${strings} tagged strings, ${tokens} tokens, ${rolls} rolls, from ${vendor}`);

// Not a violation: an unknown tag is meant to degrade. But every wrong rendering this
// audit cannot detect has so far been a tag on this list, so it is worth printing.
const unknown = [...unregistered].sort((a, b) => b[1] - a[1]);
if (unknown.length > 0) {
  console.log(`\n${unknown.length} tags fall through to plain text:`);
  for (const [tag, count] of unknown.slice(0, 25)) {
    console.log(`  ${String(count).padStart(6)}  {@${tag}}`);
  }
  console.log("  check any of these against renderdemo.json before trusting the output");
}

if (violations.length === 0) {
  console.log("no violations");
  process.exit(0);
}

const byRule = new Map<string, number>();
for (const { rule } of violations) byRule.set(rule, (byRule.get(rule) ?? 0) + 1);
for (const [rule, count] of byRule) console.error(`\n${rule} (${count} shown)`);
for (const { rule, detail } of violations) console.error(`  ${rule}: ${detail}`);
process.exit(1);
