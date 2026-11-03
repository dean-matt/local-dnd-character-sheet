import { describe, expect, it } from "vitest";
import { copiedEntry, copyName } from "./homebrewCopy.ts";

describe("copyName", () => {
  it("marks the copy, numbering past every name taken, ignoring case", () => {
    expect(copyName("Fireball", ["Fireball"])).toBe("Fireball (copy)");
    expect(copyName("Fireball", ["fireball", "FIREBALL (COPY)", "Fireball (copy 2)"])).toBe(
      "Fireball (copy 3)",
    );
  });
});

describe("copiedEntry", () => {
  it("keeps every field but where the original was printed, under the new name", () => {
    const original = {
      name: "Fireball",
      source: "PHB",
      page: 241,
      srd: true,
      reprintedAs: ["Fireball|XPHB"],
      level: 3,
      entries: ["Boom."],
    };

    expect(copiedEntry(original, "Fireball (copy)")).toEqual({
      name: "Fireball (copy)",
      level: 3,
      entries: ["Boom."],
    });
    expect(original.name).toBe("Fireball");
  });
});
