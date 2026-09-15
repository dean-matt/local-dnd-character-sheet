import { existsSync, readdirSync } from "node:fs";
import { basename, join, relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
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
const MAX_SKILL_LINES = 150;
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

/** Skip dotfiles: a fence must not fail on a .DS_Store that git already ignores. */
function entries(skill: string) {
  return readdirSync(join(SKILLS_DIR, skill), { withFileTypes: true }).filter(
    (e) => !e.name.startsWith("."),
  );
}

function files(skill: string): string[] {
  return entries(skill)
    .filter((e) => e.isFile())
    .map((e) => e.name);
}

function references(skill: string): string[] {
  return files(skill).filter((name) => name !== "SKILL.md");
}

/** Where one file's links land. A skill directory is flat, so a relative link resolves from it. */
function targets(skill: string, file: string): string[] {
  const dir = join(SKILLS_DIR, skill);
  return links(read(`.claude/skills/${skill}/${file}`)).map((l) =>
    l.startsWith("/") ? join(ROOT, l) : resolve(dir, l),
  );
}

/** Every distinct path the SKILL.md cites, which is what the citation rules read. */
function cites(skill: string): Set<string> {
  return new Set(targets(skill, "SKILL.md"));
}

const FRONTMATTER = /^---\n([\s\S]*?)\n---(?:\n|$)/;

/**
 * The frontmatter as a mapping, or a throw naming what stopped it. The loader parses
 * YAML, so matching the file text proves nothing: a description holding an unquoted
 * colon-space reads as a nested mapping, so a skill matching every regex still fails
 * to load.
 */
function frontmatter(body: string): Record<string, unknown> {
  const matched = FRONTMATTER.exec(body);
  if (!matched) throw new Error("no YAML frontmatter — open and close it with a --- line");
  let parsed: unknown;
  try {
    parsed = parse(matched[1] as string);
  } catch (error) {
    const reason = (error as Error).message.split("\n")[0];
    throw new Error(`YAML rejects the frontmatter: ${reason}. Quote any value holding a colon.`);
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("frontmatter is not a mapping — write it as name: value lines");
  }
  return parsed as Record<string, unknown>;
}

describe("frontmatter", () => {
  const skillFile = (lines: string) => `---\n${lines}\n---\n\n# Heading\n`;

  it("rejects a description holding an unquoted colon", () => {
    expect(() =>
      frontmatter(
        skillFile("name: audit-pr\ndescription: Review one pull request: the ladder, the tests."),
      ),
    ).toThrow(/YAML rejects/);
  });

  it("accepts that description quoted", () => {
    expect(
      frontmatter(
        skillFile('name: audit-pr\ndescription: "Review one pull request: the ladder, the tests."'),
      ),
    ).toEqual({
      name: "audit-pr",
      description: "Review one pull request: the ladder, the tests.",
    });
  });

  it("rejects a file with no frontmatter", () => {
    expect(() => frontmatter("# Heading\n")).toThrow(/no YAML frontmatter/);
  });

  it("rejects frontmatter that is not a mapping", () => {
    expect(() => frontmatter(skillFile("- add-endpoint\n- audit-pr"))).toThrow(/not a mapping/);
  });
});

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
        entry.isFile() && entry.name.endsWith(".md"),
        `${skill}/${entry.name} is not markdown. A skill directory is flat markdown — put a script, a fixture or a subdirectory in the package it belongs to.`,
      ).toBe(true);
      expect(
        entry.name === "SKILL.md" || KEBAB_MARKDOWN.test(entry.name),
        `${skill}/${entry.name} is not kebab-case. Rename it to something like spell-slots.md.`,
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

  it.each(skills)("%s SKILL.md is at most 150 lines", (skill) => {
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
    for (const name of files(skill)) {
      for (const target of targets(skill, name)) {
        expect(
          existsSync(target),
          `${skill}/${name} links to "${relative(ROOT, target)}", which does not exist. Fix the path or write the file.`,
        ).toBe(true);
      }
    }
  });

  it("cites no document from two skills", () => {
    const owner = new Map<string, string>();
    for (const skill of skills) {
      for (const target of cites(skill)) {
        if (!target.startsWith(SKILLS_DIR + sep)) continue;
        // A SKILL.md is the skill itself. Two may point at one, and it cannot take the
        // fix this rule names: moving to docs/.
        if (basename(target) === "SKILL.md") continue;
        const first = owner.get(target);
        expect(
          first,
          `${relative(ROOT, target)} is cited by both ${first} and ${skill}. A second citation means it belongs in docs/ with a README row.`,
        ).toBeUndefined();
        owner.set(target, skill);
      }
    }
  });

  it.each(skills)("%s has frontmatter naming and describing the skill", (skill) => {
    const data = frontmatter(read(`.claude/skills/${skill}/SKILL.md`));
    expect(data.name, `${skill}/SKILL.md must name the skill for its directory`).toBe(skill);
    expect(
      typeof data.description === "string" && data.description.trim().length > 0,
      `${skill}/SKILL.md needs a description — it is what routes a request to this skill`,
    ).toBe(true);
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
