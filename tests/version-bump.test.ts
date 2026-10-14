import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { capture } from "../scripts/capture.mjs";
import { changedFiles, checkVersionBump } from "../scripts/version-bump.mjs";

describe("checkVersionBump", () => {
  const code = ["packages/web/src/AppVersion.tsx"];

  it.each([
    ["0.5.1", "0.5.0", "a patch"],
    ["0.6.0", "0.5.3", "a minor"],
    ["1.0.0", "0.9.9", "a major"],
  ])("accepts %s over %s — %s", (version, base) => {
    expect(checkVersionBump({ changed: code, version, base })).toBeNull();
  });

  it.each([
    ["0.5.0", "0.5.0", "unchanged"],
    ["0.4.9", "0.5.0", "lowered"],
    ["0.5.10", "0.6.0", "behind a minor main raised"],
  ])("rejects %s over %s — %s", (version, base) => {
    expect(checkVersionBump({ changed: code, version, base })).toBeTypeOf("string");
  });

  it("needs no bump where only prose or the mockup changed", () => {
    const changed = ["docs/mockup/components/TopBar.dc.html", ".claude/skills/open-pr/SKILL.md"];
    expect(checkVersionBump({ changed, version: "0.5.0", base: "0.5.0" })).toBeNull();
  });

  it("needs no bump where nothing changed, as on main", () => {
    expect(checkVersionBump({ changed: [], version: "0.5.0", base: "0.5.0" })).toBeNull();
  });

  it("rejects a version that is not MAJOR.MINOR.PATCH", () => {
    expect(checkVersionBump({ changed: [], version: "0.5", base: "0.5.0" })).toBeTypeOf("string");
  });
});

describe("changedFiles", () => {
  it("counts only what the branch changed, though main moved on after it left", () => {
    const dir = mkdtempSync(join(tmpdir(), "version-bump-"));
    const git = (...args: string[]) =>
      capture("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd: dir });
    const commit = (file: string) => {
      writeFileSync(join(dir, file), file);
      git("add", file);
      git("commit", "-qm", file);
    };
    try {
      git("init", "-q", "-b", "main");
      commit("start.ts");
      git("checkout", "-qb", "docs/1-notes");
      commit("notes.md");
      git("checkout", "-q", "main");
      commit("moved.ts");
      git("update-ref", "refs/remotes/origin/main", "main");
      git("checkout", "-q", "docs/1-notes");

      expect(changedFiles("origin/main", dir)).toEqual(["notes.md"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
