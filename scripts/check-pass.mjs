/**
 * Refuses a review pass whose findings the merge gate could not classify, before
 * `converge-review` posts it. A body the gate reads as `unreadable` blocks the merge, and
 * a posted review cannot be edited into shape, so the check runs on the JSON about to be sent.
 *
 * Usage: node scripts/check-pass.mjs <pass.json>; exits 1 and names each fault.
 */
import { readFileSync, realpathSync } from "node:fs";
import { PASS_MARKER, severity } from "./merge-gate.mjs";

/**
 * @param {{ body?: string, comments?: { path?: string, line?: number, body?: string }[] }} pass
 * @returns {string[]} one sentence per fault
 */
export function passFaults(pass) {
  const faults = [];
  if (!(pass.body ?? "").startsWith(PASS_MARKER))
    faults.push(`the body does not open with ${PASS_MARKER}`);
  for (const c of pass.comments ?? []) {
    if (severity(c.body) === "unreadable")
      faults.push(
        `${c.path}:${c.line} does not open with **critical**, **warning** or **comment**`,
      );
  }
  return faults;
}

if (process.argv[1] !== undefined && import.meta.filename === realpathSync(process.argv[1])) {
  const file = process.argv[2];
  if (file === undefined) {
    console.error("usage: node scripts/check-pass.mjs <pass.json>");
    process.exit(2);
  }
  const faults = passFaults(JSON.parse(readFileSync(file, "utf8")));
  for (const f of faults) console.error(f);
  process.exit(faults.length === 0 ? 0 : 1);
}
