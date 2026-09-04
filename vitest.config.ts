import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * Two projects, because they need different environments. Node code and the repo
 * fences run in `node`; anything touching React needs a DOM.
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
            "packages/{rules,character,dice,content,api}/src/**/*.test.ts",
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
