import { describe, expect, it } from "vitest";
import { catalogClass, homebrewClassByName, homebrewClassId } from "./catalogClass.ts";

const ROWS = [
  { id: "hb_warden_2014", name: "Warden", edition: "classic" as const },
  { id: "hb_warden_2024", name: "Warden", edition: "one" as const },
  { id: "hb_marshal", name: "Marshal", edition: "classic" as const },
];

describe("catalogClass", () => {
  it.each([
    ["a catalog class", { name: "Fighter", source: "XPHB" }, true],
    ["a homebrew class by name, any case of HB", { name: "Warden", source: "hb" }, false],
    ["a homebrew class by id", { homebrewId: "hb_warden" }, false],
  ])("reads %s", (_, cls, catalog) => {
    expect(catalogClass(cls) !== undefined).toBe(catalog);
    expect(homebrewClassByName(cls) !== undefined).toBe(!catalog && "name" in cls);
  });
});

describe("homebrewClassId", () => {
  it("keeps a cited id", () => {
    expect(homebrewClassId({ homebrewId: "hb_gone" }, ROWS, "one")).toBe("hb_gone");
  });

  it.each([
    ["one", "hb_warden_2024"],
    ["classic", "hb_warden_2014"],
  ] as const)("prefers the %s row of a name two editions share", (edition, id) => {
    expect(homebrewClassId({ name: "Warden", source: "HB" }, ROWS, edition)).toBe(id);
  });

  it("falls back to the other edition's row, matching the name and HB in any case", () => {
    expect(homebrewClassId({ name: "marshal", source: "hb" }, ROWS, "one")).toBe("hb_marshal");
  });

  it.each([
    ["a name no row holds", { name: "Nobody", source: "HB" }],
    ["a catalog class", { name: "Warden", source: "XPHB" }],
  ])("finds nothing for %s", (_, cls) => {
    expect(homebrewClassId(cls, ROWS, "one")).toBeUndefined();
  });
});
