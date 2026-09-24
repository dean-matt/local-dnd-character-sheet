/**
 * Clears a closed issue from every open issue's `## Blocked by` section.
 *
 * `merge-pr` runs this against the issue it just closed. Like `merge-gate.mjs`, this file
 * keeps pure text functions here and `gh` orchestration in `run`, called only from the CLI
 * guard at the bottom.
 *
 * A `## Blocked by` section is prose, not a list a parser can trust structurally. A term
 * opens with an issue reference (`#NNN`, optionally after "and") or a subordinating word
 * ("for", "which", …) continuing the term before it; anything else starts its own
 * unnumbered term, such as "the picker" naming work with no issue yet.
 *
 * That reading matches every `## Blocked by` section this repository has written, but it
 * is a heuristic: a bare appositive with no subordinating word ("#239, the level-up
 * flow.") reads as two terms, not one description of #239. The cost only shows where the
 * section also names a second, open issue — the one case `removeBlockerTerm` runs — and
 * there it keeps the extra text rather than risk deleting a real blocker.
 */
import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";

const HEADING_LINE = /^## (.+)\n\n([\s\S]*)$/;

function sections(body) {
  return body.split(/\n(?=## )/).map((chunk) => {
    const m = HEADING_LINE.exec(chunk);
    return { heading: m?.[1]?.trim() ?? null, chunk };
  });
}

export function blockedBySection(body) {
  const content = sections(body).find((s) => s.heading === "Blocked by")?.chunk;
  return content === undefined ? null : content.replace(HEADING_LINE, "$2").replace(/\n+$/, "");
}

export function referencedIssues(section) {
  return section === null ? [] : [...section.matchAll(/#(\d+)/g)].map((m) => Number(m[1]));
}

const STARTS_TERM = /^(?:and\s+)?#\d+/;
const CONTINUATION = /^(for|which|since|because|though|the reason)\b/i;

function splitTerms(section) {
  const pieces = section
    .replace(/\.\s*$/, "")
    .split(/\s*,\s*|\s+and\s+/)
    .filter(Boolean);
  const terms = [];
  for (const piece of pieces) {
    const stripped = piece.replace(/^and\s+/, "");
    if (terms.length > 0 && !STARTS_TERM.test(piece) && CONTINUATION.test(piece)) {
      terms[terms.length - 1] += `, ${piece}`;
    } else {
      terms.push(stripped);
    }
  }
  return terms;
}

function joinTerms(terms) {
  if (terms.length === 0) return null;
  if (terms.length === 1) return `${terms[0]}.`;
  return `${terms.slice(0, -1).join(", ")} and ${terms.at(-1)}.`;
}

/** Removes only `closed`'s term, keeping every other term the section names. */
export function removeBlockerTerm(body, closed) {
  const section = blockedBySection(body);
  if (section === null) return body;
  const remaining = splitTerms(section).filter((t) => !new RegExp(`#${closed}\\b`).test(t));
  const rebuilt = joinTerms(remaining) ?? "";
  return sections(body)
    .map((s) =>
      s.heading === "Blocked by" ? `## Blocked by\n\n${rebuilt}${rebuilt ? "\n" : ""}` : s.chunk,
    )
    .join("\n");
}

/** Drops the whole `## Blocked by` heading and its content. */
export function removeSection(body) {
  return sections(body)
    .filter((s) => s.heading !== "Blocked by")
    .map((s) => s.chunk)
    .join("\n");
}

/** `keepSection` is whether another issue this section names is still open. */
export function clearBlocker(body, closed, keepSection) {
  return keepSection ? removeBlockerTerm(body, closed) : removeSection(body);
}

const gh = (args) => JSON.parse(execFileSync("gh", args, { encoding: "utf8" }));

function openIssueNumbers() {
  return new Set(
    gh(["issue", "list", "--state", "open", "--json", "number", "--limit", "500"]).map(
      (i) => i.number,
    ),
  );
}

function run(closed) {
  const open = openIssueNumbers();
  const candidates = gh([
    "issue",
    "list",
    "--state",
    "open",
    "--label",
    "blocked",
    "--json",
    "number,body",
    "--limit",
    "500",
  ]);
  const unblocked = [];
  for (const issue of candidates) {
    const refs = referencedIssues(blockedBySection(issue.body));
    if (!refs.includes(closed)) continue;
    const keepSection = refs.filter((n) => n !== closed).some((n) => open.has(n));
    const body = clearBlocker(issue.body, closed, keepSection);
    const args = ["issue", "edit", String(issue.number), "--body", body];
    if (!keepSection) args.push("--remove-label", "blocked");
    execFileSync("gh", args, { encoding: "utf8" });
    if (!keepSection) unblocked.push(issue.number);
  }
  return unblocked;
}

if (process.argv[1] !== undefined && import.meta.filename === realpathSync(process.argv[1])) {
  const closed = Number(process.argv[2]);
  if (!Number.isInteger(closed)) {
    console.error("usage: node scripts/unblock-issues.mjs <closed-issue>");
    process.exit(2);
  }
  const unblocked = run(closed);
  if (unblocked.length === 0) console.log("unblocked nothing");
  else for (const n of unblocked) console.log(`unblocked #${n}`);
}
