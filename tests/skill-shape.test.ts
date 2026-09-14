import { existsSync, readdirSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { deepHeadings, findForbidden, lineCount, links, ROOT, read } from "./lib/doc-helpers.ts";

/**
 * Fence for .claude/skills/. A skill is written by an agent, read by an agent, and
 * reviewed by nobody on a schedule, which is how one grows into a thousand lines of
 * prose. SKILL.md keeps a hard cap: past it the skill is two skills.
 *
 * A skill may carry reference documents beside it: detail only one skill needs has no
 * business in docs/, where a human reads reference and every file takes a README row.
 * A thousand lines comes from a file with no subject, so the fence sits on the names
 * and the links rather than the count — each document is named for what it holds,
 * SKILL.md cites it at the step that needs it, and a second skill citing it sends it
 * to docs/.
 *
 * There is deliberately no cap on the NUMBER of skills, or of documents inside one —
 * that would punish real growth. Every skill is indexed in CLAUDE.md, so they compete
 * for that file's budget.
 */
const MAX_SKILL_LINES = 100;
const MAX_REFERENCE_LINES = 200;

const SKILLS_DIR = join(ROOT, ".claude/skills");

const KEBAB_MARKDOWN = /^[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;

/**
 * Names for a document's position rather than its subject. A reference.md takes
 * whatever does not fit and has no natural stopping point; a file named for what it
 * holds does. A starting set, not a complete one — grow it from what later changes
 * delete.
 */
const FORBIDDEN_NAMES = new Set([
  "appendix",
  "common",
  "context",
  "data",
  "details",
  "doc",
  "docs",
  "extra",
  "guide",
  "index",
  "info",
  "misc",
  "more",
  "notes",
  "readme",
  "reference",
  "shared",
  "temp",
]);

const skills = readdirSync(SKILLS_DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name);

function entries(skill: string) {
  return readdirSync(join(SKILLS_DIR, skill), { withFileTypes: true });
}

function files(skill: string): string[] {
  return entries(skill).map((e) => e.name);
}

function references(skill: string): string[] {
  return files(skill).filter((name) => name !== "SKILL.md");
}

/** Every distinct path a skill cites, resolved from the skill's own directory. */
function cites(skill: string): Set<string> {
  const dir = join(SKILLS_DIR, skill);
  return new Set(links(read(`.claude/skills/${skill}/SKILL.md`)).map((l) => resolve(dir, l)));
}

describe(".claude/skills/", () => {
  it("has at least one skill", () => {
    expect(skills.length).toBeGreaterThan(0);
  });

  it.each(skills)("%s has a SKILL.md", (skill) => {
    expect(files(skill), `${skill} needs a SKILL.md`).toContain("SKILL.md");
  });

  it.each(skills)("%s holds markdown and nothing else", (skill) => {
    for (const entry of entries(skill)) {
      expect(
        entry.isFile(),
        `${skill}/${entry.name} is not a file. A skill directory is flat markdown — put a script or a fixture in the package it belongs to.`,
      ).toBe(true);
      expect(
        entry.name === "SKILL.md" || KEBAB_MARKDOWN.test(entry.name),
        `${skill}/${entry.name} is not kebab-case markdown. Rename it to something like spell-slots.md.`,
      ).toBe(true);
    }
  });

  it.each(skills)("%s names every document for its subject", (skill) => {
    for (const name of references(skill)) {
      const subject = name.replace(/\.md$/, "");
      expect(
        FORBIDDEN_NAMES.has(subject),
        `${skill}/${name} is named for its position, not its subject. Name it for what it holds, so it has somewhere to stop.`,
      ).toBe(false);
    }
  });

  it.each(skills)("%s SKILL.md is at most 100 lines", (skill) => {
    const actual = lineCount(read(`.claude/skills/${skill}/SKILL.md`));
    expect(
      actual,
      `${skill}/SKILL.md is ${actual} lines. Split the skill, or move detail into a reference document beside it.`,
    ).toBeLessThanOrEqual(MAX_SKILL_LINES);
  });

  it.each(skills)("%s documents are at most 200 lines", (skill) => {
    for (const name of references(skill)) {
      const actual = lineCount(read(`.claude/skills/${skill}/${name}`));
      expect(
        actual,
        `${skill}/${name} is ${actual} lines — it covers two subjects, so split it rather than raising the cap.`,
      ).toBeLessThanOrEqual(MAX_REFERENCE_LINES);
    }
  });

  it.each(skills)("%s documents never go deeper than level 3", (skill) => {
    for (const name of references(skill)) {
      expect(
        deepHeadings(read(`.claude/skills/${skill}/${name}`), 4),
        `${skill}/${name} goes past a level 3 heading — flatten it, or split the subject out.`,
      ).toEqual([]);
    }
  });

  it.each(skills)("%s cites every document it carries", (skill) => {
    const cited = cites(skill);
    for (const name of references(skill)) {
      expect(
        cited.has(join(SKILLS_DIR, skill, name)),
        `${skill}/${name} is not linked from ${skill}/SKILL.md. Cite it at the step that needs it, or delete it — an uncited document is never read.`,
      ).toBe(true);
    }
  });

  it.each(skills)("%s links only to files that exist", (skill) => {
    for (const target of cites(skill)) {
      expect(
        existsSync(target),
        `${skill}/SKILL.md links to "${relative(ROOT, target)}", which does not exist. Fix the path or write the file.`,
      ).toBe(true);
    }
  });

  it("cites no document from two skills", () => {
    const owner = new Map<string, string>();
    for (const skill of skills) {
      for (const target of cites(skill)) {
        if (!target.startsWith(SKILLS_DIR + sep)) continue;
        const first = owner.get(target);
        expect(
          first,
          `${relative(ROOT, target)} is cited by both ${first} and ${skill}. A second citation means it belongs in docs/ with a README row.`,
        ).toBeUndefined();
        owner.set(target, skill);
      }
    }
  });

  it.each(skills)("%s has frontmatter with a name and description", (skill) => {
    const body = read(`.claude/skills/${skill}/SKILL.md`);
    expect(body.startsWith("---\n"), `${skill}/SKILL.md needs YAML frontmatter`).toBe(true);
    expect(body).toMatch(/\nname:\s*\S+/);
    expect(body).toMatch(/\ndescription:\s*\S+/);
  });

  it.each(skills)("%s describes what is true now", (skill) => {
    for (const name of files(skill)) {
      expect(
        findForbidden(read(`.claude/skills/${skill}/${name}`)),
        `${skill}/${name} narrates a past revision — describe what is true now.`,
      ).toEqual([]);
    }
  });
});
