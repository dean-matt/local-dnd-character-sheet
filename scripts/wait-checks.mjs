/**
 * Waits for the head of a pull request to finish its required checks.
 *
 * Input: a pull request number. Polls every `INTERVAL_MS` for up to nine minutes, counted from
 * the start, inside the longest tool call. Exits 0 once two consecutive polls both show every
 * required check green, 1 when a check failed and none is pending (a required check that has
 * not reported does not delay that exit), and 2 when the time ran out with a required check
 * unreported, pending or unconfirmed, or when no required name could be read. Prints the
 * names it was waiting on before it exits.
 */
import { realpathSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import {
  expectedChecks,
  isGreen,
  missingChecks,
  noRequiredChecks,
  readChecks,
} from "./required-checks.mjs";

export const TIMEOUT_MS = 9 * 60 * 1000;
export const INTERVAL_MS = 15 * 1000;
export const RULESET_RETRY_MS = 3 * 1000;

/** @param {{ name: string, bucket: string }[]} checks */
export function settle(expected, checks) {
  const pending = checks.filter((c) => c.bucket === "pending");
  const failed = checks.filter((c) => !isGreen(c) && c.bucket !== "pending");
  return {
    failed: failed.map((c) => c.name),
    pending: pending.map((c) => c.name),
    missing: missingChecks(expected, checks),
  };
}

/**
 * Reads the required names, retrying once after `delayMs` before the error stands.
 *
 * @param {() => string[]} read
 * @param {(ms: number) => Promise<void>} [wait]
 */
export async function readExpected(read, wait = (ms) => sleep(ms), delayMs = RULESET_RETRY_MS) {
  try {
    return read();
  } catch {
    await wait(delayMs);
    return read();
  }
}

/**
 * Polls until the head settles or the next poll would land past `timeoutMs`. `read`, `wait`
 * and `now` are parameters so a test drives the clock instead of sleeping through it.
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
  if (noRequiredChecks(expected) !== null) return { code: 2, failed: [], waiting: [] };
  const deadline = now() + timeoutMs;
  let greens = 0;
  for (;;) {
    const { failed, pending, missing } = settle(expected, await read());
    if (failed.length > 0 && pending.length === 0) return { code: 1, failed, waiting: [] };
    const waiting = [...missing, ...pending];
    greens = waiting.length === 0 ? greens + 1 : 0;
    if (greens >= 2) return { code: 0, failed: [], waiting: [] };
    if (now() + intervalMs > deadline) {
      return {
        code: 2,
        failed: [],
        waiting: waiting.length > 0 ? waiting : ["a second green poll"],
      };
    }
    await wait(intervalMs);
  }
}

if (process.argv[1] !== undefined && import.meta.filename === realpathSync(process.argv[1])) {
  const pr = process.argv[2];
  if (pr === undefined) {
    console.error("usage: node scripts/wait-checks.mjs <pr>");
    process.exit(2);
  }
  const started = Date.now();
  let expected;
  try {
    expected = await readExpected(expectedChecks);
  } catch (error) {
    console.error(`could not read the required checks: ${error.message}`);
    process.exit(2);
  }
  const { code, failed, waiting } = await waitChecks({
    expected,
    read: () => readChecks(pr),
    timeoutMs: TIMEOUT_MS - (Date.now() - started),
  });
  if (code === 1) console.error(`failed: ${failed.join(", ")}`);
  if (code === 2 && noRequiredChecks(expected) !== null) console.error(noRequiredChecks(expected));
  else if (code === 2) console.error(`timed out waiting on: ${waiting.join(", ")}`);
  if (code === 0) console.log("every required check is green");
  process.exit(code);
}
