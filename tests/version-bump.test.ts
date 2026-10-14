import { describe, expect, it } from "vitest";
import { checkVersionBump } from "../scripts/version-bump.mjs";

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
