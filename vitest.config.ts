import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * api tests whose `beforeEach` builds a content.db fixture through
 * `contentFixture.ts` — the same publish step `packages/content`'s own tests use,
 * so they need that project's timeout budget rather than `node`'s.
 */
const CONTENT_FIXTURE_TESTS = [
  "packages/api/src/db/queries/content.test.ts",
  "packages/api/src/db/queries/item-variant.test.ts",
  "packages/api/src/routes/backgrounds.test.ts",
  "packages/api/src/routes/catalog.test.ts",
  "packages/api/src/routes/classes.test.ts",
  "packages/api/src/routes/feats.test.ts",
  "packages/api/src/routes/health.test.ts",
  "packages/api/src/routes/items.test.ts",
  "packages/api/src/routes/races.test.ts",
  "packages/api/src/routes/search.test.ts",
  "packages/api/src/routes/spells.test.ts",
];

/**
 * Three projects. Node code and the repo fences run in `node`; anything touching
 * React needs a DOM; a test that builds a database on disk needs a budget the
 * other two do not.
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
            "packages/{rules,character,dice,tags,catalog,api}/src/**/*.test.ts",
          ],
          exclude: [...CONTENT_FIXTURE_TESTS],
          // packages/api/src/db/{client,migrate}.test.ts build a database on disk
          // too, but each does a handful of inserts rather than a catalog import,
          // so they still fit the 5 s default. CONTENT_FIXTURE_TESTS moves the
          // rest to the content project's budget below.
        },
      },
      {
        test: {
          name: "content",
          environment: "node",
          include: ["packages/content/src/**/*.test.ts", ...CONTENT_FIXTURE_TESTS],
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
