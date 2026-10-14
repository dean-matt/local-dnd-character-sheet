/**
 * Rejects a change to code that leaves the root `package.json` version at or below the
 * base's. With no argument the base is `origin/main`, and the diff runs from the branch
 * point to the working tree, so an uncommitted edit counts too. CI passes `HEAD~1`, the
 * base side of the pull request's merge commit, which is exact even after `main` moves.
 *
 * Exports `checkVersionBump` and `changedFiles` for `tests/version-bump.test.ts`; running
 * the file checks this checkout and exits non-zero when it fails.
 */
import { readFileSync, realpathSync } from "node:fs";
import { capture } from "./capture.mjs";

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

/** Everything outside `docs/` and Markdown counts as code. */
const isCode = (path) => !path.startsWith("docs/") && !path.endsWith(".md");

function parse(version) {
  const match = SEMVER.exec(version);
  return match ? match.slice(1).map(Number) : null;
}

/**
 * @param {{ changed: string[], version: string, base: string }} input
 * @returns {string | null} an error message, or null when the version is fine
 */
export function checkVersionBump({ changed, version, base }) {
  const ours = parse(version);
  if (ours === null) return `package.json version "${version}" is not MAJOR.MINOR.PATCH.`;
  if (!changed.some(isCode)) return null;
  const theirs = parse(base) ?? [0, 0, 0];
  const raised = ours.findIndex((part, i) => part !== theirs[i]);
  if (raised !== -1 && ours[raised] > theirs[raised]) return null;
  return `package.json version ${version} does not raise main's ${base}.`;
}

/**
 * The files the working tree changes since it left `base`. Against the tip instead, a
 * branch behind a fresh fetch would count `main`'s changes as its own.
 *
 * @param {string} base
 * @param {string} [cwd]
 */
export function changedFiles(base, cwd) {
  const from = capture("git", ["merge-base", base, "HEAD"], { cwd }).trim();
  return capture("git", ["diff", "--name-only", from], { cwd }).split("\n").filter(Boolean);
}

if (process.argv[1] !== undefined && import.meta.filename === realpathSync(process.argv[1])) {
  const ref = process.argv[2] ?? "origin/main";
  const error = checkVersionBump({
    changed: changedFiles(ref),
    version: JSON.parse(readFileSync("package.json", "utf8")).version,
    base: JSON.parse(capture("git", ["show", `${ref}:package.json`])).version,
  });
  if (error !== null) {
    console.error(
      `${error}\n\n  npm version minor --no-git-tag-version   # a feat\n` +
        "  npm version patch --no-git-tag-version   # any other type\n",
    );
    process.exit(1);
  }
}
