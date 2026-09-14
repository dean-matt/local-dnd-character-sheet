import { describe, expect, it } from "vitest";
import { checkRewrite } from "../scripts/no-rewrite.mjs";

/**
 * Fence for the rule that a pushed commit stays as it is. The script reads the
 * upstream from git, so the decision it delegates to is the part worth testing.
 */
describe("checkRewrite", () => {
  it("allows a branch that has never been pushed", () => {
    expect(checkRewrite({ upstream: null, upstreamIsAncestor: true })).toBeNull();
  });

  it("allows a push that only adds commits", () => {
    expect(checkRewrite({ upstream: "origin/feat/1-slug", upstreamIsAncestor: true })).toBeNull();
  });

  it("rejects a push that drops a commit the remote holds", () => {
    expect(checkRewrite({ upstream: "origin/feat/1-slug", upstreamIsAncestor: false })).toBe(
      "Pushing drops commits that origin/feat/1-slug already holds.",
    );
  });
});
