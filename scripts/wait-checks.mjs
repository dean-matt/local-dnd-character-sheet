/**
 * Waits for the head of a pull request to finish its required checks.
 *
 * Polls the head for up to nine minutes, inside the longest tool call. Exits 0 when every required
 * check has reported green, 1 when one failed and none is still running, and 2 when the
 * timeout passed with a required check unreported or pending, or when the required names
 * could not be read. The names it was waiting on are printed before it exits.
 */
import { realpathSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { expectedChecks, missingChecks, readChecks } from "./required-checks.mjs";

export const TIMEOUT_MS = 9 * 60 * 1000;
export const INTERVAL_MS = 10 * 1000;

/** @param {{ name: string, bucket: string }[]} checks */
export function settle(expected, checks) {
  const failed = checks.filter((c) => c.bucket === "fail" || c.bucket === "cancel");
  const pending = checks.filter((c) => c.bucket === "pending");
  return {
    failed: failed.map((c) => c.name),
    pending: pending.map((c) => c.name),
    missing: missingChecks(expected, checks),
  };
}

/**
 * Polls until the head settles or `timeoutMs` passes. `read`, `wait` and `now` are
 * parameters so a test drives the clock instead of sleeping through it.
 *
 * @returns {Promise<{ code: 0 | 1 | 2, failed: string[], waiting: string[] }>}
 */
export async function waitChecks({
  expected,
  read,
  wait = (ms) => sleep(ms),
  now = Date.now,
  timeoutMs = TIMEOUT_MS,
  intervalMs = INTERVAL_MS,
}) {
  const deadline = now() + timeoutMs;
  for (;;) {
    const { failed, pending, missing } = settle(expected, await read());
    if (failed.length > 0 && pending.length === 0) return { code: 1, failed, waiting: [] };
    const waiting = [...missing, ...pending];
    if (waiting.length === 0) return { code: 0, failed: [], waiting: [] };
    if (now() >= deadline) return { code: 2, failed: [], waiting };
    await wait(intervalMs);
  }
}

if (process.argv[1] !== undefined && import.meta.filename === realpathSync(process.argv[1])) {
  const pr = process.argv[2];
  if (pr === undefined) {
    console.error("usage: node scripts/wait-checks.mjs <pr>");
    process.exit(2);
  }
  let expected;
  try {
    expected = expectedChecks();
  } catch (error) {
    console.error(`could not read the required checks: ${error.message}`);
    process.exit(2);
  }
  const { code, failed, waiting } = await waitChecks({
    expected,
    read: () => readChecks(pr),
  });
  if (code === 1) console.error(`failed: ${failed.join(", ")}`);
  if (code === 2) console.error(`timed out waiting on: ${waiting.join(", ")}`);
  if (code === 0) console.log("every required check is green");
  process.exit(code);
}
