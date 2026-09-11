import { globSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import viteConfig from "../vitest.config.ts";
import { ROOT } from "./lib/doc-helpers.ts";

/**
 * Fences the project split. A test file outside every include glob never runs and
 * nothing says so; a budget written on one project reaches only the files that
 * project claims.
 */
const resolve = (patterns: string[]): Set<string> =>
  new Set(
    patterns.flatMap((pattern) =>
      globSync(pattern, { cwd: ROOT }).map((path) => path.replaceAll("\\", "/")),
    ),
  );

const projects = (viteConfig.test?.projects ?? []).flatMap((project) => {
  if (typeof project !== "object" || !("test" in project) || !project.test) return [];
  const { name, include, testTimeout } = project.test;
  return [
    {
      name: typeof name === "string" ? name : (name?.label ?? "unnamed"),
      files: resolve(include ?? []),
      testTimeout,
    },
  ];
});

const testFiles = [...resolve(["packages/*/src/**/*.test.{ts,tsx}", "tests/**/*.test.ts"])];

const budgeted = projects.filter(({ testTimeout }) => testTimeout !== undefined);

const DATABASE_IMPORT = /from ["']better-sqlite3["']/;

/** Reads a database through a path, so its cost is the runner's filesystem. */
const opensDatabaseOnDisk = (file: string) =>
  DATABASE_IMPORT.test(readFileSync(join(ROOT, file), "utf8"));

describe("vitest projects", () => {
  it("finds test files to check", () => {
    expect(testFiles.length).toBeGreaterThan(0);
  });

  it.each(testFiles)("%s runs under exactly one project", (file) => {
    expect(projects.filter(({ files }) => files.has(file)).map(({ name }) => name)).toHaveLength(1);
  });

  it("states the slow-filesystem budget on one project", () => {
    expect(budgeted.map(({ name }) => name)).toEqual(["content"]);
  });

  it("runs every test that opens a database on disk under that budget", () => {
    const unbudgeted = testFiles
      .filter(opensDatabaseOnDisk)
      .filter((file) => !budgeted.some(({ files }) => files.has(file)));

    expect(unbudgeted).toEqual([]);
  });
});
