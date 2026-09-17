import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  blockingDeclines,
  blockingFindings,
  capNote,
  checksBlocked,
  dependenciesDiffer,
  FENCE,
  mergeBlocked,
  notGreen,
  PASS_CAP,
  PASS_MARKER,
  passes,
  reviewBlocked,
  severity,
  sinceLastPass,
  staleBlocked,
  staleNote,
  unanswered,
} from "../scripts/merge-gate.mjs";
import { ROOT, read } from "./lib/doc-helpers.ts";

/**
 * The merge gate's conditions, called directly. Every body below is copied verbatim from
 * a review this repository already posted: one pass wrote its severities backticked and
 * another wrote them in bold, which is the drift the gate exists to survive. A body
 * composed to match the parser would assert the parser back to itself.
 *
 * The envelope matters as much as the body. The API omits `in_reply_to_id` on a top-level
 * comment rather than sending null, so `finding()` omits it too — a fixture that sets it
 * to null hides the one bug this condition can have.
 */
const BACKTICKED = '`comment` — "It invokes" has a loose antecedent: the nearest nouns are';
const BOLD = "**critical** — `for id in $red` runs once with both ids as a single word.";
const DECLINED = "**Declined** — the trade stands as described. Replacing elapsed time";

const finding = (id: number, body: string) => ({
  id,
  body,
  html_url: `https://example.invalid/#discussion_r${id}`,
});

const reply = (id: number, body: string, inReplyTo: number) => ({
  ...finding(id, body),
  in_reply_to_id: inReplyTo,
});

describe("severity", () => {
  it("reads the backticked form one pass posted as unreadable", () => {
    expect(severity(BACKTICKED)).toBe("unreadable");
  });

  it.each([
    ["", "empty"],
    [" **critical** — x", "indented"],
    ["path.ts:42\n**critical** — x", "prefixed"],
  ])("reads a %s body as unreadable (%s)", (body) => {
    expect(severity(body)).toBe("unreadable");
  });
});

describe("the review passes", () => {
  const ids = (reviews: { id: number; body: string }[]) =>
    passes(reviews).map((r: { id: number }) => r.id);

  it("are the marked reviews, never the verdict replies", () => {
    const reviews = [
      { id: 1, body: `${PASS_MARKER}\npass 1` },
      { id: 2, body: "" },
      { id: 3, body: `${PASS_MARKER}\npass 2` },
      { id: 4, body: "" },
    ];
    expect(ids(reviews)).toEqual([1, 3]);
  });

  /**
   * The reason the marker exists: an unmarked bodied review is a human's, and counting it
   * spent one of `PASS_CAP` and handed the condition that reviewer's findings instead.
   */
  it("leave a human's review out where the passes are marked", () => {
    const reviews = [
      { id: 1, body: `${PASS_MARKER}\npass 1` },
      { id: 2, body: "LGTM" },
    ];
    expect(ids(reviews)).toEqual([1]);
  });

  /** A pull request reviewed before the marker landed still reaches the gate. */
  it("fall back to every bodied review where none is marked", () => {
    expect(
      ids([
        { id: 1, body: "pass 1" },
        { id: 2, body: "" },
        { id: 3, body: "LGTM" },
      ]),
    ).toEqual([1, 3]);
  });

  it("are none where no review carries a body", () => {
    expect(passes([{ id: 1, body: "" }])).toEqual([]);
  });
});

const pass = (id: number) => ({ id, body: `${PASS_MARKER}\npass ${id}` });
const spent = (n: number) => Array.from({ length: n }, (_, i) => pass(i + 1));

/** No commit relation between the last pass and the tip, which blocks nothing. */
const NONE = { commits: null, changed: [] };

describe("the review converged", () => {
  const critical = finding(1, BOLD);

  it("stops a pull request nothing has reviewed", () => {
    expect(reviewBlocked([], [], NONE)).toMatch(/nothing has reviewed this/);
  });

  it("holds where the last pass returned only a taste call", () => {
    expect(reviewBlocked(spent(1), [finding(1, "**comment** — a taste call")], NONE)).toBeNull();
  });

  /**
   * The shape a converging review takes: a blocking pass, the fix, then a pass that found
   * nothing and posted a body with no comments. Reading the earlier pass's findings blocks
   * that forever, since no later clean pass can move the count.
   */
  it("holds where the last pass posted a body and no findings", () => {
    expect(reviewBlocked(spent(2), [], NONE)).toBeNull();
  });

  it("names which pass returned the blocking finding, and the finding", () => {
    const blocked = reviewBlocked(spent(1), [critical], NONE);
    expect(blocked).toContain(`pass 1 of ${PASS_CAP}`);
    expect(blocked).toContain(critical.html_url);
  });

  /**
   * A last pass at the cap that returns a blocking finding leaves the run nowhere to go:
   * another pass is one the skill forbids, and a hand merge is what the gate exists to
   * stop. The verdict conditions carry the applied fix from here.
   */
  it("stops asking at the cap, where the fix rides on the thread verdicts", () => {
    expect(reviewBlocked(spent(PASS_CAP), [critical], NONE)).toBeNull();
  });

  /**
   * A block past the cap is a block nothing clears, because a submitted review cannot be
   * withdrawn. The overage is reported rather than enforced.
   */
  it("prints the overage past the cap rather than blocking on it", () => {
    expect(reviewBlocked(spent(PASS_CAP + 1), [critical], NONE)).toBeNull();
    expect(capNote(spent(PASS_CAP + 1), [], NONE)).toContain(`${PASS_CAP + 1} passes`);
  });

  it("says so where the cap waived a blocking finding, and stays quiet otherwise", () => {
    expect(capNote(spent(PASS_CAP), [critical], NONE)).toContain("stopped this condition asking");
    expect(capNote(spent(PASS_CAP), [], NONE)).toBeNull();
    expect(capNote(spent(1), [critical], NONE)).toBeNull();
  });
});

/**
 * Two of the commits a merged pull request carried after the only pass it posted. That
 * pass read the branch's first commit, and the gate called the review converged.
 */
const READ = "d285e8a6a4b1c0d9e8f7a6b5c4d3e2f10a9b8c7d";
const AFTER = [
  { sha: "9acb2010b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8", subject: "fix: apply the review pass" },
  { sha: "ebc308448a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d", subject: "feat: return the reduction" },
];

describe("the last pass against the tip", () => {
  const behind = (changed: string[]) => ({ commits: AFTER, changed });
  const unrelated = { commits: null, changed: ["scripts/merge-gate.mjs"] };

  it("holds where the pass is anchored at the tip", () => {
    const tip = { commits: [], changed: [] };
    expect(staleBlocked(tip)).toBeNull();
    expect(reviewBlocked(spent(1), [], tip)).toBeNull();
    expect(staleNote(READ, tip)).toContain("the tip");
  });

  it("holds where only prose landed after the pass, and still reports the distance", () => {
    const prose = behind(["docs/architecture.md", "README.md"]);
    expect(staleBlocked(prose)).toBeNull();
    expect(staleNote(READ, prose)).toContain("2 commits behind");
  });

  it("stops a pass that never read a source commit, and names the commits", () => {
    const blocked = reviewBlocked(spent(1), [], behind(["scripts/merge-gate.mjs", "docs/x.md"]));
    expect(blocked).toContain("1 file that the pass never read");
    for (const commit of AFTER) {
      expect(blocked).toContain(commit.sha.slice(0, 8));
      expect(blocked).toContain(commit.subject);
    }
  });

  /**
   * A human reviews whatever head they were shown, so a `commit_id` this branch never
   * carried relates to nothing here — and the fallback hands that review to the condition
   * as the last pass. Blocking on it is a block no further pass can clear.
   */
  it("lets a review through whose commit this branch does not carry", () => {
    expect(staleBlocked(unrelated)).toBeNull();
    expect(reviewBlocked([{ id: 1, body: "LGTM" }], [], unrelated)).toBeNull();
    expect(staleNote(READ, unrelated)).toMatch(/not on this branch/);
    expect(staleNote(null, unrelated)).toBeNull();
  });

  /** The same waiver the cap gives the findings: at it, no further pass is on offer. */
  it("stops asking at the cap, and says which waiver it spent", () => {
    const stale = behind(["scripts/merge-gate.mjs"]);
    expect(reviewBlocked(spent(PASS_CAP), [], stale)).toBeNull();
    expect(capNote(spent(PASS_CAP), [], stale)).toContain("commits the last pass never read");
  });
});

/**
 * The cap is one number and both skills read it here. A skill spelling it out again
 * leaves prose and code each holding half a rule that only holds whole.
 */
const NUMBER = "one|two|three|four|five|six|seven|eight|nine|ten|\\d+";

/**
 * A number beside "passes", either way round, in `issue-to-pr` — where the loop lives. Both
 * patterns keep the word, because a ceiling named without it matches ordinary prose: a
 * skill dense with step numbers reads "most of step 14" as a cap. Both keep it plural,
 * because the singular sits beside a small number innocently — "post the pass as one
 * review" counts reviews and caps nothing — while a cap is a count and reads plural.
 */
const SECOND_CAP = [
  new RegExp(`\\b(?:${NUMBER})\\s+(?:\\w+\\s+)?passes\\b`),
  new RegExp(`\\bpasses\\b(?:\\s+\\w+){0,3}\\s+(?:${NUMBER})\\b`),
];

describe("the cap and the condition the skills cite", () => {
  /**
   * A fence nothing fires is a fence that passes whatever it was pointed at, and the
   * patterns are read by nobody until one does. These are the wordings they claim.
   */
  it("fires on a pass count written either way round, and not on the singular", () => {
    const caught = (line: string) => SECOND_CAP.some((second) => second.test(line));
    expect(caught("three passes at most")).toBe(true);
    expect(caught("at most 3 review passes")).toBe(true);
    expect(caught("passes are capped at three")).toBe(true);
    expect(caught("post the pass as one review")).toBe(false);
    expect(caught("a pass returning nothing ends the loop earlier")).toBe(false);
  });

  it("is cited by issue-to-pr rather than restated", () => {
    const skill = read(".claude/skills/issue-to-pr/SKILL.md");
    expect(skill, "issue-to-pr names no cap, so a run cannot tell when to stop").toContain(
      "PASS_CAP",
    );
    for (const second of SECOND_CAP)
      expect(
        second.test(skill),
        `issue-to-pr spells a pass count out (${second}), which is a second cap the gate cannot read`,
      ).toBe(false);
  });

  it("reaches merge-pr in the words the gate prints", () => {
    expect(
      read(".claude/skills/merge-pr/SKILL.md"),
      "merge-pr lists a condition the gate no longer prints, so a run cannot match the two",
    ).toContain("the review converged");
  });
});

describe("blocking findings", () => {
  it("keeps an unreadable marker rather than dropping it", () => {
    expect(blockingFindings([finding(1, BACKTICKED)])).toHaveLength(1);
  });

  it("keeps critical and warning, and lets comment through", () => {
    const findings = [
      finding(1, BOLD),
      finding(2, "**warning** — y"),
      finding(3, "**comment** — z"),
    ];
    expect(blockingFindings(findings)).toHaveLength(2);
  });
});

describe("thread verdicts", () => {
  const critical = finding(10, BOLD);

  it("reports a finding no reply answers", () => {
    expect(unanswered([critical])).toHaveLength(1);
  });

  it("accepts Applied and Declined alike", () => {
    expect(unanswered([critical, reply(11, "**Applied** in abc1234", 10)])).toEqual([]);
    expect(unanswered([critical, reply(12, DECLINED, 10)])).toEqual([]);
  });

  it("lets a declined comment through and stops a declined critical", () => {
    const taste = [finding(20, "**comment** — a taste call"), reply(21, DECLINED, 20)];
    expect(blockingDeclines(taste)).toEqual([]);
    expect(blockingDeclines([critical, reply(13, DECLINED, 10)])).toHaveLength(1);
  });

  it("stops a decline whose finding carries no readable marker", () => {
    const orphan = [finding(30, BACKTICKED), reply(31, DECLINED, 30)];
    expect(blockingDeclines(orphan)).toHaveLength(1);
  });
});

describe("the other three conditions", () => {
  it("counts every bucket but pass and skipping as not green", () => {
    const checks = [
      { name: "check", bucket: "pass" },
      { name: "corpus", bucket: "skipping" },
      { name: "e2e", bucket: "pending" },
      { name: "spellcheck", bucket: "fail" },
    ];
    expect(notGreen(checks)).toEqual(["e2e", "spellcheck"]);
  });

  it("names the red checks, and reads an empty rollup as too new to judge", () => {
    expect(checksBlocked([{ name: "check", bucket: "pass" }])).toBeNull();
    expect(checksBlocked([{ name: "e2e", bucket: "fail" }])).toBe("e2e");
    expect(checksBlocked([])).toMatch(/no check has reported/);
  });

  it("stops a conflict and asks again on UNKNOWN", () => {
    expect(mergeBlocked({ mergeable: "MERGEABLE", mergeStateStatus: "CLEAN" })).toBeNull();
    expect(mergeBlocked({ mergeable: "CONFLICTING", mergeStateStatus: "CLEAN" })).not.toBeNull();
    expect(mergeBlocked({ mergeable: "MERGEABLE", mergeStateStatus: "DIRTY" })).not.toBeNull();
    expect(mergeBlocked({ mergeable: "UNKNOWN", mergeStateStatus: "BLOCKED" })).not.toBeNull();
  });

  /**
   * GitHub reports a branch missing the tip of `main` as `MERGEABLE`/`BEHIND`, which this
   * repository's branch protection then refuses.
   */
  it("stops a branch that is behind, and says so rather than calling it a conflict", () => {
    const behind = mergeBlocked({ mergeable: "MERGEABLE", mergeStateStatus: "BEHIND" });
    expect(behind).toMatch(/behind/);
    expect(behind).not.toBe(mergeBlocked({ mergeable: "CONFLICTING", mergeStateStatus: "DIRTY" }));
  });

  it("asks again where a behind branch has no computed mergeability yet", () => {
    expect(mergeBlocked({ mergeable: "UNKNOWN", mergeStateStatus: "BEHIND" })).toMatch(/ask again/);
  });

  it("reads a branch that is both behind and conflicting as the conflict", () => {
    expect(mergeBlocked({ mergeable: "CONFLICTING", mergeStateStatus: "BEHIND" })).toMatch(
      /conflicts/,
    );
  });

  it("stops a version bump and ignores a rename or a reordering", () => {
    const before = {
      name: "a",
      dependencies: { zod: "^3.0.0" },
      scripts: { dev: "x", build: "y" },
    };
    expect(dependenciesDiffer(before, { ...before, dependencies: { zod: "^3.1.0" } })).toBe(true);
    expect(dependenciesDiffer(before, { ...before, name: "b" })).toBe(false);
    expect(dependenciesDiffer(before, { ...before, scripts: { build: "y", dev: "x" } })).toBe(
      false,
    );
    const two = { ...before, dependencies: { zod: "^3.0.0", hono: "^4.0.0" } };
    expect(
      dependenciesDiffer(two, { ...two, dependencies: { hono: "^4.0.0", zod: "^3.0.0" } }),
    ).toBe(false);
    expect(dependenciesDiffer(before, { ...before, devDependencies: { vitest: "^4" } })).toBe(true);
  });
});

/**
 * The one piece of this condition that runs git, over a repository built to hold the shape
 * `merge-pr`'s behind-branch recovery leaves: a branch that merged `main` in after the pass
 * read it. A fabricated `Since` cannot fail on a range that reads main's commits as
 * unreviewed code.
 */
describe("the commits since the last pass", () => {
  const dir = mkdtempSync(join(tmpdir(), "merge-gate-"));
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();
  const commit = (path: string, message: string) => {
    mkdirSync(join(dir, dirname(path)), { recursive: true });
    writeFileSync(join(dir, path), message);
    git("add", "-A");
    git("commit", "-q", "-m", message);
    return git("rev-parse", "HEAD");
  };

  beforeAll(() => {
    git("init", "-q", "-b", "main");
    git("config", "user.email", "gate@example.invalid");
    git("config", "user.name", "gate");
    git("config", "commit.gpgsign", "false");
  });

  // Windows writes pack files read-only, and rmSync does not chmod before unlinking.
  afterAll(() => rmSync(dir, { recursive: true, force: true, maxRetries: 3 }));

  it("reads the branch's own commits and never the main it merged in", () => {
    commit("src/a.ts", "the base");
    git("checkout", "-q", "-b", "topic");
    const read = commit("src/b.ts", "the commit the pass read");
    git("checkout", "-q", "main");
    commit("src/c.ts", "main moved on");
    git("update-ref", "refs/remotes/origin/main", "main");
    git("checkout", "-q", "topic");
    git("merge", "-q", "--no-edit", "main");

    const merged = sinceLastPass(read, git("rev-parse", "HEAD"), dir);
    expect(merged.changed).toEqual([]);
    expect(staleBlocked(merged)).toBeNull();

    const fix = commit("src/b.ts", "the fix the pass never read");
    const after = sinceLastPass(read, git("rev-parse", "HEAD"), dir);
    expect(after.changed).toEqual(["src/b.ts"]);
    expect(after.commits?.map((c: { sha: string }) => c.sha)).toContain(fix);
    expect(staleBlocked(after)).toContain("1 file that the pass never read");
  });

  it("reads a commit this branch does not carry as no relation", () => {
    expect(sinceLastPass("0".repeat(40), git("rev-parse", "HEAD"), dir).commits).toBeNull();
  });
});

/**
 * The other half of the migration fence. `packages/api/drizzle/` is drizzle-kit's `out`,
 * and moving `out` touches only a config file the fence does not cover — so the drift
 * merges itself and every migration afterwards lands where the gate cannot see it. The
 * configs are read off disk rather than named, because a third one is the same drift
 * arriving by another route.
 */
const OUT = /out:\s*"\.\/([^"]+)"/;
const CONFIGS = readdirSync(join(ROOT, "packages/api")).filter((name) =>
  /^drizzle.*\.config\.ts$/.test(name),
);

describe("the migration fence", () => {
  it("has configs to read", () => {
    expect(CONFIGS.length, "no packages/api/drizzle*.config.ts matched").toBeGreaterThan(0);
  });

  it.each(CONFIGS)("%s writes migrations where the gate is watching", (config) => {
    const matched = OUT.exec(read(`packages/api/${config}`));
    expect(matched, `packages/api/${config} declares no out:`).not.toBeNull();
    const out = `packages/api/${matched?.[1]}`;
    expect(
      FENCE.test(out),
      `packages/api/${config} writes migrations to "${out}", which the gate does not fence. Widen FENCE in scripts/merge-gate.mjs, or move the output back.`,
    ).toBe(true);
  });

  it("fences every path the gate is meant to hold", () => {
    for (const path of [
      "CLAUDE.md",
      "CONTRIBUTING.md",
      "content.lock.json",
      "content.manifest.json",
      ".github/workflows/ci.yml",
      ".claude/skills/merge-pr/SKILL.md",
      "packages/api/drizzle/0001_init.sql",
    ]) {
      expect(FENCE.test(path), `${path} is not fenced`).toBe(true);
    }
    expect(FENCE.test("packages/rules/src/spell-slots.ts")).toBe(false);
    expect(FENCE.test("docs/data-model.md")).toBe(false);
  });
});
