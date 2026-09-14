import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Runs `scripts/no-rewrite.mjs` against a real repository, which the unit tests cannot
 * reach: they call `checkRewrite` directly, so the main guard, the ref lookups and the
 * exit code all stay unchecked, and a fence that stopped firing would leave them green.
 *
 * Each case builds its own branch. A case that inherits the state of the one before it
 * passes in the suite and asserts the opposite of its name when run alone.
 */
const SCRIPT = resolve(import.meta.dirname, "../scripts/no-rewrite.mjs");

let work: string;
let root: string;

function git(...args: string[]): string {
  return execFileSync("git", args, { cwd: work, encoding: "utf8" });
}

/**
 * An uncaught throw also exits 1, so the message is asserted alongside the code —
 * without it, a script that dies before reaching `checkRewrite` reads as a rejection.
 */
function fence(): { status: number | null; stderr: string } {
  const result = spawnSync("node", [SCRIPT], { cwd: work, encoding: "utf8" });
  return { status: result.status, stderr: result.stderr };
}

function commit(body: string): void {
  writeFileSync(join(work, "file.txt"), body);
  git("add", "file.txt");
  git("commit", "--quiet", "-m", `chore: ${body}`);
}

/** Rewrites the commit at HEAD, which is what a force push would have to carry. */
function amend(body: string): void {
  writeFileSync(join(work, "file.txt"), body);
  git("add", "file.txt");
  git("commit", "--quiet", "--amend", "--no-edit");
}

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "no-rewrite-"));
  work = join(root, "work");
  execFileSync("git", ["init", "--bare", "--quiet", join(root, "remote.git")]);
  execFileSync("git", ["init", "--quiet", "-b", "main", work]);
  git("config", "user.email", "test@example.invalid");
  git("config", "user.name", "Test");
  git("remote", "add", "origin", join(root, "remote.git"));
  commit("root");
  git("push", "--quiet", "-u", "origin", "main");
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("the pre-push fence, on a tracking branch", () => {
  beforeAll(() => {
    git("checkout", "--quiet", "-b", "tracked", "main");
    commit("one");
    git("push", "--quiet", "-u", "origin", "tracked");
  });

  it("allows a push that only adds commits", () => {
    commit("two");
    expect(fence().status).toBe(0);
  });

  it("rejects a push that rewrites a commit the remote holds", () => {
    git("push", "--quiet", "origin", "tracked");
    amend("two, amended");
    const { status, stderr } = fence();
    expect(status).toBe(1);
    expect(stderr).toContain("already holds");
  });
});

describe("the pre-push fence, with no tracking config", () => {
  beforeAll(() => {
    git("checkout", "--quiet", "-b", "untracked", "main");
    commit("one");
    // No -u: the branch has a remote to overwrite and nothing naming it as upstream.
    git("push", "--quiet", "origin", "untracked");
  });

  it("allows a push that only adds commits", () => {
    commit("two");
    expect(fence().status).toBe(0);
  });

  it("rejects a push that rewrites a commit the remote holds", () => {
    git("push", "--quiet", "origin", "untracked");
    amend("two, amended");
    const { status, stderr } = fence();
    expect(status).toBe(1);
    expect(stderr).toContain("already holds");
  });
});
