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
