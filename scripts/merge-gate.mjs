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
import { realpathSync } from "node:fs";
import { capture } from "./capture.mjs";
import {
  expectedChecks,
  isGreen,
  missingChecks,
  noRequiredChecks,
  readChecks,
} from "./required-checks.mjs";

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
  /^(CLAUDE|CONTRIBUTING)\.md$|^content\.(lock|manifest)\.json$|^\.github\/|^\.claude\/skills\/|^packages\/api\/drizzle\/|^docs\/mockup\/components\//;

/**
 * A mockup renders only on the canvas, so the user approves it there rather than in the
 * diff, and the fenced line says so in place of the bare path.
 */
export function fenceNote(path) {
  return path.startsWith("docs/mockup/components/")
    ? `${path} — waits on the user's approval of the mockup on the canvas`
    : path;
}

export function notGreen(checks) {
  return checks.filter((c) => !isGreen(c)).map((c) => c.name);
}

/**
 * A required check that has not reported blocks like a red one: a head too new to judge
 * has not passed. A ruleset naming no required check blocks too: nothing says what to wait on.
 */
export function checksBlocked(checks, expected) {
  const unjudgeable = noRequiredChecks(expected);
  if (unjudgeable !== null) return unjudgeable;
  if (checks.length === 0) return "no check has reported on this head yet";
  const missing = missingChecks(expected, checks).map((name) => `${name} (not reported)`);
  const blocked = [...notGreen(checks), ...missing];
  return blocked.length === 0 ? null : blocked.join(", ");
}

/** The line `converge-review` step 2 opens a pass body with. It renders as nothing on GitHub. */
export const PASS_MARKER = "<!-- audit-pass -->";

/**
 * The audit passes, oldest first. A pass carries `PASS_MARKER`; the verdict replies land as
 * reviews with no body at all, and a human's review carries neither, so neither spends one
 * of `PASS_CAP` nor stands in as the last pass whose findings this reads.
 *
 * Where no review carries the marker the bodied ones are the passes, which is how a pull
 * request reviewed before the marker existed still reaches the gate. That fallback reads a
 * human's "LGTM" as a pass, as the gate always did — a pull request holding both takes the
 * marked ones alone, so the mix only costs the passes posted before the marker landed.
 */
export function passes(reviews) {
  const bodied = reviews.filter((r) => r.body !== "");
  const marked = bodied.filter((r) => r.body.includes(PASS_MARKER));
  return marked.length === 0 ? bodied : marked;
}

export function blockingFindings(comments) {
  return comments.filter((c) => severity(c.body) !== "comment").map((c) => c.html_url);
}

/**
 * The passes a run spends before this condition stops asking for a clean one.
 * `converge-review` step 4 loops against this number rather than carrying one of its own.
 */
export const PASS_CAP = 3;

const plural = (n, noun) => `${n} ${noun}${n === 1 ? "" : "s"}`;

/**
 * Where the last pass sits against the tip, printed on every run beside "the review
 * converged". No condition reads it, because what a later commit means is a judgment: the
 * fix answering that pass, or code nobody has read. The number is what lets a reader tell
 * the two apart, which a verdict alone cannot, and the range it names is what lets them
 * read the commits — a count excluding `origin/main` is not the count a plain `sha..head`
 * returns, so the line hands over the one that produced it.
 *
 * @param {string | null} sha
 * @param {string} head
 * @param {number | null} behind
 */
export function staleNote(sha, head, behind) {
  if (sha === null) return null;
  const short = sha.slice(0, 8);
  if (behind === null) return `the last pass read ${short}, which is not on this branch`;
  if (behind === 0) return `the last pass read ${short}, the tip of this branch`;
  return `the last pass read ${short}, with ${plural(behind, "commit")} of this branch's own since — git log ${short}..${head.slice(0, 8)} ^origin/main`;
}

/**
 * The pass that reads a fix is what answers the finding, so this wants a last pass whose
 * findings are all `comment`. A pass that found nothing satisfies it by posting a body and
 * no comments, which is the only record the gate has that the code was read again. At
 * `PASS_CAP` it stops asking: "every thread carries a verdict" and "no declined finding is
 * critical or warning" already hold the fix, and demanding a pass the run may not take
 * leaves a hand merge as the only way out.
 */
export function reviewBlocked(reviews, findings) {
  const count = passes(reviews).length;
  if (count === 0) return "no review pass found — nothing has reviewed this";
  const blocking = blockingFindings(findings);
  if (blocking.length === 0 || count >= PASS_CAP) return null;
  return [
    `pass ${count} of ${PASS_CAP} returned a blocking finding — review again`,
    ...blocking,
  ].join("\n      ");
}

/**
 * What the cap did, printed beside the condition whether it passed or not — the two states
 * the condition itself cannot show. At the cap it names the waiver, since a condition that
 * stops asking in silence is a condition nobody audits. Past the cap it names the overage
 * rather than blocking: a submitted review cannot be withdrawn and any bodied one counts, a
 * human's "LGTM" included, so a block there is one nothing clears.
 */
export function capNote(reviews, findings) {
  const count = passes(reviews).length;
  if (count > PASS_CAP)
    return `${count} passes, past the cap of ${PASS_CAP} — read the extra passes before merging`;
  if (count === PASS_CAP && blockingFindings(findings).length > 0)
    return `the cap of ${PASS_CAP} passes stopped this condition asking — the thread verdicts carry what it found`;
  return null;
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
 * a judgment the user has not seen — unless an `**Accepted**` reply in the same thread
 * records that they have. That reply is a second comment, never the decline's own wording,
 * because `user-signoff` is the only sanctioned way to write one: an agent declining a
 * finding for itself cannot also mark it seen.
 */
const DECLINED = /^\*\*Declined\*\*/;
const ACCEPTED = /^\*\*Accepted\*\*/;

export function blockingDeclines(comments) {
  const findings = new Map(comments.map((c) => [String(c.id), c.body]));
  const accepted = new Set(
    comments.filter((c) => ACCEPTED.test(c.body)).map((c) => String(c.in_reply_to_id)),
  );
  return comments
    .filter((c) => DECLINED.test(c.body))
    .filter((c) => severity(findings.get(String(c.in_reply_to_id))) !== "comment")
    .filter((c) => !accepted.has(String(c.in_reply_to_id)))
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

export const UNLINKED = "the pull request is not linked to its issue";

/**
 * The issue `open-pr` names on the body's first line must come back in GitHub's
 * `closingIssuesReferences`. GitHub has dropped that link with the body intact, which leaves
 * the pull request off the issue and the board, so this reads the link and not the body.
 * It warns rather than blocks: the fault is GitHub's and only a hand link repairs it, while
 * the squash commit's `Closes` line still closes the issue.
 *
 * @param {string} body
 * @param {number[]} closing
 */
export function linkNote(body, closing) {
  const named = /^Closes #(\d+)$/.exec(body.split("\n")[0].trim())?.[1];
  if (named === undefined) return "the body does not open with Closes #<issue>";
  if (closing.includes(Number(named))) return null;
  return `GitHub has not linked #${named} — link it from the pull request's Development box`;
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

const gh = (args) => JSON.parse(capture("gh", args));

const git = (args) => capture("git", args).trim();

function show(ref, path) {
  try {
    return JSON.parse(capture("git", ["show", `${ref}:${path}`]));
  } catch {
    return null;
  }
}

/**
 * How many of the branch's own commits on `head` the last pass never saw, or null where the
 * branch does not carry the pass's `commit_id` — a review left on another head relates to
 * nothing here, so a distance from it would count a different branch's work.
 *
 * `^origin/main` keeps the behind-branch recovery out of that count: the recovery merges
 * `main` in, and everything it carries arrived with a review of its own.
 *
 * @param {string | null} sha
 * @param {string} head
 * @param {string | undefined} [cwd]
 * @returns {number | null}
 */
export function sinceLastPass(sha, head, cwd) {
  if (sha === null) return null;
  try {
    capture("git", ["merge-base", "--is-ancestor", sha, head], { stdio: "ignore", cwd });
  } catch {
    return null;
  }
  const count = capture("git", ["rev-list", "--count", `${sha}..${head}`, "^origin/main"], { cwd });
  return Number(count.trim());
}

function gate(n) {
  const api = (path) => gh(["api", "--paginate", path]);
  const failures = [];
  const report = (ok, condition, detail) => {
    console.log(`${ok ? "pass" : "FAIL"}  ${condition}${ok ? "" : `\n      ${detail}`}`);
    if (!ok) failures.push(condition);
  };

  let checkFailure;
  try {
    checkFailure = checksBlocked(readChecks(n), expectedChecks());
  } catch (error) {
    checkFailure = `could not read the required checks: ${error.message}`;
  }
  report(checkFailure === null, "every check is green", checkFailure);

  const head = gh(["pr", "view", n, "--json", "headRefOid"]).headRefOid;
  capture("git", ["fetch", "--quiet", "origin", "main", head]);

  const reviews = api(`repos/{owner}/{repo}/pulls/${n}/reviews`);
  const pass = passes(reviews).at(-1) ?? null;
  const findings =
    pass === null ? [] : api(`repos/{owner}/{repo}/pulls/${n}/reviews/${pass.id}/comments`);
  const reviewFailure = reviewBlocked(reviews, findings);
  report(reviewFailure === null, "the review converged", reviewFailure);
  const note = capNote(reviews, findings);
  if (note !== null) console.log(`      ${note}`);
  const readSha = pass?.commit_id ?? null;
  const age = staleNote(readSha, head, sinceLastPass(readSha, head));
  if (age !== null) console.log(`      ${age}`);
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

  const base = git(["merge-base", "origin/main", head]);
  const changed = git(["diff", "--name-only", base, head]).split("\n").filter(Boolean);
  const fenced = changed.filter((p) => FENCE.test(p));
  const bumped = changed
    .filter((p) => /(^|\/)package\.json$/.test(p))
    .filter((p) => dependenciesDiffer(show(base, p), show(head, p)));
  report(
    fenced.length === 0 && bumped.length === 0,
    "the diff reaches no fenced path",
    [...fenced.map(fenceNote), ...bumped].join("\n      "),
  );

  const pr = gh([
    "pr",
    "view",
    n,
    "--json",
    "body,closingIssuesReferences,mergeable,mergeStateStatus",
  ]);
  const unlinked = linkNote(
    pr.body,
    pr.closingIssuesReferences.map((i) => i.number),
  );
  if (unlinked !== null) console.log(`warn  ${UNLINKED}\n      ${unlinked}`);

  const conflict = mergeBlocked(pr);
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
