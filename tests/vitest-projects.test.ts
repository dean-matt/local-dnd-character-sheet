import {
  existsSync,
  globSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, posix } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import viteConfig from "../vitest.config.ts";
import { ROOT } from "./lib/doc-helpers.ts";

/**
 * Fences the project split. A test file outside every include glob never runs and
 * nothing says so; a budget written on one project reaches only the files that
 * project claims.
 */
const SKIP_DIRS = new Set(["node_modules", "dist", "vendor"]);

/** The budget the content project states, repeated here so a change to it is deliberate. */
const BUDGET = 30_000;

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

const testFiles = posixPaths(["**/*.test.{ts,tsx}"]);

const budgeted = projects.filter(({ testTimeout }) => testTimeout !== undefined);

const DRIVER = "better-sqlite3";

/** A runtime import of the driver. A type-only import is erased and opens nothing. */
const DATABASE = new RegExp(`^(?!\\s*import\\s+type\\b).*from ["']${DRIVER}["']`, "m");

const IMPORTS = /(?:from|import)\s*\(?\s*["']([^"']+)["']/g;
const WORKSPACE = "@dnd/";

type Entry = string | Record<string, string>;

/** The file a workspace name resolves to, so the walk follows `@dnd/rules`. */
function workspaceEntry(specifier: string, root: string): string {
  const dir = `packages/${specifier.slice(WORKSPACE.length)}`;
  const { exports } = JSON.parse(readFileSync(join(root, dir, "package.json"), "utf8")) as {
    exports?: Record<string, Entry>;
  };
  const entry = exports?.["."];
  const path = typeof entry === "string" ? entry : (entry?.import ?? entry?.default);
  if (!path) throw new Error(`${specifier} declares no entry, so the walk cannot follow it`);
  return posix.join(dir, path);
}

function target(specifier: string, importer: string, root: string): string | undefined {
  if (specifier.startsWith(".")) return posix.join(posix.dirname(importer), specifier);
  if (specifier.startsWith(WORKSPACE)) return workspaceEntry(specifier, root);
  return undefined;
}

function sourceOf(root: string, file: string): string | undefined {
  const path = join(root, file);
  return existsSync(path) && statSync(path).isFile() ? readFileSync(path, "utf8") : undefined;
}

/**
 * Whether the module graph rooted at a test reaches a database on disk, so the
 * test's cost is the runner's filesystem. Grepping the test alone would miss one
 * that opens a database through a helper.
 */
function reachesDatabase(entry: string, root: string): boolean {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    const source = sourceOf(root, file);
    if (source === undefined) continue;
    if (DATABASE.test(source)) return true;
    for (const [, specifier] of source.matchAll(IMPORTS)) {
      const next = target(specifier as string, file, root);
      if (next) queue.push(next);
    }
  }
  return false;
}

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
    ).toEqual([{ name: "content", testTimeout: BUDGET, hookTimeout: BUDGET }]);
  });

  it("finds tests that open a database on disk", () => {
    expect(testFiles.filter((file) => reachesDatabase(file, ROOT)).length).toBeGreaterThan(0);
  });

  it("runs every test that opens a database on disk under that budget", () => {
    const unbudgeted = testFiles
      .filter((file) => reachesDatabase(file, ROOT))
      .filter((file) => !budgeted.some(({ files }) => files.has(file)));

    expect(unbudgeted).toEqual([]);
  });
});

describe("the walk to a database", () => {
  let workspace: string;

  const write = (file: string, source: string) => writeFileSync(join(workspace, file), source);

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), "vitest-projects-"));
  });

  afterEach(() => rmSync(workspace, { recursive: true, force: true }));

  it("follows a helper, so a test need not import the driver itself", () => {
    write(
      "helper.ts",
      `import Database from "${DRIVER}";\nexport const open = () => new Database("x");\n`,
    );
    write("reaches.test.ts", 'import { open } from "./helper.ts";\nopen();\n');
    write("does-not.test.ts", 'import { join } from "node:path";\njoin("a", "b");\n');

    expect(reachesDatabase("reaches.test.ts", workspace)).toBe(true);
    expect(reachesDatabase("does-not.test.ts", workspace)).toBe(false);
  });

  it("passes over a type-only import, which is erased and opens nothing", () => {
    write("types.test.ts", `import type Database from "${DRIVER}";\nexport type D = Database;\n`);

    expect(reachesDatabase("types.test.ts", workspace)).toBe(false);
  });

  it("survives a cycle rather than walking it forever", () => {
    write("a.test.ts", 'import "./b.ts";\n');
    write("b.ts", 'import "./a.test.ts";\n');

    expect(reachesDatabase("a.test.ts", workspace)).toBe(false);
  });

  it.each([
    ["./client.ts", "packages/api/src/db/x.test.ts", "packages/api/src/db/client.ts"],
    ["../load/json.ts", "packages/content/src/x.test.ts", "packages/content/load/json.ts"],
    ["@dnd/rules", "packages/api/src/x.test.ts", "packages/rules/src/index.ts"],
    ["node:fs", "tests/x.test.ts", undefined],
    ["vitest", "tests/x.test.ts", undefined],
  ])("resolves %s from %s", (specifier, importer, expected) => {
    expect(target(specifier, importer, ROOT)).toBe(expected);
  });

  it("refuses a workspace package that declares no entry", () => {
    expect(() => target("@dnd/api", "packages/api/src/x.test.ts", ROOT)).toThrow(/no entry/);
  });
});
