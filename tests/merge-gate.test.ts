import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  blockingDeclines,
  blockingFindings,
  dependenciesDiffer,
  FENCE,
  lastPass,
  mergeBlocked,
  notGreen,
  severity,
  unanswered,
} from "../scripts/merge-gate.mjs";
import { ROOT, read } from "./lib/doc-helpers.ts";

/**
 * The merge gate's conditions, called directly. Every body below is copied verbatim from
 * a review this repository already posted: one pass wrote its severities backticked and
 * another wrote them in bold, which is the drift the gate exists to survive. A body
 * composed to match the parser would assert the parser back to itself.
 *
 * The envelope matters as much as the body. The API omits `in_reply_to_id` on a top-level
 * comment rather than sending null, so `finding()` omits it too — a fixture that sets it
 * to null hides the one bug this condition can have.
 */
const BACKTICKED = '`comment` — "It invokes" has a loose antecedent: the nearest nouns are';
const BOLD = "**critical** — `for id in $red` runs once with both ids as a single word.";
const DECLINED = "**Declined** — the trade stands as described. Replacing elapsed time";

const finding = (id: number, body: string) => ({
  id,
  body,
  html_url: `https://example.invalid/#discussion_r${id}`,
});

const reply = (id: number, body: string, inReplyTo: number) => ({
  ...finding(id, body),
  in_reply_to_id: inReplyTo,
});

describe("severity", () => {
  it("reads the backticked form one pass posted as unreadable", () => {
    expect(severity(BACKTICKED)).toBe("unreadable");
  });

  it.each([
    ["", "empty"],
    [" **critical** — x", "indented"],
    ["path.ts:42\n**critical** — x", "prefixed"],
  ])("reads a %s body as unreadable (%s)", (body) => {
    expect(severity(body)).toBe("unreadable");
  });
});

describe("the last review pass", () => {
  it("is the last review carrying a body, never a verdict reply", () => {
    const reviews = [
      { id: 1, body: "pass 1" },
      { id: 2, body: "" },
      { id: 3, body: "pass 2" },
      { id: 4, body: "" },
    ];
    expect(lastPass(reviews)?.id).toBe(3);
  });

  it("is null where no review carries a body", () => {
    expect(lastPass([{ id: 1, body: "" }])).toBeNull();
  });
});

describe("blocking findings", () => {
  it("keeps an unreadable marker rather than dropping it", () => {
    expect(blockingFindings([finding(1, BACKTICKED)])).toHaveLength(1);
  });

  it("keeps critical and warning, and lets comment through", () => {
    const findings = [
      finding(1, BOLD),
      finding(2, "**warning** — y"),
      finding(3, "**comment** — z"),
    ];
    expect(blockingFindings(findings)).toHaveLength(2);
  });
});

describe("thread verdicts", () => {
  const critical = finding(10, BOLD);

  it("reports a finding no reply answers", () => {
    expect(unanswered([critical])).toHaveLength(1);
  });

  it("accepts Applied and Declined alike", () => {
    expect(unanswered([critical, reply(11, "**Applied** in abc1234", 10)])).toEqual([]);
    expect(unanswered([critical, reply(12, DECLINED, 10)])).toEqual([]);
  });

  it("lets a declined comment through and stops a declined critical", () => {
    const taste = [finding(20, "**comment** — a taste call"), reply(21, DECLINED, 20)];
    expect(blockingDeclines(taste)).toEqual([]);
    expect(blockingDeclines([critical, reply(13, DECLINED, 10)])).toHaveLength(1);
  });

  it("stops a decline whose finding carries no readable marker", () => {
    const orphan = [finding(30, BACKTICKED), reply(31, DECLINED, 30)];
    expect(blockingDeclines(orphan)).toHaveLength(1);
  });
});

describe("the other three conditions", () => {
  it("counts every bucket but pass and skipping as not green", () => {
    const checks = [
      { name: "check", bucket: "pass" },
      { name: "corpus", bucket: "skipping" },
      { name: "e2e", bucket: "pending" },
      { name: "spellcheck", bucket: "fail" },
    ];
    expect(notGreen(checks)).toEqual(["e2e", "spellcheck"]);
  });

  it("stops a conflict and asks again on UNKNOWN", () => {
    expect(mergeBlocked({ mergeable: "MERGEABLE", mergeStateStatus: "CLEAN" })).toBeNull();
    expect(mergeBlocked({ mergeable: "CONFLICTING", mergeStateStatus: "CLEAN" })).not.toBeNull();
    expect(mergeBlocked({ mergeable: "MERGEABLE", mergeStateStatus: "DIRTY" })).not.toBeNull();
    expect(mergeBlocked({ mergeable: "UNKNOWN", mergeStateStatus: "BLOCKED" })).not.toBeNull();
  });

  it("stops a version bump and ignores a rename or a reordering", () => {
    const before = {
      name: "a",
      dependencies: { zod: "^3.0.0" },
      scripts: { dev: "x", build: "y" },
    };
    expect(dependenciesDiffer(before, { ...before, dependencies: { zod: "^3.1.0" } })).toBe(true);
    expect(dependenciesDiffer(before, { ...before, name: "b" })).toBe(false);
    expect(dependenciesDiffer(before, { ...before, scripts: { build: "y", dev: "x" } })).toBe(
      false,
    );
    const two = { ...before, dependencies: { zod: "^3.0.0", hono: "^4.0.0" } };
    expect(
      dependenciesDiffer(two, { ...two, dependencies: { hono: "^4.0.0", zod: "^3.0.0" } }),
    ).toBe(false);
    expect(dependenciesDiffer(before, { ...before, devDependencies: { vitest: "^4" } })).toBe(true);
  });
});

/**
 * The other half of the migration fence. `packages/api/drizzle/` is drizzle-kit's `out`,
 * and moving `out` touches only a config file the fence does not cover — so the drift
 * merges itself and every migration afterwards lands where the gate cannot see it. The
 * configs are read off disk rather than named, because a third one is the same drift
 * arriving by another route.
 */
const OUT = /out:\s*"\.\/([^"]+)"/;
const CONFIGS = readdirSync(join(ROOT, "packages/api")).filter((name) =>
  /^drizzle.*\.config\.ts$/.test(name),
);

describe("the migration fence", () => {
  it("has configs to read", () => {
    expect(CONFIGS.length, "no packages/api/drizzle*.config.ts matched").toBeGreaterThan(0);
  });

  it.each(CONFIGS)("%s writes migrations where the gate is watching", (config) => {
    const matched = OUT.exec(read(`packages/api/${config}`));
    expect(matched, `packages/api/${config} declares no out:`).not.toBeNull();
    const out = `packages/api/${matched?.[1]}`;
    expect(
      FENCE.test(out),
      `packages/api/${config} writes migrations to "${out}", which the gate does not fence. Widen FENCE in scripts/merge-gate.mjs, or move the output back.`,
    ).toBe(true);
  });

  it("fences every path the gate is meant to hold", () => {
    for (const path of [
      "CLAUDE.md",
      "CONTRIBUTING.md",
      "content.lock.json",
      "content.manifest.json",
      ".github/workflows/ci.yml",
      ".claude/skills/merge-pr/SKILL.md",
      "packages/api/drizzle/0001_init.sql",
    ]) {
      expect(FENCE.test(path), `${path} is not fenced`).toBe(true);
    }
    expect(FENCE.test("packages/rules/src/spell-slots.ts")).toBe(false);
    expect(FENCE.test("docs/data-model.md")).toBe(false);
  });
});
