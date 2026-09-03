import { describe, expect, it } from "vitest";
import { checkBranchName } from "../scripts/branch-name.mjs";

/**
 * Fence for the branch naming rule. The script itself reads the current branch,
 * so the check it delegates to is the only part worth testing.
 */
describe("checkBranchName", () => {
  it.each([
    "feat/1-zod-character-schemas",
    "fix/23-multiclass-slot-lookup",
    "chore/11-ci-fixtures",
  ])("accepts %s", (branch) => {
    expect(checkBranchName(branch)).toBeNull();
  });

  it.each([
    ["zod-character-schemas", "no type"],
    ["feature/1-zod-schemas", "a type that is not a commit type"],
    ["feat/zod-schemas", "no issue number"],
    ["feat/1-Zod-Schemas", "capitals"],
    ["feat/1-zod schemas", "a space"],
    ["main", "the default branch"],
  ])("rejects %s — %s", (branch) => {
    expect(checkBranchName(branch)).toBeTypeOf("string");
  });

  it("ignores a detached HEAD, so a rebase or bisect can still commit", () => {
    expect(checkBranchName(null)).toBeNull();
    expect(checkBranchName("HEAD")).toBeNull();
  });
});
