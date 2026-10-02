/**
 * Runs a child process and returns its stdout as text. Every script that reads `gh` or
 * `git` output goes through this, because Node's default 1 MiB `maxBuffer` kills the child
 * with `ENOBUFS` and a paginated `gh api` read of review comments passes that.
 *
 * Options pass through to `execFileSync` and override the defaults.
 */
import { execFileSync } from "node:child_process";

/**
 * Output past this still fails with `ENOBUFS`. Reading more than this means streaming the
 * child with `spawn` rather than buffering it.
 */
export const MAX_BUFFER = 256 * 1024 * 1024;

/**
 * @param {string} file
 * @param {string[]} args
 * @param {import("node:child_process").ExecFileSyncOptions} [options]
 * @returns {string} stdout, or null where `options.stdio` ignores it
 */
export function capture(file, args, options = {}) {
  return execFileSync(file, args, { encoding: "utf8", maxBuffer: MAX_BUFFER, ...options });
}
