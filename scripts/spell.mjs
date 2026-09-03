/**
 * Runs `typos`, which is a standalone binary rather than an npm package, and
 * explains how to install it per platform when it is missing. Without this the
 * failure is a bare ENOENT in the middle of `pnpm check`.
 */
import { spawnSync } from "node:child_process";

const INSTALL = {
  darwin: "brew install typos-cli",
  win32: "scoop install typos   (or: cargo install typos-cli)",
  linux: "cargo install typos-cli   (or your distribution's package)",
};

const result = spawnSync("typos", process.argv.slice(2), { stdio: "inherit", shell: true });

// `shell: true` swallows ENOENT: POSIX shells exit 127, cmd.exe exits 9009.
if (result.error?.code === "ENOENT" || result.status === 127 || result.status === 9009) {
  const hint = INSTALL[process.platform] ?? "See https://github.com/crate-ci/typos";
  console.error(`typos is not installed.\n  ${hint}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
