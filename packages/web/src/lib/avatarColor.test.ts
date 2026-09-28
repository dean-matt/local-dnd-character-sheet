import { describe, expect, it } from "vitest";
import { avatarColor } from "./avatarColor.ts";

describe("avatarColor", () => {
  it("gives one id the same color every time", () => {
    expect(avatarColor("abc")).toBe(avatarColor("abc"));
  });

  it("always answers with a palette color, whatever the id", () => {
    for (const id of ["", "1", "abc", "8f0c2d6e-77aa-4c1e-9b7d-0d2f5a3b1c44"]) {
      expect(avatarColor(id)).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("spreads ids over more than one color", () => {
    const colors = new Set(["1", "2", "3", "4", "5", "6"].map(avatarColor));
    expect(colors.size).toBeGreaterThan(1);
  });
});
