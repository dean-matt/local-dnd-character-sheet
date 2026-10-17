import { sep } from "node:path";
import { describe, expect, it } from "vitest";
import { nextLock, posix } from "./sync.ts";

describe("posix", () => {
  it("leaves forward-slashed paths alone", () => {
    expect(posix("data/spells/spells-phb.json")).toBe("data/spells/spells-phb.json");
  });

  it("normalises the platform separator so lockfiles are portable", () => {
    const native = ["data", "spells", "spells-phb.json"].join(sep);
    expect(posix(native)).toBe("data/spells/spells-phb.json");
  });
});

describe("nextLock", () => {
  const previous = { tag: "v1", fetchedAt: "2026-01-01T00:00:00.000Z", files: { "a.json": "x" } };

  it("returns the previous lock when the tag and hashes match", () => {
    expect(nextLock(previous, "v1", { "a.json": "x" })).toBe(previous);
  });

  it("stamps a new lock when a hash, the tag or the file set changes", () => {
    expect(nextLock(previous, "v1", { "a.json": "y" }).fetchedAt).not.toBe(previous.fetchedAt);
    expect(nextLock(previous, "v2", { "a.json": "x" }).tag).toBe("v2");
    expect(nextLock(previous, "v1", { "a.json": "x", "b.json": "z" }).files).toHaveProperty(
      "b.json",
    );
  });

  it("stamps a lock when there was none", () => {
    expect(nextLock(undefined, "v1", {}).tag).toBe("v1");
  });
});
