import { globSync } from "node:fs";
import { describe, expect, it } from "vitest";
import viteConfig from "../vitest.config.ts";
import { ROOT } from "./lib/doc-helpers.ts";

/**
 * Fences the project split. A test file outside every include glob never runs and
 * nothing says so, and a project declaring no glob claims every test file — both
 * of which pass a suite that looks green.
 */
const SKIP_DIRS = new Set(["node_modules", "dist", "vendor", "e2e"]);

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

const budgeted = projects.filter(
  ({ testTimeout, hookTimeout }) => testTimeout !== undefined || hookTimeout !== undefined,
);

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

  it("raises no project's timeout, since a slow test wants its setup fixed rather than longer", () => {
    expect(
      budgeted.map(({ name, testTimeout, hookTimeout }) => ({ name, testTimeout, hookTimeout })),
    ).toEqual([]);
  });
});
