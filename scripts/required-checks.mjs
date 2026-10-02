/**
 * The check names the `main` ruleset requires, and how a pull request's checks measure
 * against them. `merge-gate.mjs` and `wait-checks.mjs` both read this, so the ruleset
 * stays the only place a name is written down.
 */
import { capture } from "./capture.mjs";

export const GH_TIMEOUT_MS = 30 * 1000;
const OPTIONS = { timeout: GH_TIMEOUT_MS };

/**
 * Names the effective rules for `main` require, as GitHub applies them.
 *
 * @param {(file: string, args: string[], options: { timeout: number }) => string} [run]
 */
export function expectedChecks(run = capture) {
  const rules = JSON.parse(run("gh", ["api", "repos/{owner}/{repo}/rules/branches/main"], OPTIONS));
  return rules
    .filter((r) => r.type === "required_status_checks")
    .flatMap((r) => r.parameters.required_status_checks.map((c) => c.context));
}

/**
 * The head's checks. `gh` exits non-zero while a check is pending or red but still prints
 * the rollup, so a failure with no output, or a call past `GH_TIMEOUT_MS`, is the only kind
 * that reads as nothing reported.
 *
 * @param {string} pr
 * @param {(file: string, args: string[], options: { timeout: number }) => string} [run]
 */
export function readChecks(pr, run = capture) {
  try {
    return JSON.parse(run("gh", ["pr", "checks", pr, "--json", "name,bucket"], OPTIONS));
  } catch (error) {
    if (error.code === "ETIMEDOUT") {
      console.error(`gh pr checks timed out after ${GH_TIMEOUT_MS} ms`);
      return [];
    }
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

/** The reason a head cannot be judged when the ruleset lists nothing to wait on, else null. */
export function noRequiredChecks(expected) {
  return expected.length === 0 ? "the ruleset names no required check" : null;
}
