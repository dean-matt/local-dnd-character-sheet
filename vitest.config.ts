import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * Two projects: node code and the repo fences run in `node`, and anything touching
 * React needs a DOM. Both keep Vitest's default timeouts: on a hosted Windows runner
 * the slowest test, hooks included, takes under 2 s.
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
            "packages/{rules,character,dice,tags,catalog,api,content}/src/**/*.test.ts",
          ],
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
