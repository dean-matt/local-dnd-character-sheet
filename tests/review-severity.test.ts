import { describe, expect, it } from "vitest";
import { severity } from "../scripts/merge-gate.mjs";
import { read } from "./lib/doc-helpers.ts";

/**
 * The other half of the merge gate's severity condition. audit-pr's table defines the
 * vocabulary and the gate reads it back out of a posted comment, so a severity the table
 * defines and the gate cannot parse is invisible where it matters most — and the gate's
 * whole job is to stop on the severities it cannot see.
 */
const AUDIT = read(".claude/skills/audit-pr/SKILL.md");

/** The first cell of every row in audit-pr's severity table, header and rule dropped. */
function severities(): string[] {
  const rows = AUDIT.slice(AUDIT.indexOf("| Severity | Means |")).split("\n").slice(2);
  const end = rows.findIndex((row) => !row.startsWith("|"));
  return rows.slice(0, end === -1 ? rows.length : end).map((row) => {
    const name = /^\|\s*`([a-z]+)`/.exec(row)?.[1];
    if (!name) throw new Error(`a severity row this fence cannot read: ${row}`);
    return name;
  });
}

describe("the severity the merge gate reads", () => {
  it("has a table to read", () => {
    expect(severities().length, "audit-pr's severity table matched no rows").toBeGreaterThan(0);
  });

  it.each(severities())("parses a %s finding", (name) => {
    expect(
      severity(`**${name}** — the finding`),
      `the gate cannot read a ${name} finding, so it blocks every pass that reports one. Widen MARKER in scripts/merge-gate.mjs.`,
    ).toBe(name);
  });

  it("parses the finding audit-pr writes", () => {
    const example = /## What a finding says[\s\S]*?```\n([\s\S]*?)```/.exec(AUDIT)?.[1];
    expect(example, "audit-pr shows no example finding under its own heading").toBeDefined();
    expect(
      severities(),
      "the example reads as a comment body, and the gate parses one from its first character",
    ).toContain(severity(example as string));
  });
});
