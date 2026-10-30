/**
 * Sizes the CI shard matrices from the suite, so each job's run time holds as tests are
 * added. Running it appends `windows`, `ubuntu` and `e2e` — each a JSON array 1 to n — to
 * `$GITHUB_OUTPUT`.
 *
 * A free-plan run holds 20 jobs at once and a job past that queues, so a shard past the
 * budget stops paying. Ubuntu and e2e stop at four shards each and Windows takes what they
 * leave, since its tests run slower per file. Past that, raise the files
 * per shard or move to a larger plan; a matrix may hold 256 jobs.
 */
import { appendFileSync } from "node:fs";
import { capture } from "./capture.mjs";

export const SLOTS = 20;
/** Jobs that run beside the shards: static and spellcheck. */
export const FIXED_JOBS = 2;
export const MIN_SHARDS = 2;
export const MAX_UBUNTU_AND_E2E_SHARDS = 4;
export const TESTS_PER_WINDOWS_SHARD = 30;
export const TESTS_PER_UBUNTU_SHARD = 170;
export const SPECS_PER_E2E_SHARD = 12;

const between = (min, max, n) => Math.min(max, Math.max(min, n));

export function planShards({ tests, specs }) {
  const ubuntu = between(
    MIN_SHARDS,
    MAX_UBUNTU_AND_E2E_SHARDS,
    Math.ceil(tests / TESTS_PER_UBUNTU_SHARD),
  );
  const e2e = between(
    MIN_SHARDS,
    MAX_UBUNTU_AND_E2E_SHARDS,
    Math.ceil(specs / SPECS_PER_E2E_SHARD),
  );
  const room = SLOTS - FIXED_JOBS - ubuntu - e2e;
  const windows = between(MIN_SHARDS, room, Math.ceil(tests / TESTS_PER_WINDOWS_SHARD));
  return { windows, ubuntu, e2e };
}

const count = (...pathspecs) =>
  capture("git", ["ls-files", ...pathspecs])
    .split("\n")
    .filter(Boolean).length;

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  const plan = planShards({
    tests: count("*.test.ts", "*.test.tsx"),
    specs: count("e2e/*.spec.ts"),
  });
  const lines = Object.entries(plan).map(
    ([name, n]) => `${name}=${JSON.stringify(Array.from({ length: n }, (_, i) => i + 1))}\n`,
  );
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, lines.join(""));
  else process.stdout.write(lines.join(""));
}
