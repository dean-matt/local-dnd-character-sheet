import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * Three projects. Node code and the repo fences run in `node`; anything touching
 * React needs a DOM; the content tests need a budget the other two do not.
 *
 * End-to-end specs live in `e2e/` and are run by Playwright, not Vitest.
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "node",
          environment: "node",
          include: [
            "tests/**/*.test.ts",
            "packages/{rules,character,dice,tags,api}/src/**/*.test.ts",
          ],
          // packages/api/src/db/{client,migrate}.test.ts build a database on disk
          // too, but each does a handful of inserts rather than a catalog import,
          // so they still fit the 5 s default. If an api database test grows past
          // that, split it into its own project with the content project's budget
          // rather than raising this one for every test here.
        },
      },
      {
        test: {
          name: "content",
          environment: "node",
          include: ["packages/content/src/**/*.test.ts"],
          // Most content tests build a database on disk, and a hosted Windows
          // runner spends 100 s over a suite that takes 4 s here — enough for the
          // 5 s default to fail a passing test. 30 s is 300 times the slowest test
          // here, so a hang still fails; the hooks share it, making the same calls.
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
      {
        plugins: [react()],
        test: {
          name: "web",
          environment: "jsdom",
          globals: true,
          setupFiles: ["./packages/web/vitest.setup.ts"],
          include: ["packages/web/src/**/*.test.{ts,tsx}"],
        },
      },
    ],
  },
});
