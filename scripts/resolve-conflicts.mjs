/**
 * Resolves what a merge of `origin/main` into a pull request's branch can settle without a
 * judgment, and writes up the rest for whoever owns it.
 *
 * Run `node scripts/resolve-conflicts.mjs <pr>` in the branch's checkout while the merge
 * stands conflicted. A Markdown file whose every conflict is table rows both sides added
 * takes both, `main`'s first, and is staged. Every other conflict is left in place and
 * quoted under the file, which names who resolves it: the repo owner for a fenced path, the
 * pull request's author otherwise. Exits 0 where nothing is left, so the caller commits;
 * 1 where the report lists something, so the caller aborts the merge and hands it over.
 */
import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { capture } from "./capture.mjs";
import { FENCE } from "./merge-gate.mjs";

const HUNK = /^<{7} [^\n]*\n([\s\S]*?)^\|{7}[^\n]*\n([\s\S]*?)^={7}\n([\s\S]*?)^>{7}[^\n]*\n/gm;

/**
 * Body rows only: a blank line or a separator row means a side adds a whole table, and two
 * tables fused into one would carry the second header as a row.
 */
const isRows = (side) =>
  side !== "" &&
  side
    .slice(0, -1)
    .split("\n")
    .every((l) => l.startsWith("|") && !/^\|[\s:|-]+$/.test(l));

/** An odd count of fence lines before `offset` puts it inside a code block. */
const inCode = (text, offset) =>
  (text.slice(0, offset).match(/^ {0,3}(`{3}|~{3})/gm) ?? []).length % 2 === 1;

/**
 * Settles each diff3 hunk where the base is empty and both sides hold only table rows:
 * two independent additions. A hunk with a base edits a row one side kept, so taking
 * both would duplicate it, and stays a conflict; so does a hunk inside a code block, where
 * a `|` line is a union type rather than a row.
 *
 * @param {string} text a file holding diff3 conflict markers
 * @returns {{ text: string, unresolved: string[] }}
 */
export function resolveRows(text) {
  const unresolved = [];
  const resolved = text.replace(HUNK, (hunk, ours, base, theirs, offset) => {
    if (base === "" && isRows(ours) && isRows(theirs) && !inCode(text, offset)) {
      const rows = theirs.split("\n").filter(Boolean);
      return [...rows, ...ours.split("\n").filter((r) => r && !rows.includes(r))]
        .map((r) => `${r}\n`)
        .join("");
    }
    unresolved.push(hunk.trimEnd());
    return hunk;
  });
  return { text: resolved, unresolved };
}

/**
 * Reads one conflicted file back with diff3 markers and LF endings, or "" where it has
 * none, and whether the working tree holds it with CRLF so a write can restore them.
 */
function marked(git, file, path) {
  try {
    git("checkout", "--conflict=diff3", "--", file);
    const raw = readFileSync(path, "utf8");
    return { text: raw.replaceAll("\r\n", "\n"), crlf: raw.includes("\r\n") };
  } catch {
    // A delete or binary conflict has no diff3 form; it is reported without hunks.
    return { text: "", crlf: false };
  }
}

/**
 * Settles one conflicted file and stages it, or returns the hand-off lines naming its
 * owner and quoting what is left.
 */
function settle(git, file, path, pr) {
  const { text: original, crlf } = marked(git, file, path);
  const hunks = original.match(HUNK) ?? [];
  const { text, unresolved } = resolveRows(original);
  const settles = file.endsWith(".md") && !FENCE.test(file);
  if (settles && hunks.length > 0 && unresolved.length === 0) {
    writeFileSync(path, crlf ? text.replaceAll("\n", "\r\n") : text);
    git("add", "--", file);
    return [];
  }
  const quoted = settles ? unresolved : hunks.map((h) => h.trimEnd());
  const owner = FENCE.test(file) ? "the repo owner (fenced path)" : `the author of #${pr}`;
  return [
    `${file} — ${owner}`,
    ...(quoted.length > 0 ? quoted : ["no conflict markers: a delete, rename or binary conflict"]),
  ];
}

/**
 * @param {string} pr
 * @param {string} [cwd]
 * @returns {string | null} the hand-off, or null where every conflict resolved
 */
export function resolveConflicts(pr, cwd) {
  const git = (...args) => capture("git", args, { cwd });
  const files = git("diff", "--name-only", "--diff-filter=U").split("\n").filter(Boolean);
  const handOff = files.flatMap((file) => settle(git, file, join(cwd ?? ".", file), pr));
  if (handOff.length === 0) return null;
  const base = git("rev-parse", "MERGE_HEAD").trim();
  return [`#${pr} conflicts with main at ${base}:`, ...handOff].join("\n");
}

if (process.argv[1] !== undefined && import.meta.filename === realpathSync(process.argv[1])) {
  const pr = process.argv[2];
  if (!/^\d+$/.test(pr ?? "")) {
    console.error("usage: node scripts/resolve-conflicts.mjs <pr>");
    process.exit(2);
  }
  const report = resolveConflicts(pr);
  if (report === null) console.log("resolved");
  else {
    console.log(report);
    process.exit(1);
  }
}
