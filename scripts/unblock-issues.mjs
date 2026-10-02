/**
 * Clears a closed issue from every open issue's `## Blocked by` section.
 *
 * `merge-pr` runs this against the issue it just closed. Like `merge-gate.mjs`, this file
 * keeps pure text functions here and `gh` orchestration in `run`, called only from the CLI
 * guard at the bottom.
 *
 * A `## Blocked by` section is prose, not a list a parser can trust structurally. Each
 * paragraph, and each sentence opening with an issue reference, is its own list, split on
 * commas and "and". A term opens with an issue reference (`#NNN`, optionally after "and").
 * Any other piece continues the term before it where it opens with a subordinating word
 * ("for", "which", …), or where "and" joins it to a term that already describes an issue,
 * so "#459, for the attack and damage chips" stays one term. Anything else starts its own
 * unnumbered term, such as "the picker" naming work with no issue yet.
 *
 * A term belongs to the issue it opens with, so a closed issue its description only
 * mentions leaves it standing.
 *
 * The reading is a heuristic with three misreads. A bare appositive ("#239, the level-up
 * flow.") reads as two terms; `stillBlocked` counts a term with no issue number as
 * blocking, since it has nothing to check against `open`, so the label outlives #239. The
 * other two clear a real blocker. An unnumbered blocker joined by "and" after a described
 * issue ("#77 for the list route and class columns") reads as part of that description and
 * clears with #77. An issue on the next line with no period or blank line before it
 * ("#75 for the route\n#77 for the list.") reads as part of the term above and clears with
 * #75; a line break does not end a term, because sections wrap mid-sentence ("and\n#75").
 * Give such a blocker its own paragraph or sentence, or list it before the issues.
 */
import { realpathSync } from "node:fs";
import { capture } from "./capture.mjs";

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

const UNIT_BREAK = /(\n\s*\n|(?<=\.)\s+(?=#\d))/;
const SEPARATOR = /(\s*,\s*|\s+and\s+)/;
const STARTS_TERM = /^(?:and\s+)?#\d+/;
const BARE_REFERENCE = /^#\d+$/;
const CONTINUATION = /^(for|which|since|because|though|the reason)\b/i;

function splitTerms(paragraph) {
  const parts = paragraph.replace(/\.\s*$/, "").split(SEPARATOR);
  const terms = [];
  for (let i = 0; i < parts.length; i += 2) {
    const piece = parts[i];
    if (!piece) continue;
    const last = terms.at(-1);
    const joinedByAnd = /and/.test(parts[i - 1]) || /^and\s/.test(piece);
    const describesIssue = last !== undefined && /^#\d+/.test(last) && !BARE_REFERENCE.test(last);
    if (
      last !== undefined &&
      !STARTS_TERM.test(piece) &&
      ((describesIssue && joinedByAnd) || CONTINUATION.test(piece))
    ) {
      terms[terms.length - 1] += parts[i - 1] + piece;
    } else {
      terms.push(piece.replace(/^and\s+/, ""));
    }
  }
  return terms;
}

function joinTerms(terms) {
  if (terms.length === 0) return null;
  if (terms.length === 1) return `${terms[0]}.`;
  return `${terms.slice(0, -1).join(", ")} and ${terms.at(-1)}.`;
}

const opensWith = (term, closed) => new RegExp(`^#${closed}\\b`).test(term);

const units = (section) => section.split(UNIT_BREAK).filter((_, i) => i % 2 === 0);

function remainingTerms(section, closed) {
  return units(section)
    .flatMap(splitTerms)
    .filter((t) => !opensWith(t, closed));
}

function rebuildSection(section, closed) {
  const parts = section.split(UNIT_BREAK);
  let rebuilt = "";
  for (let i = 0; i < parts.length; i += 2) {
    const terms = splitTerms(parts[i]);
    const kept = terms.filter((t) => !opensWith(t, closed));
    const text = kept.length === terms.length ? parts[i] : joinTerms(kept);
    if (text) rebuilt += (rebuilt ? parts[i - 1] : "") + text;
  }
  return rebuilt;
}

/** Removes only `closed`'s term, keeping every other term the section names. */
export function removeBlockerTerm(body, closed) {
  const section = blockedBySection(body);
  if (section === null) return body;
  const rebuilt = rebuildSection(section, closed);
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

/**
 * Whether the section still has something blocking once `closed`'s term is gone. A
 * remaining term with no issue number can't be checked against `open`, so it counts as
 * still blocking by default — the section is prose the script cannot resolve, not a
 * blocker it can clear.
 */
export function stillBlocked(body, closed, open) {
  const section = blockedBySection(body);
  if (section === null) return false;
  return remainingTerms(section, closed).some((term) => {
    const refs = referencedIssues(term);
    return refs.length === 0 || refs.some((n) => open.has(n));
  });
}

const gh = (args) => JSON.parse(capture("gh", args));

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
    const keepSection = stillBlocked(issue.body, closed, open);
    const body = clearBlocker(issue.body, closed, keepSection);
    const args = ["issue", "edit", String(issue.number), "--body", body];
    if (!keepSection) args.push("--remove-label", "blocked");
    capture("gh", args);
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
