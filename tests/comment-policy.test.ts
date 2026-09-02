import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { ROOT, read } from "./lib/doc-helpers.ts";

/**
 * A comment explains why, never what. Git records history, so a comment that
 * narrates a change is duplicating a better source that cannot go stale.
 *
 * This checks comment lines only, using a deliberately conservative match: a
 * false positive here would push someone toward writing no comment at all.
 */
const SKIP_DIRS = new Set(["node_modules", "dist", "vendor", ".git", "data", "drizzle"]);
const EXTENSIONS = [".ts", ".tsx"];

/** Standards and identifiers that look like ticket keys but are not. */
const NOT_TICKET_KEYS = new Set([
  "SHA",
  "UTF",
  "RFC",
  "ISO",
  "HTTP",
  "AES",
  "RSA",
  "CRC",
  "MD",
  "ES",
  "TS",
  "SQL",
  "FTS",
  "UTC",
  "IPV",
  "PBKDF",
  "BASE",
]);

const TICKET_KEY = /\b([A-Z]{2,10})-\d+\b/g;

function citesTicketKey(text: string): boolean {
  return [...text.matchAll(TICKET_KEY)].some((m) => !NOT_TICKET_KEYS.has(m[1] as string));
}

const RULES: { pattern: RegExp; why: string }[] = [
  { pattern: /(?:^|\s)#\d+\b/, why: "cites an issue or pull request number" },
  { pattern: /\b(?:changed|renamed|moved|switched) from\b/i, why: "narrates a change" },
  { pattern: /\bused to\b/i, why: "narrates a past state" },
  { pattern: /\bpreviously\b/i, why: "narrates a past state" },
  { pattern: /\bwas\s+\w+\s+before\b/i, why: "narrates a past state" },
  { pattern: /\b(?:TODO|FIXME|XXX|HACK)\b/, why: "a task marker — file an issue instead" },
];

const COMMENTED_OUT =
  /^\s*\/\/\s*(?:(?:const|let|var|function|class|import|export|return|await|if|for|while)\b|.*[;{}]\s*$)/;

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || SKIP_DIRS.has(entry.name)) continue;
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(abs));
    else if (EXTENSIONS.some((e) => entry.name.endsWith(e))) out.push(relative(ROOT, abs));
  }
  return out;
}

function commentLines(source: string): { line: number; text: string }[] {
  return source
    .split("\n")
    .map((text, i) => ({ line: i + 1, text }))
    .filter(({ text }) => /^\s*(?:\/\/|\*|\/\*)/.test(text));
}

const files = sourceFiles(ROOT);

describe("comment policy", () => {
  it("finds source files to check", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)("%s has no comment narrating history", (file) => {
    const offences = commentLines(read(file)).flatMap(({ line, text }) => {
      const hits = RULES.filter(({ pattern }) => pattern.test(text)).map(({ why }) => why);
      if (citesTicketKey(text)) hits.push("cites a ticket key");
      return hits.map((why) => `${file}:${line} ${why}: ${text.trim()}`);
    });
    expect(offences).toEqual([]);
  });

  it.each(files)("%s has no commented-out code", (file) => {
    const offences = commentLines(read(file))
      .filter(({ text }) => COMMENTED_OUT.test(text))
      .map(({ line, text }) => `${file}:${line} commented-out code: ${text.trim()}`);
    expect(offences).toEqual([]);
  });
});
