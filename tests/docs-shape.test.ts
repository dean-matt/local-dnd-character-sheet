import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { deepHeadings, findForbidden, lineCount, ROOT, read } from "./lib/doc-helpers.ts";

/**
 * Fence for docs/. These are reference documents — read when a task needs them,
 * not on every task — so they get a generous cap rather than the README's shape
 * rules. Past the cap, a document is covering two subjects and should be split.
 */
const MAX_LINES = 200;

const docs = readdirSync(join(ROOT, "docs")).filter((f) => f.endsWith(".md"));

describe("docs/", () => {
  it("is not empty", () => {
    expect(docs.length).toBeGreaterThan(0);
  });

  it.each(docs)("%s is at most 200 lines", (doc) => {
    const actual = lineCount(read(`docs/${doc}`));
    expect(
      actual,
      `docs/${doc} is ${actual} lines — split it rather than raising the cap`,
    ).toBeLessThanOrEqual(MAX_LINES);
  });

  it.each(docs)("%s never goes deeper than level 3", (doc) => {
    expect(deepHeadings(read(`docs/${doc}`), 4)).toEqual([]);
  });

  it.each(docs)("%s describes what is true now", (doc) => {
    expect(findForbidden(read(`docs/${doc}`))).toEqual([]);
  });
});
