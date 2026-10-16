import { statSync } from "node:fs";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { BaseSequencer, type TestSpecification } from "vitest/node";

/**
 * Deals each project's files across the shards largest first, each to the shard holding
 * the fewest of that project's bytes, where Vitest's own split by path hash ignores both.
 * Balancing per project spreads the content tests, which a Windows runner slows far more
 * than the rest. A file's size stands in for its run time: on Linux the two shards land
 * within 5% of each other, while on Windows the slowest still runs about 1.6 times the
 * fastest. Recorded Windows timings would balance closer, at the cost of a record that
 * drifts with every test added.
 */
class BalancedSequencer extends BaseSequencer {
  override async shard(files: TestSpecification[]): Promise<TestSpecification[]> {
    const shard = this.ctx.config.shard;
    if (shard === undefined) return files;
    const size = new Map(files.map((f) => [f, statSync(f.moduleId).size]));
    const mine: TestSpecification[] = [];
    for (const project of new Set(files.map((f) => f.project.name))) {
      const load = Array<number>(shard.count).fill(0);
      const ordered = files
        .filter((f) => f.project.name === project)
        .sort(
          (a, b) => (size.get(b) ?? 0) - (size.get(a) ?? 0) || a.moduleId.localeCompare(b.moduleId),
        );
      for (const file of ordered) {
        const lightest = load.indexOf(Math.min(...load));
        load[lightest] = (load[lightest] ?? 0) + (size.get(file) ?? 0);
        if (lightest === shard.index - 1) mine.push(file);
      }
    }
    return mine;
  }
}

/**
 * Three projects. Node code and the repo fences run in `node`; anything touching
 * React needs a DOM; a test that builds a database on disk needs a budget the
 * other two do not.
 *
 * End-to-end specs live in `e2e/` and are run by Playwright, not Vitest.
 */
export default defineConfig({
  test: {
    sequence: { sequencer: BalancedSequencer },
    projects: [
      {
        test: {
          name: "node",
          environment: "node",
          include: [
            "tests/**/*.test.ts",
            "packages/{rules,character,dice,tags,catalog,api}/src/**/*.test.ts",
          ],
          // packages/api/src/db/{client,migrate,backup}.test.ts build a database on
          // disk, but each does a handful of inserts rather than a catalog import,
          // so they fit the 5 s default. Every other api test opens its databases
          // in memory through db/testDatabases.ts and publishes each content fixture
          // in one write, shared across the file where its tests read one catalog.
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
          // Its ESM build imports without file extensions, which only a bundler resolves.
          server: { deps: { inline: ["codemirror-json-schema"] } },
        },
      },
    ],
  },
});
