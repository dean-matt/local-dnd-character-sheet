import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ROOT, read } from "./lib/doc-helpers.ts";

/**
 * The other half of merge-pr's migration fence. That skill greps a pull request's
 * diff for `packages/api/drizzle/` and holds a migration back for the user, and
 * that path is drizzle-kit's `out` copied into prose. Moving `out` touches only a
 * config file the fence does not cover, so the drift merges itself and every
 * migration afterwards lands where the grep cannot see it.
 *
 * The configs are read off disk rather than named, because a third one writing
 * somewhere else is the same drift arriving by another route.
 */
const FENCE = "packages/api/drizzle/";
const OUT = /out:\s*"\.\/([^"]+)"/;

const CONFIGS = readdirSync(join(ROOT, "packages/api")).filter((name) =>
  /^drizzle.*\.config\.ts$/.test(name),
);

describe("merge-pr's migration fence", () => {
  it("has configs to read", () => {
    expect(
      CONFIGS.length,
      "no packages/api/drizzle*.config.ts matched, so every case below would vanish silently",
    ).toBeGreaterThan(0);
  });

  it.each(CONFIGS)("%s writes migrations inside it", (config) => {
    const matched = OUT.exec(read(`packages/api/${config}`));
    expect(matched, `packages/api/${config} declares no out:`).not.toBeNull();
    const out = `packages/api/${matched?.[1]}`;
    expect(
      out.startsWith(FENCE),
      `packages/api/${config} writes migrations to "${out}", which merge-pr does not fence. Widen the grep in .claude/skills/merge-pr/SKILL.md, or move the output back.`,
    ).toBe(true);
  });

  it("is the pattern the skill greps for", () => {
    expect(read(".claude/skills/merge-pr/SKILL.md")).toContain(`^${FENCE}`);
  });
});
