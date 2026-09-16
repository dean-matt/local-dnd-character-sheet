/**
 * The six conditions that decide whether a pull request is fit to land.
 *
 * `merge-pr` runs this and stops where it exits non-zero, handing the user the condition
 * it named. Every decision is a pure function over the shapes GitHub returns, which is
 * what lets `tests/merge-gate.test.ts` call them on payloads copied from real reviews.
 *
 * Running the file gathers the inputs with `gh` and `git`, prints a line per condition,
 * and exits 1 where any of them blocks.
 */
import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";

/**
 * The severity marker `audit-pr` writes at the head of a posted finding. A body this
 * cannot read is `unreadable`, which blocks: a finding the gate cannot classify is the
 * one it must not wave through.
 */
const MARKER = /^\*\*(critical|warning|comment)\*\*/;

export function severity(body) {
  return MARKER.exec(body ?? "")?.[1] ?? "unreadable";
}

/** Files where a wrong merge costs more than the wait. */
export const FENCE =
  /^(CLAUDE|CONTRIBUTING)\.md$|^content\.(lock|manifest)\.json$|^\.github\/|^\.claude\/skills\/|^packages\/api\/drizzle\//;

export function notGreen(checks) {
  return checks.filter((c) => c.bucket !== "pass" && c.bucket !== "skipping").map((c) => c.name);
}

/**
 * A pass is a review carrying a body; the verdict replies land as reviews with none. Any
 * bodied review counts, so a human's "LGTM" posted after an audit pass becomes the pass
 * and its findings go uncounted. Keying on the pass's own comments would close that.
 */
export function lastPass(reviews) {
  return reviews.filter((r) => r.body !== "").at(-1) ?? null;
}

export function blockingFindings(comments) {
  return comments.filter((c) => severity(c.body) !== "comment").map((c) => c.html_url);
}

const VERDICT = /^\*\*(Applied|Declined)\*\*/;

/**
 * The API omits `in_reply_to_id` on a top-level comment rather than sending null, so a
 * strict comparison against null matches nothing and the condition passes everything.
 */
const isFinding = (c) => c.in_reply_to_id === undefined || c.in_reply_to_id === null;

export function unanswered(comments) {
  const answered = new Set(
    comments.filter((c) => VERDICT.test(c.body)).map((c) => String(c.in_reply_to_id)),
  );
  return comments.filter((c) => isFinding(c) && !answered.has(String(c.id))).map((c) => c.html_url);
}

/**
 * A declined `comment` is a taste call refused and ends a healthy review; anything else is
 * a judgment the user has not seen.
 */
const DECLINED = /^\*\*Declined\*\*/;

export function blockingDeclines(comments) {
  const findings = new Map(comments.map((c) => [String(c.id), c.body]));
  return comments
    .filter((c) => DECLINED.test(c.body))
    .filter((c) => severity(findings.get(String(c.in_reply_to_id))) !== "comment")
    .map((c) => c.html_url);
}

/**
 * A non-null return blocks the merge and is the sentence the user reads, so a branch that
 * is only behind takes its own: `merge-pr` recovers that one by merging `main` in, and
 * cannot recover a conflict.
 */
export function mergeBlocked({ mergeable, mergeStateStatus }) {
  if (mergeable === "CONFLICTING" || mergeStateStatus === "DIRTY") return "the branch conflicts";
  if (mergeable === "UNKNOWN") return "GitHub is still computing mergeability — ask again";
  if (mergeStateStatus === "BEHIND")
    return "the branch is behind main — update it, then run the checks and the gate again";
  return null;
}

const DEP_KEYS = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];

/** A version bump stops the merge; a rename, a reordered script or a reordered map does not. */
export function dependenciesDiffer(before, after) {
  const sorted = (v) =>
    v === null || typeof v !== "object" || Array.isArray(v)
      ? v
      : Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)));
  const pick = (pkg) =>
    JSON.stringify([...DEP_KEYS, "pnpm"].map((k) => [k, sorted(pkg?.[k] ?? null)]));
  return pick(before) !== pick(after);
}

const gh = (args) => JSON.parse(execFileSync("gh", args, { encoding: "utf8" }));

function tolerate(read, fallback) {
  try {
    return read();
  } catch {
    return fallback;
  }
}
const git = (args) => execFileSync("git", args, { encoding: "utf8" }).trim();

function show(ref, path) {
  try {
    return JSON.parse(execFileSync("git", ["show", `${ref}:${path}`], { encoding: "utf8" }));
  } catch {
    return null;
  }
}

function gate(n) {
  const api = (path) => gh(["api", "--paginate", path]);
  const failures = [];
  const report = (ok, condition, detail) => {
    console.log(`${ok ? "pass" : "FAIL"}  ${condition}${ok ? "" : `\n      ${detail}`}`);
    if (!ok) failures.push(condition);
  };

  // gh exits non-zero where no check has reported at all, which is not a bucket.
  const checks = tolerate(() => gh(["pr", "checks", n, "--json", "name,bucket"]), []);
  const red = notGreen(checks);
  report(red.length === 0, "every check is green", red.join(", "));

  const pass = lastPass(api(`repos/{owner}/{repo}/pulls/${n}/reviews`));
  if (pass === null) console.log("      no review pass found — nothing has reviewed this");
  const findings =
    pass === null ? [] : api(`repos/{owner}/{repo}/pulls/${n}/reviews/${pass.id}/comments`);
  const blocking = blockingFindings(findings);
  report(
    blocking.length === 0,
    "the last pass returned only comment findings",
    blocking.join("\n      "),
  );
  if (pass !== null)
    console.log(`      the pass body is review ${pass.id} — read it for a finding no line anchors`);

  const comments = api(`repos/{owner}/{repo}/pulls/${n}/comments`);
  const open = unanswered(comments);
  report(open.length === 0, "every thread carries a verdict", open.join("\n      "));
  const declined = blockingDeclines(comments);
  report(
    declined.length === 0,
    "no declined finding is critical or warning",
    declined.join("\n      "),
  );

  const head = gh(["pr", "view", n, "--json", "headRefOid"]).headRefOid;
  execFileSync("git", ["fetch", "--quiet", "origin", "main", head]);
  const base = git(["merge-base", "origin/main", head]);
  const changed = git(["diff", "--name-only", base, head]).split("\n").filter(Boolean);
  const fenced = changed.filter((p) => FENCE.test(p));
  const bumped = changed
    .filter((p) => /(^|\/)package\.json$/.test(p))
    .filter((p) => dependenciesDiffer(show(base, p), show(head, p)));
  report(
    fenced.length === 0 && bumped.length === 0,
    "the diff reaches no fenced path",
    [...fenced, ...bumped].join("\n      "),
  );

  const conflict = mergeBlocked(gh(["pr", "view", n, "--json", "mergeable,mergeStateStatus"]));
  report(conflict === null, "the branch merges cleanly", conflict);

  return failures;
}

if (process.argv[1] !== undefined && import.meta.filename === realpathSync(process.argv[1])) {
  const n = process.argv[2];
  if (n === undefined) {
    console.error("usage: node scripts/merge-gate.mjs <pr>");
    process.exit(2);
  }
  const failures = gate(n);
  if (failures.length > 0) {
    console.error(`\n${failures.length} condition(s) block the merge. Hand each to the user.`);
    process.exit(1);
  }
  console.log("\nall six conditions hold");
}
