import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { deepHeadings, findForbidden, headings, ROOT, read } from "./lib/doc-helpers.ts";

/**
 * Structure fence for README.md. The README is onboarding only — install it, run
 * it, work on it — and everything else has an authoritative home elsewhere.
 *
 * Deliberately no length limit. A long command block or troubleshooting table is
 * not the problem; a section that belongs in docs/ is. Capping lines would push
 * reference content out of reach and reward denser, worse prose.
 *
 * The reasoning behind each rule is in CONTRIBUTING.md.
 */
const SECTIONS = [
  "Prerequisites",
  "Getting started",
  "Common commands",
  "Project structure",
  "Troubleshooting",
  "Further reading",
  "Contributing",
];

const OPTIONAL = new Set(["Troubleshooting"]);

/** Each was demoted deliberately, not forgotten. */
const NOT_SECTIONS = ["Architecture", "Conventions", "Status", "Roadmap", "Features"];

const COMPANIONS = ["CLAUDE.md", "CONTRIBUTING.md", "NOTICE"];

describe("README.md", () => {
  const readme = read("README.md");
  const found = headings(readme, 2);

  it("uses only the agreed sections", () => {
    expect(found).toEqual(SECTIONS.filter((s) => !OPTIONAL.has(s) || found.includes(s)));
  });

  it("has every required section", () => {
    for (const section of SECTIONS.filter((s) => !OPTIONAL.has(s))) {
      expect(found, `missing required section "${section}"`).toContain(section);
    }
  });

  it("has no demoted heading", () => {
    for (const banned of NOT_SECTIONS) {
      expect(found, `"${banned}" is demoted by design — see CONTRIBUTING.md`).not.toContain(banned);
    }
  });

  it("never goes deeper than level 3", () => {
    expect(deepHeadings(readme, 4)).toEqual([]);
  });

  it("indexes every docs/ file under Further reading", () => {
    const docs = readdirSync(join(ROOT, "docs")).filter((f) => f.endsWith(".md"));
    for (const doc of docs) {
      expect(readme, `docs/${doc} is not indexed in Further reading`).toContain(`docs/${doc}`);
    }
  });

  it("indexes the companion documents", () => {
    for (const file of COMPANIONS) {
      expect(readme, `${file} is not indexed in Further reading`).toContain(file);
    }
  });

  it("links only to files that exist", () => {
    const links = [...readme.matchAll(/\]\((?!https?:|mailto:|#)([^)\s]+)\)/g)].map(
      (m) => m[1] as string,
    );
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(existsSync(join(ROOT, link)), `README links to missing file "${link}"`).toBe(true);
    }
  });

  it("describes what is true now, not what changed", () => {
    expect(findForbidden(readme)).toEqual([]);
  });
});
