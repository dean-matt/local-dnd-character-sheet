import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { capture } from "../scripts/capture.mjs";
import { bumpedVersion, changedFiles } from "../scripts/version-bump.mjs";

describe("bumpedVersion", () => {
  const code = ["packages/web/src/routes/AppVersion.tsx"];
  const bump = (title: string, version = "0.5.3", changed = code) =>
    bumpedVersion({ changed, title, version, base: "0.5.3" });

  it("raises the minor for a feat, with or without a scope or a breaking mark", () => {
    expect(bump("feat: a thing")).toBe("0.6.0");
    expect(bump("feat(web): a thing")).toBe("0.6.0");
    expect(bump("feat(web)!: a thing")).toBe("0.6.0");
  });

  it("raises the patch for every other type", () => {
    expect(bump("fix(api): a thing")).toBe("0.5.4");
    expect(bump("chore(repo): feat of strength")).toBe("0.5.4");
    expect(bump("feature: a thing")).toBe("0.5.4");
  });

  it("raises over main's version, not the branch's", () => {
    expect(bump("fix: a thing", "0.5.0")).toBe("0.5.4");
  });

  it("leaves a version already above main's, so a rerun changes nothing", () => {
    expect(bump("fix: a thing", "0.5.4")).toBeNull();
    expect(bump("feat: a thing", "1.0.0")).toBeNull();
  });

  it("leaves the version where only prose or the mockup changed", () => {
    const changed = ["docs/mockup/components/TopBar.dc.html", ".claude/skills/open-pr/SKILL.md"];
    expect(bump("fix: a thing", "0.5.3", changed)).toBeNull();
    expect(bump("fix: a thing", "0.5.3", [])).toBeNull();
  });

  it("rejects a main version that is not MAJOR.MINOR.PATCH", () => {
    expect(() =>
      bumpedVersion({ changed: code, title: "fix: x", version: "0.5.0", base: "0.5" }),
    ).toThrow();
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
