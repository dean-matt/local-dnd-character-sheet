import { existsSync, globSync, readFileSync } from "node:fs";
import { join, posix } from "node:path";
import { describe, expect, it } from "vitest";
import viteConfig from "../vitest.config.ts";
import { ROOT } from "./lib/doc-helpers.ts";

/**
 * Fences the project split. A test file outside every include glob never runs and
 * nothing says so; a budget written on one project reaches only the files that
 * project claims.
 */
const SKIP_DIRS = new Set(["node_modules", "dist", "vendor"]);

const posixPaths = (patterns: string[]): string[] =>
  patterns.flatMap((pattern) =>
    globSync(pattern, {
      cwd: ROOT,
      exclude: (path) => SKIP_DIRS.has(String(path).split(/[\\/]/).pop() as string),
    }).map((path) => path.replaceAll("\\", "/")),
  );

/** The files a project runs: what its globs match, less what it excludes. */
function claimed(include: string[], exclude: string[]): Set<string> {
  const files = new Set(posixPaths(include));
  for (const file of posixPaths(exclude)) files.delete(file);
  return files;
}

const projects = (viteConfig.test?.projects ?? []).flatMap((project) => {
  if (typeof project !== "object" || !("test" in project) || !project.test) return [];
  const { name, include, exclude, testTimeout } = project.test;
  return [
    {
      name: typeof name === "string" ? name : (name?.label ?? "unnamed"),
      files: claimed(include ?? [], exclude ?? []),
      testTimeout,
    },
  ];
});

const testFiles = posixPaths(["**/*.test.{ts,tsx}"]);

const budgeted = projects.filter(({ testTimeout }) => testTimeout !== undefined);

const DATABASE = /from ["']better-sqlite3["']/;
const IMPORTS = /(?:from|import)\s*\(?\s*["']([^"']+)["']/g;
const WORKSPACE = "@dnd/";

const read = (file: string) => readFileSync(join(ROOT, file), "utf8");

/** The entry a workspace name resolves to, so the walk follows `@dnd/rules`. */
function workspaceEntry(specifier: string): string | undefined {
  const dir = `packages/${specifier.slice(WORKSPACE.length)}`;
  if (!existsSync(join(ROOT, dir, "package.json"))) return undefined;
  const { exports } = JSON.parse(read(`${dir}/package.json`)) as {
    exports?: Record<string, string>;
  };
  const entry = exports?.["."];
  return entry ? posix.join(dir, entry) : undefined;
}

function target(specifier: string, importer: string): string | undefined {
  if (specifier.startsWith(".")) return posix.join(posix.dirname(importer), specifier);
  if (specifier.startsWith(WORKSPACE)) return workspaceEntry(specifier);
  return undefined;
}

/**
 * Whether the module graph rooted at a test reaches a database on disk, so the
 * test's cost is the runner's filesystem. Grepping the test alone would miss one
 * that opens a database through a helper.
 */
function reachesDatabase(entry: string): boolean {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (seen.has(file) || !existsSync(join(ROOT, file))) continue;
    seen.add(file);
    const source = read(file);
    if (DATABASE.test(source)) return true;
    for (const [, specifier] of source.matchAll(IMPORTS)) {
      const next = target(specifier as string, file);
      if (next) queue.push(next);
    }
  }
  return false;
}

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

  it("finds tests that open a database on disk", () => {
    expect(testFiles.filter(reachesDatabase).length).toBeGreaterThan(0);
  });

  it("runs every test that opens a database on disk under that budget", () => {
    const unbudgeted = testFiles
      .filter(reachesDatabase)
      .filter((file) => !budgeted.some(({ files }) => files.has(file)));

    expect(unbudgeted).toEqual([]);
  });
});
