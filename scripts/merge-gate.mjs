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
 * An empty rollup is not a green one: the required checks run on every pull request, so
 * nothing reporting means the head is too new to judge rather than that it passed.
 */
export function checksBlocked(checks) {
  if (checks.length === 0) return "no check has reported on this head yet";
  const red = notGreen(checks);
  return red.length === 0 ? null : red.join(", ");
}

/** The line `issue-to-pr` step 11 opens a pass body with. It renders as nothing on GitHub. */
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
 * `issue-to-pr` step 13 loops against this number rather than carrying one of its own.
 */
export const PASS_CAP = 3;

/**
 * Prose the last pass's judgment does not rest on. A fix ships its prose pass in the same
 * commit, so a commit touching only these after the last pass answers that pass rather
 * than adding code nobody read. `CLAUDE.md`, `CONTRIBUTING.md` and a `SKILL.md` are
 * instructions rather than prose, and a rewritten fence is exactly what a pass must read —
 * what makes the exemption safe there is `FENCE`, which stops all three on its own
 * condition.
 */
const PROSE = /\.md$/;

const plural = (n, noun) => `${n} ${noun}${n === 1 ? "" : "s"}`;

/**
 * @typedef {object} Since
 * @property {{ sha: string, subject: string }[] | null} commits the commits between the
 *   last pass and the tip, or null where the branch does not carry the pass's `commit_id`
 * @property {string[]} changed the paths those commits changed
 */

/**
 * Whether the commits after the last pass changed code that pass never read. `commits` is
 * null where the branch does not carry the pass's `commit_id` — a review left on a head
 * this branch never had relates to nothing here, and a block there is one nothing clears.
 *
 * @param {Since} since
 */
export function staleBlocked({ commits, changed }) {
  if (commits === null) return null;
  const source = changed.filter((path) => !PROSE.test(path));
  if (source.length === 0) return null;
  return [
    `${plural(commits.length, "commit")} after the last pass changed ${plural(source.length, "file")} that the pass never read — review again`,
    ...commits.map((c) => `${c.sha.slice(0, 8)}  ${c.subject}`),
  ].join("\n      ");
}

/**
 * Where the last pass sits against the tip, printed whether the condition passed or
 * failed. A verdict alone cannot separate a pass anchored at the tip from one that skipped
 * a prose-only commit.
 *
 * @param {string | null} sha
 * @param {Since} since
 */
export function staleNote(sha, { commits }) {
  if (sha === null) return null;
  const short = sha.slice(0, 8);
  if (commits === null) return `the last pass read ${short}, which is not on this branch`;
  if (commits.length === 0) return `the last pass read ${short}, the tip of this branch`;
  return `the last pass read ${short}, ${plural(commits.length, "commit")} behind the tip`;
}

/**
 * The pass that reads a fix is what answers the finding, so this wants a last pass whose
 * findings are all `comment` and whose `commit_id` carries the code being merged. A pass
 * that found nothing satisfies the first by posting a body and no comments, which is the
 * only record the gate has that the code was read again. At `PASS_CAP` it stops asking on
 * both counts: "every thread carries a verdict" and "no declined finding is critical or
 * warning" already hold the fix, and demanding a pass the run may not take leaves a hand
 * merge as the only way out.
 *
 * @param {Since} since
 */
export function reviewBlocked(reviews, findings, since) {
  const count = passes(reviews).length;
  if (count === 0) return "no review pass found — nothing has reviewed this";
  if (count >= PASS_CAP) return null;
  const blocking = blockingFindings(findings);
  if (blocking.length > 0)
    return [
      `pass ${count} of ${PASS_CAP} returned a blocking finding — review again`,
      ...blocking,
    ].join("\n      ");
  return staleBlocked(since);
}

/**
 * What the cap did, printed beside the condition whether it passed or not — the two states
 * the condition itself cannot show. At the cap it names each waiver, since a condition that
 * stops asking in silence is a condition nobody audits. Past the cap it names the overage
 * rather than blocking: a submitted review cannot be withdrawn and any bodied one counts, a
 * human's "LGTM" included, so a block there is one nothing clears.
 *
 * @param {Since} since
 */
export function capNote(reviews, findings, since) {
  const count = passes(reviews).length;
  if (count > PASS_CAP)
    return `${count} passes, past the cap of ${PASS_CAP} — read the extra passes before merging`;
  const waived = [
    blockingFindings(findings).length > 0 ? "a blocking finding the thread verdicts carry" : null,
    staleBlocked(since) === null ? null : "commits the last pass never read",
  ].filter(Boolean);
  if (count === PASS_CAP && waived.length > 0)
    return `the cap of ${PASS_CAP} passes stopped this condition asking — it waived ${waived.join(" and ")}`;
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

/**
 * The branch's own commits on `head` that the last pass never saw, and the paths they
 * changed. An unreachable `commit_id` reads as no relation rather than as an empty range,
 * so a review left on another head cannot pass the condition by looking like a pass at the
 * tip.
 *
 * `^origin/main` is what keeps the behind-branch recovery from reading main's commits as
 * unreviewed code: that recovery merges `main` in, and everything it carries arrived with a
 * review of its own. The cost is a union over the branch's commits rather than a net diff,
 * so a file changed and reverted after the pass asks for a pass it does not need, and a
 * merge commit contributes no paths at all — a conflict resolved by hand and pushed reads
 * as nothing. The server-side recovery refuses on conflict and `mergeBlocked` stops a
 * conflicting branch, so that is the one route left open.
 *
 * @param {string | null} sha
 * @param {string | undefined} [cwd]
 */
export function sinceLastPass(sha, head, cwd) {
  const unrelated = { commits: null, changed: [] };
  if (sha === null) return unrelated;
  const run = (args) => execFileSync("git", args, { encoding: "utf8", cwd }).trim();
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", sha, head], { stdio: "ignore", cwd });
  } catch {
    return unrelated;
  }
  const own = [`${sha}..${head}`, "^origin/main"];
  const commits = run(["log", "--format=%H %s", ...own])
    .split("\n")
    .filter(Boolean)
    .map((line) => ({ sha: line.slice(0, 40), subject: line.slice(41) }));
  const changed = run(["log", "--name-only", "--format=", ...own])
    .split("\n")
    .filter(Boolean);
  return { commits, changed: [...new Set(changed)] };
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
  const checkFailure = checksBlocked(checks);
  report(checkFailure === null, "every check is green", checkFailure);

  const head = gh(["pr", "view", n, "--json", "headRefOid"]).headRefOid;
  execFileSync("git", ["fetch", "--quiet", "origin", "main", head]);

  const reviews = api(`repos/{owner}/{repo}/pulls/${n}/reviews`);
  const pass = passes(reviews).at(-1) ?? null;
  const findings =
    pass === null ? [] : api(`repos/{owner}/{repo}/pulls/${n}/reviews/${pass.id}/comments`);
  const since = sinceLastPass(pass?.commit_id ?? null, head);
  const reviewFailure = reviewBlocked(reviews, findings, since);
  report(reviewFailure === null, "the review converged", reviewFailure);
  const note = capNote(reviews, findings, since);
  if (note !== null) console.log(`      ${note}`);
  const age = staleNote(pass?.commit_id ?? null, since);
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
