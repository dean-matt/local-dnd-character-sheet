/**
 * Rejects a push that would drop a commit the remote already holds.
 *
 * Amending or rebasing something already pushed lands only as a force push, which
 * discards the commit a reviewer read: a comment anchored to a line, a CI run, and
 * every permalink into the branch point at a commit that no longer exists.
 *
 * Exports `checkRewrite` for `tests/no-rewrite.test.ts`; running the file checks the
 * current branch and exits non-zero when the push would rewrite.
 */
import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";

/**
 * Takes what git reports rather than reading it, so the rule is testable without a
 * repository. `upstream` is null on a branch that has never been pushed, where there
 * is nothing to rewrite.
 */
export function checkRewrite({ upstream, upstreamIsAncestor }) {
  if (upstream === null) return null;
  if (upstreamIsAncestor) return null;
  return `Pushing drops commits that ${upstream} already holds.`;
}

function upstreamRef() {
  try {
    return execFileSync("git", ["rev-parse", "--abbrev-ref", "@{u}"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function upstreamIsAncestor() {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", "@{u}", "HEAD"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// ESM resolves symlinks and argv[1] does not, so comparing them raw fails open.
if (process.argv[1] !== undefined && import.meta.filename === realpathSync(process.argv[1])) {
  const upstream = upstreamRef();
  const error = checkRewrite({
    upstream,
    upstreamIsAncestor: upstream === null ? true : upstreamIsAncestor(),
  });
  if (error !== null) {
    console.error(
      `${error}\n\n` +
        "  A pushed commit stays as it is. Add one instead — the squash merge\n" +
        "  collapses the branch anyway, so the extra commits cost nothing.\n\n" +
        "  Undo a local rewrite:  git reset --hard @{u} && git cherry-pick ..\n",
    );
    process.exit(1);
  }
}
