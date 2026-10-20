/**
 * Raises the root `package.json` version for one pull request, at the merge. A pull request
 * that changes code raises it over `origin/main`'s once: a `feat` title raises the minor,
 * every other type the patch. Prose and the mockup leave it alone, and a version already
 * above `main`'s is left as it is, so a rerun changes nothing.
 *
 * Run `node scripts/version-bump.mjs <pr>` in the branch's checkout. It edits
 * `package.json` and prints the new version; committing and pushing are the caller's.
 * Exports `bumpedVersion` and `changedFiles` for `tests/version-bump.test.ts`.
 */
import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { capture } from "./capture.mjs";

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

/** Everything outside `docs/` and Markdown counts as code. */
const isCode = (path) => !path.startsWith("docs/") && !path.endsWith(".md");

/**
 * @param {{ changed: string[], title: string, version: string, base: string }} input
 * @returns {string | null} the version to write, or null when the version stands
 */
export function bumpedVersion({ changed, title, version, base }) {
  const theirs = SEMVER.exec(base)?.slice(1).map(Number);
  if (theirs === undefined) throw new Error(`main's version "${base}" is not MAJOR.MINOR.PATCH.`);
  if (!changed.some(isCode)) return null;
  const ours = SEMVER.exec(version)?.slice(1).map(Number);
  if (ours !== undefined) {
    const differs = ours.findIndex((part, i) => part !== theirs[i]);
    if (differs !== -1 && ours[differs] > theirs[differs]) return null;
  }
  const [major, minor, patch] = theirs;
  return /^feat(\(.*\))?!?:/.test(title)
    ? `${major}.${minor + 1}.0`
    : `${major}.${minor}.${patch + 1}`;
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
  const pr = process.argv[2];
  if (!/^\d+$/.test(pr ?? "")) {
    console.error("usage: node scripts/version-bump.mjs <pr>");
    process.exit(2);
  }
  const text = readFileSync("package.json", "utf8");
  const next = bumpedVersion({
    changed: changedFiles("origin/main"),
    title: JSON.parse(capture("gh", ["pr", "view", pr, "--json", "title"])).title,
    version: JSON.parse(text).version,
    base: JSON.parse(capture("git", ["show", "origin/main:package.json"])).version,
  });
  if (next === null) console.log("no bump");
  else {
    writeFileSync("package.json", text.replace(/("version": ")[^"]+/, `$1${next}`));
    console.log(next);
  }
}
