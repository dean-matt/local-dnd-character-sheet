import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Runs `scripts/no-rewrite.mjs` against a real repository, which the unit tests cannot
 * reach: they call `checkRewrite` directly, so the main guard, the ref lookups and the
 * exit code all stay unchecked, and a fence that stopped firing would leave them green.
 */
const SCRIPT = resolve(import.meta.dirname, "../scripts/no-rewrite.mjs");

let work: string;
let root: string;

function git(...args: string[]): string {
  return execFileSync("git", args, { cwd: work, encoding: "utf8" });
}

/** The exit code, which is the whole contract: zero allows the push, one rejects it. */
function fence(): number {
  try {
    execFileSync("node", [SCRIPT], { cwd: work, stdio: ["ignore", "pipe", "pipe"] });
    return 0;
  } catch (error) {
    return (error as { status: number }).status;
  }
}

function commit(body: string): void {
  writeFileSync(join(work, "file.txt"), body);
  git("add", "file.txt");
  git("commit", "--quiet", "-m", `chore: ${body}`);
}

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "no-rewrite-"));
  work = join(root, "work");
  execFileSync("git", ["init", "--bare", "--quiet", join(root, "remote.git")]);
  execFileSync("git", ["init", "--quiet", "-b", "work", work]);
  git("config", "user.email", "test@example.invalid");
  git("config", "user.name", "Test");
  git("remote", "add", "origin", join(root, "remote.git"));
  commit("one");
  git("push", "--quiet", "-u", "origin", "work");
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("the pre-push fence", () => {
  it("allows a push that only adds commits", () => {
    commit("two");
    expect(fence()).toBe(0);
  });

  it("rejects a push that rewrites a commit the remote holds", () => {
    git("push", "--quiet", "origin", "work");
    writeFileSync(join(work, "file.txt"), "two, amended");
    git("add", "file.txt");
    git("commit", "--quiet", "--amend", "--no-edit");
    expect(fence()).toBe(1);
  });

  it("rejects it on a branch pushed without tracking config", () => {
    git("branch", "--unset-upstream");
    expect(fence()).toBe(1);
  });
});
