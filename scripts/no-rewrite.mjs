/**
 * Rejects a push that would drop a commit the remote already holds.
 *
 * Amending or rebasing something already pushed lands only as a force push, which
 * discards the commit a reviewer read: a comment anchored to a line, a CI run, and
 * every permalink into the branch point at a commit that no longer exists.
 *
 * It judges the branch that is checked out, not the refs being pushed, so
 * `git push --force origin other-branch` from somewhere else goes through. Reading the
 * ref lines git sends a pre-push hook on stdin would cover those; lefthook skipped the
 * job before stdin arrived every time it was tried.
 *
 * Exports `checkRewrite` for `tests/no-rewrite.test.ts`; running the file checks the
 * current branch and exits non-zero when the push would rewrite.
 */
import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";

/**
 * Takes what git reports rather than reading it, so the rule is testable without a
 * repository. `upstream` is null only where the remote holds no such branch, which is
 * the one state with nothing to rewrite.
 */
export function checkRewrite({ upstream, upstreamIsAncestor }) {
  if (upstream === null) return null;
  if (upstreamIsAncestor) return null;
  return `Pushing drops commits that ${upstream} already holds.`;
}

function rev(ref) {
  try {
    return execFileSync("git", ["rev-parse", "--verify", "--quiet", ref], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

/**
 * `@{u}` misses a branch pushed without `-u`, which has a remote to overwrite and no
 * tracking config to name it, so the remote-tracking ref is the fallback.
 */
function upstreamRef() {
  if (rev("@{u}") !== null) return "@{u}";
  const branch = execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim();
  if (branch === "") return null;
  const remote = `origin/${branch}`;
  return rev(remote) === null ? null : remote;
}

function isAncestor(ref) {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", ref, "HEAD"], { stdio: "ignore" });
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
    upstreamIsAncestor: upstream === null ? true : isAncestor(upstream),
  });
  if (error !== null) {
    console.error(
      `${error}\n\n` +
        "  A pushed commit stays as it is. Add one instead — the squash merge\n" +
        "  collapses the branch anyway, so the extra commits cost nothing.\n\n" +
        `  Keep the work, drop the rewrite:  git reset --soft ${upstream} && git commit\n`,
    );
    process.exit(1);
  }
}
