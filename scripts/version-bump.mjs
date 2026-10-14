/**
 * Rejects a change to code that leaves the root `package.json` version at or below
 * `origin/main`'s. It compares the working tree with `origin/main`, so it judges an
 * uncommitted edit too, and needs `origin/main` fetched: CI fetches it first.
 *
 * Exports `checkVersionBump` for `tests/version-bump.test.ts`; running the file checks
 * this checkout and exits non-zero when it fails.
 */
import { readFileSync, realpathSync } from "node:fs";
import { capture } from "./capture.mjs";

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

/** Prose and the mockup ship nothing a user runs, so they need no bump. */
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

if (process.argv[1] !== undefined && import.meta.filename === realpathSync(process.argv[1])) {
  const error = checkVersionBump({
    changed: capture("git", ["diff", "--name-only", "origin/main"]).split("\n").filter(Boolean),
    version: JSON.parse(readFileSync("package.json", "utf8")).version,
    base: JSON.parse(capture("git", ["show", "origin/main:package.json"])).version,
  });
  if (error !== null) {
    console.error(
      `${error}\n\n  A feat raises the minor version and any other type the patch:\n` +
        "  npm version minor --no-git-tag-version\n",
    );
    process.exit(1);
  }
}
