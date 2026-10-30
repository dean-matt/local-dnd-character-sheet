import { globSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import viteConfig from "../vitest.config.ts";
import { ROOT } from "./lib/doc-helpers.ts";

/**
 * Fences the project split. A test file outside every include glob never runs and
 * nothing says so, and a project declaring no glob claims every test file — both
 * of which pass a suite that looks green.
 */
const SKIP_DIRS = new Set(["node_modules", "dist", "vendor", "e2e"]);

/** The budget the node and content projects state, repeated here so a change to it is deliberate. */
const BUDGET = 30_000;

const posixPaths = (patterns: string[]): string[] =>
  patterns.flatMap((pattern) =>
    globSync(pattern, {
      cwd: ROOT,
      exclude: (path) => SKIP_DIRS.has(String(path).split(/[\\/]/).pop() as string),
    }).map((path) => path.replaceAll("\\", "/")),
  );

function claimed(include: string[], exclude: string[]): Set<string> {
  const files = new Set(posixPaths(include));
  for (const file of posixPaths(exclude)) files.delete(file);
  return files;
}

const projects = (viteConfig.test?.projects ?? []).flatMap((project) => {
  if (typeof project !== "object" || !("test" in project) || !project.test) return [];
  const { name, include, exclude, testTimeout, hookTimeout } = project.test;
  return [
    {
      name: typeof name === "string" ? name : (name?.label ?? "unnamed"),
      include: include ?? [],
      files: claimed(include ?? [], exclude ?? []),
      testTimeout,
      hookTimeout,
    },
  ];
});

/** Both spellings Vitest runs by default, so one named the other way is still caught. */
const testFiles = posixPaths(["**/*.{test,spec}.{ts,tsx}"]);

const budgeted = projects.filter(({ testTimeout }) => testTimeout !== undefined);

describe("vitest projects", () => {
  it("finds test files to check", () => {
    expect(testFiles.length).toBeGreaterThan(0);
  });

  it("gives every project an include glob, since Vitest otherwise claims every test", () => {
    expect(projects.filter(({ include }) => include.length === 0).map(({ name }) => name)).toEqual(
      [],
    );
  });

  it.each(testFiles)("%s runs under exactly one project", (file) => {
    expect(projects.filter(({ files }) => files.has(file)).map(({ name }) => name)).toHaveLength(1);
  });

  it("states one budget, covering tests and the hooks that make the same calls", () => {
    expect(
      budgeted.map(({ name, testTimeout, hookTimeout }) => ({ name, testTimeout, hookTimeout })),
    ).toEqual([
      { name: "node", testTimeout: BUDGET, hookTimeout: BUDGET },
      { name: "content", testTimeout: BUDGET, hookTimeout: BUDGET },
    ]);
  });
});

describe("the shard sequencer", () => {
  type Spec = { moduleId: string; project: { name: string } };
  // The sequencer reads two fields of the context and of each spec, so stand-ins suffice.
  const Sequencer = viteConfig.test?.sequence?.sequencer as unknown as new (ctx: {
    config: { shard: { index: number; count: number } };
  }) => { shard(specs: Spec[]): Promise<Spec[]> };
  const specs: Spec[] = projects.flatMap(({ name, files }) =>
    [...files].map((file) => ({ moduleId: join(ROOT, file), project: { name } })),
  );
  const deal = (count: number) =>
    Promise.all(
      Array.from({ length: count }, (_, i) =>
        new Sequencer({ config: { shard: { index: i + 1, count } } }).shard(specs),
      ),
    );

  it.each([2, 4])("puts every test file in exactly one of %i shards", async (count) => {
    const shards = await deal(count);
    const dealt = shards.flat().map((s) => s.moduleId);
    expect(dealt.toSorted()).toEqual(specs.map((s) => s.moduleId).toSorted());
    expect(shards.every((s) => s.length > 0)).toBe(true);
  });

  it.each([2, 4])("keeps each project's %i shards within one file's bytes", async (count) => {
    const shards = await deal(count);
    for (const { name } of projects) {
      const bytes = shards.map((s) =>
        s.filter((f) => f.project.name === name).reduce((n, f) => n + statSync(f.moduleId).size, 0),
      );
      const largest = Math.max(
        ...specs.filter((f) => f.project.name === name).map((f) => statSync(f.moduleId).size),
      );
      expect(Math.max(...bytes) - Math.min(...bytes), name).toBeLessThanOrEqual(largest);
    }
  });
});
