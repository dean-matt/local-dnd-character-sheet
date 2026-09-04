import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findForbidden, lineCount, ROOT, read } from "./lib/doc-helpers.ts";

/**
 * Size fence for CLAUDE.md. Unlike the README, this file is read at the start of
 * every task, so its length is a tax on all future work rather than a one-time
 * read. That is why it has a hard cap and the README does not.
 *
 * Detail that only some tasks need belongs in a skill; anything that must always
 * apply belongs here. Overflow is a signal to extract, not to raise the cap.
 */
const MAX_LINES = 150;

describe("CLAUDE.md", () => {
  const claudeMd = read("CLAUDE.md");

  it(`is at most ${MAX_LINES} lines`, () => {
    const actual = lineCount(claudeMd);
    expect(
      actual,
      `CLAUDE.md is ${actual} lines. Move detail into a skill or docs/ rather than raising the cap.`,
    ).toBeLessThanOrEqual(MAX_LINES);
  });

  it("indexes every skill, so skills compete for the same budget", () => {
    const skills = readdirSync(join(ROOT, ".claude/skills"), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
    for (const skill of skills) {
      expect(claudeMd, `skill "${skill}" is not listed in CLAUDE.md`).toContain(skill);
    }
  });

  it("describes what is true now, not what changed", () => {
    expect(findForbidden(claudeMd)).toEqual([]);
  });
});
