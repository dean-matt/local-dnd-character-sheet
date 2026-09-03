/**
 * Rejects a commit on a branch that is not named `<type>/<issue>-<slug>`.
 *
 * The name is the only place the work carries its reason once the shell scrollback
 * is gone, and renaming a branch is free right up until the first commit — which
 * is why this runs on pre-commit rather than pre-push.
 *
 * Exports `checkBranchName` for `tests/branch-name.test.ts`; running the file
 * checks the current branch and exits non-zero when it fails.
 */
import { execFileSync } from "node:child_process";

const TYPES = ["feat", "fix", "chore", "docs", "refactor", "test", "perf", "build", "ci", "revert"];

const PATTERN = new RegExp(`^(${TYPES.join("|")})/[0-9]+-[a-z0-9-]+$`);

/** Returns an error message, or null when the branch is fine. */
export function checkBranchName(branch) {
  // A rebase, a bisect, or `git commit` on a detached HEAD has no branch to judge.
  if (branch === null || branch === "HEAD") return null;
  if (branch === "main") {
    return "Commit on a branch, not on main — pushes to main are rejected by the repository ruleset.";
  }
  if (PATTERN.test(branch)) return null;
  return `Branch "${branch}" is not named <type>/<issue>-<slug>.`;
}

function currentBranch() {
  const branch = execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim();
  return branch === "" ? null : branch;
}

if (import.meta.filename === process.argv[1]) {
  const error = checkBranchName(currentBranch());
  if (error !== null) {
    console.error(
      `${error}\n\n  Types: ${TYPES.join(", ")}\n` +
        "  Cut one from the issue:  gh issue develop 12 --name feat/12-short-slug --checkout\n" +
        "  Rename this one:         git branch -m feat/12-short-slug\n",
    );
    process.exit(1);
  }
}
