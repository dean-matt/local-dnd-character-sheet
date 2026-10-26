import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findForbidden, ROOT, read } from "./lib/doc-helpers.ts";

/**
 * Structural fence for CLAUDE.md. It is read at the start of every task, so every line
 * earns its place, but a line count only rewards denser, worse prose; the maintenance
 * rules in the file itself and review hold the size.
 */

describe("CLAUDE.md", () => {
  const claudeMd = read("CLAUDE.md");

  it("indexes every skill", () => {
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
