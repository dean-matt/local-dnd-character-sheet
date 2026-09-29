/**
 * The check names the `main` ruleset requires, and how a pull request's checks measure
 * against them. `merge-gate.mjs` and `wait-checks.mjs` both read this, so the ruleset
 * stays the only place a name is written down.
 */
import { execFileSync } from "node:child_process";

/**
 * Names the effective rules for `main` require, as GitHub applies them.
 *
 * @param {(file: string, args: string[], options: { encoding: "utf8" }) => string} [run]
 */
export function expectedChecks(run = execFileSync) {
  const rules = JSON.parse(
    run("gh", ["api", "repos/{owner}/{repo}/rules/branches/main"], { encoding: "utf8" }),
  );
  return rules
    .filter((r) => r.type === "required_status_checks")
    .flatMap((r) => r.parameters.required_status_checks.map((c) => c.context));
}

/**
 * The head's checks. `gh` exits non-zero while a check is pending or red but still prints
 * the rollup, so a failure with no output is the only one that reads as nothing reported.
 *
 * @param {string} pr
 * @param {(file: string, args: string[], options: { encoding: "utf8" }) => string} [run]
 */
export function readChecks(pr, run = execFileSync) {
  try {
    return JSON.parse(
      run("gh", ["pr", "checks", pr, "--json", "name,bucket"], { encoding: "utf8" }),
    );
  } catch (error) {
    try {
      return JSON.parse(error.stdout);
    } catch {
      console.error(`gh pr checks printed no rollup: ${error.message}`);
      return [];
    }
  }
}

export function missingChecks(expected, checks) {
  const seen = new Set(checks.map((c) => c.name));
  return expected.filter((name) => !seen.has(name));
}

/** A check that reported green, or that the workflow chose to skip. */
export function isGreen(check) {
  return check.bucket === "pass" || check.bucket === "skipping";
}
