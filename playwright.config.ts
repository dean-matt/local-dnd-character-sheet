import { existsSync, mkdtempSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end specs run against their own API and web servers, on ports of their own, over
 * a scratch data directory: empty `characters.db` and `homebrew.db`, and a link to the
 * built catalog where one exists. A run, passing or killed, never writes the user's `data/`.
 *
 * Chromium only, deliberately: this app is used in one browser on one machine,
 * so cross-browser coverage would cost CI time for a risk that does not exist.
 */
const API_PORT = 8788;
const WEB_PORT = 5174;

function scratchDataDir() {
  const dir = mkdtempSync(join(tmpdir(), "dnd-e2e-"));
  const content = resolve(import.meta.dirname, "data/content");
  if (existsSync(content)) symlinkSync(content, join(dir, "content"), "junction");
  return dir;
}

// Each worker evaluates this file again, inheriting the runner's environment, so it reuses
// the runner's directory rather than making one of its own. Each run leaves its directory in
// the OS temp folder, which macOS and Linux clean and Windows never does; a globalTeardown
// removing it would lift that.
process.env.E2E_DATA_DIR ??= scratchDataDir();

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "pnpm --filter @dnd/api run dev",
      url: `http://127.0.0.1:${API_PORT}/health`,
      env: { PORT: String(API_PORT), DND_DATA_DIR: process.env.E2E_DATA_DIR },
      reuseExistingServer: false,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: `pnpm --filter @dnd/web run dev --port ${WEB_PORT}`,
      url: `http://127.0.0.1:${WEB_PORT}`,
      env: { API_PORT: String(API_PORT) },
      reuseExistingServer: false,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
