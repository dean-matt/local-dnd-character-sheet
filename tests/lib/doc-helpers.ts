/**
 * Shared mechanics for the document shape tests.
 *
 * Each document has its own test file with its own rules — only the genuinely
 * mechanical parts live here. A fenced code block is not a heading in any of
 * them, and history is history wherever it is written.
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const ROOT = resolve(import.meta.dirname, "../..");

export function read(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

/**
 * The document with fenced blocks removed. A `# One time` comment inside a bash
 * block is not a heading, and a path inside one is not a link.
 */
function prose(markdown: string): string {
  let fenced = false;
  return markdown
    .split("\n")
    .map((line) => {
      if (line.trimStart().startsWith("```")) {
        fenced = !fenced;
        return "";
      }
      return fenced ? "" : line;
    })
    .join("\n");
}

export function headings(markdown: string, level: number): string[] {
  const pattern = new RegExp(`^#{${level}}\\s+(.+?)\\s*$`, "gm");
  return [...prose(markdown).matchAll(pattern)].map((m) => m[1] as string);
}

export function deepHeadings(markdown: string, minLevel: number): string[] {
  const pattern = new RegExp(`^#{${minLevel},}\\s+(.+?)\\s*$`, "gm");
  return [...prose(markdown).matchAll(pattern)].map((m) => m[1] as string);
}

/**
 * The file each relative link points at. An http, mailto or in-page link names no file,
 * and a fragment names a heading inside one, so both drop out — only a path can dangle.
 *
 * A `](` the pattern cannot read throws rather than yielding nothing. A link that
 * vanishes is the worst outcome available: the dangling path it held passes the
 * existence check, and the file it cited is reported as cited by nobody.
 */
const LINK = /\]\(\s*([^)\s]+)(?:\s+["'][^"']*["'])?\s*\)/g;
const EXTERNAL = /^(?:https?:|mailto:|#)/i;

export function links(markdown: string): string[] {
  const text = prose(markdown);
  const matched = [...text.matchAll(LINK)];
  const openers = [...text.matchAll(/\]\(/g)].length;
  if (matched.length !== openers) {
    throw new Error(
      `${openers - matched.length} link(s) in a form this fence cannot read — write each as [text](path)`,
    );
  }
  return matched
    .map((m) => m[1] as string)
    .filter((target) => !EXTERNAL.test(target))
    .map((target) => target.split("#")[0] as string)
    .filter((target) => target.length > 0);
}

export function lineCount(markdown: string): number {
  return markdown.trimEnd().split("\n").length;
}

/**
 * Phrasings that narrate a past revision rather than describing what is true.
 * A starting set, not a complete one — grow it from what later changes delete.
 */
const FORBIDDEN: { pattern: RegExp; why: string }[] = [
  { pattern: /previously (said|described|was)/i, why: "narrates a past revision" },
  { pattern: /\bused to (be|have|live)\b/i, why: "narrates a past revision" },
  { pattern: /\b(?:fixes|fixed|closes|closed) #\d+/i, why: "cites an issue as justification" },
  { pattern: /\bas of (PR )?#\d+/i, why: "cites a pull request as justification" },
  {
    pattern: /^[>\-*+\s]*(?:✅|:white_check_mark:)\s*\**\s*resolved/im,
    why: "a resolved-item entry",
  },
  { pattern: /\bTODO\b|\bFIXME\b/, why: "a task marker — file an issue instead" },
];

export function findForbidden(text: string): string[] {
  return FORBIDDEN.filter(({ pattern }) => pattern.test(text)).map(
    ({ pattern, why }) => `${pattern} — ${why}`,
  );
}
