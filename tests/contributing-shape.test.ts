import { readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { deepHeadings, findForbidden, headings, ROOT, read } from "./lib/doc-helpers.ts";

/**
 * Structure fence for CONTRIBUTING.md. Its job is the reasoning behind rules that
 * are asserted elsewhere — which is exactly the job that accumulates, so it gets
 * a section list like the README rather than an open field.
 */
const SECTIONS = [
  "Getting set up",
  "Branching and commits",
  "Picking up work",
  "Maintaining the README",
  "Maintaining CLAUDE.md",
  "Code comments",
  "Working with Claude here",
];

describe("CONTRIBUTING.md", () => {
  const contributing = read("CONTRIBUTING.md");

  it("uses exactly the agreed sections, in order", () => {
    expect(headings(contributing, 2)).toEqual(SECTIONS);
  });

  it("never goes deeper than level 3", () => {
    expect(deepHeadings(contributing, 4)).toEqual([]);
  });

  it("describes what is true now, not what changed", () => {
    expect(findForbidden(contributing)).toEqual([]);
  });
});

describe("commit scopes", () => {
  it("name every package, plus the repository-level scopes, in commitlint and CONTRIBUTING.md alike", async () => {
    const config = (await import(pathToFileURL(join(ROOT, "commitlint.config.js")).href)) as {
      default: { rules: { "scope-enum": [number, string, string[]] } };
    };
    const allowed = config.default.rules["scope-enum"][2];
    const packages = readdirSync(join(ROOT, "packages"));
    expect(allowed.filter((scope) => !["docs", "repo", "deps"].includes(scope)).sort()).toEqual(
      packages.sort(),
    );
    const sentence = read("CONTRIBUTING.md").match(/scopes are([^.]*)\./s)?.[1] ?? "";
    const listed = [...sentence.matchAll(/`([a-z]+)`/g)].map((m) => m[1]);
    expect(listed.sort()).toEqual([...allowed].sort());
  });
});
