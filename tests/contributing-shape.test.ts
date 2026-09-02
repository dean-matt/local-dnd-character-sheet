import { describe, expect, it } from "vitest";
import { deepHeadings, findForbidden, headings, read } from "./lib/doc-helpers.ts";

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
