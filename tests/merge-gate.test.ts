import { describe, expect, it } from "vitest";
import { read } from "./lib/doc-helpers.ts";

/**
 * The other half of merge-pr's migration fence. That skill greps a pull request's
 * diff for `packages/api/drizzle/` and holds a migration back for the user, and
 * that path is drizzle-kit's `out` copied into prose. Moving `out` touches only a
 * config file the fence does not cover, so the drift merges itself and every
 * migration afterwards lands where the grep cannot see it.
 */
const CONFIGS = ["drizzle.config.ts", "drizzle.homebrew.config.ts"];
const FENCE = "packages/api/drizzle/";
const OUT = /out:\s*"\.\/([^"]+)"/;

describe("merge-pr's migration fence", () => {
  it.each(CONFIGS)("%s writes migrations inside it", (config) => {
    const matched = OUT.exec(read(`packages/api/${config}`));
    expect(matched, `packages/api/${config} declares no out:`).not.toBeNull();
    const out = `packages/api/${matched?.[1]}`;
    expect(
      out.startsWith(FENCE),
      `packages/api/${config} writes migrations to "${out}", which merge-pr does not fence. Widen the grep in .claude/skills/merge-pr/SKILL.md, or move the output back.`,
    ).toBe(true);
  });

  it("is the path the skill greps for", () => {
    expect(read(".claude/skills/merge-pr/SKILL.md")).toContain(FENCE);
  });
});
