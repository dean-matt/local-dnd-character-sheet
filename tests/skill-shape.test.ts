import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findForbidden, lineCount, ROOT, read } from "./lib/doc-helpers.ts";

/**
 * Fence for .claude/skills/. A skill is one file with a hard cap: skills are
 * written by an agent, read by an agent, and reviewed by nobody on a schedule,
 * which is how a single skill grows into a thousand lines of prose.
 *
 * Past the cap it is two skills, or it belongs in docs/. There is deliberately no
 * cap on the NUMBER of skills — that would punish real growth. Instead every skill
 * is indexed in CLAUDE.md, so they compete for that file's budget.
 */
const MAX_LINES = 100;
const SKILLS_DIR = join(ROOT, ".claude/skills");

const skills = readdirSync(SKILLS_DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name);

describe(".claude/skills/", () => {
  it("has at least one skill", () => {
    expect(skills.length).toBeGreaterThan(0);
  });

  it.each(skills)("%s has a SKILL.md", (skill) => {
    expect(readdirSync(join(SKILLS_DIR, skill))).toContain("SKILL.md");
  });

  it.each(skills)("%s is a single file", (skill) => {
    const files = readdirSync(join(SKILLS_DIR, skill));
    expect(
      files,
      `${skill} has extra files. A skill is one file — split it into two skills, or move the detail to docs/.`,
    ).toEqual(["SKILL.md"]);
  });

  it.each(skills)("%s is at most 100 lines", (skill) => {
    const actual = lineCount(read(`.claude/skills/${skill}/SKILL.md`));
    expect(
      actual,
      `${skill}/SKILL.md is ${actual} lines. Split it or move detail to docs/.`,
    ).toBeLessThanOrEqual(MAX_LINES);
  });

  it.each(skills)("%s has frontmatter with a name and description", (skill) => {
    const body = read(`.claude/skills/${skill}/SKILL.md`);
    expect(body.startsWith("---\n"), `${skill}/SKILL.md needs YAML frontmatter`).toBe(true);
    expect(body).toMatch(/\nname:\s*\S+/);
    expect(body).toMatch(/\ndescription:\s*\S+/);
  });

  it.each(skills)("%s describes what is true now", (skill) => {
    expect(findForbidden(read(`.claude/skills/${skill}/SKILL.md`))).toEqual([]);
  });
});
