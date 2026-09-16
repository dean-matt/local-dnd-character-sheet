import { describe, expect, it } from "vitest";
import { read } from "./lib/doc-helpers.ts";

/**
 * The other half of merge-pr's severity gate. audit-pr defines the severity a finding
 * carries and merge-pr reads it back out of the posted comment with one jq expression,
 * so a severity the table defines and the expression cannot parse is invisible at the
 * gate — and the gate's whole job is to stop on the severities it cannot see.
 */
const AUDIT = read(".claude/skills/audit-pr/SKILL.md");
const MERGE = read(".claude/skills/merge-pr/SKILL.md");

/** The first cell of every row in audit-pr's severity table, header and rule dropped. */
function severities(): string[] {
  const rows = AUDIT.slice(AUDIT.indexOf("| Severity | Means |")).split("\n").slice(2);
  const end = rows.findIndex((row) => !row.startsWith("|"));
  return rows.slice(0, end === -1 ? rows.length : end).map((row) => {
    const severity = /^\|\s*`([a-z]+)`/.exec(row)?.[1];
    if (!severity) throw new Error(`a severity row this fence cannot read: ${row}`);
    return severity;
  });
}

/** merge-pr's `$sev` as a JavaScript regex: inside a jq string every backslash is doubled. */
function marker(): RegExp {
  const matched = /^sev='capture\("([^"]+)"\)/m.exec(MERGE);
  if (!matched)
    throw new Error("merge-pr assigns no sev='capture(\"…\")' — the gate reads nothing");
  return new RegExp((matched[1] as string).replaceAll("\\\\", "\\"));
}

describe("the severity the merge gate reads", () => {
  it("has a table to read", () => {
    expect(severities().length, "audit-pr's severity table matched no rows").toBeGreaterThan(0);
  });

  it.each(severities())("parses a %s finding", (severity) => {
    expect(
      marker().exec(`**${severity}** — the finding`)?.groups?.s,
      `merge-pr cannot read a ${severity} finding, so the gate passes one. Widen the alternation in .claude/skills/merge-pr/SKILL.md.`,
    ).toBe(severity);
  });

  it("parses the finding audit-pr writes", () => {
    const example = /## What a finding says[\s\S]*?```\n([\s\S]*?)```/.exec(AUDIT)?.[1];
    expect(example, "audit-pr shows no example finding under its own heading").toBeDefined();
    expect(
      severities(),
      "the example reads as a comment body, and the gate parses one from its first character",
    ).toContain(marker().exec(example as string)?.groups?.s);
  });
});
