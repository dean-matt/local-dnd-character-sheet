import { describe, expect, it } from "vitest";
import { featHitPointTerms, featInitiativeTerms, speedWithFeats } from "./featEffects.ts";

const feats = (...names: [string, string][]) => ({
  feats: names.map(([name, source]) => ({ ref: { name, source } })),
});

describe("featEffects", () => {
  it("adds the classic and 2024 Alert initiative bonuses", () => {
    expect(featInitiativeTerms(feats(["Alert", "PHB"]), 3).map((t) => t.value)).toEqual([5]);
    expect(featInitiativeTerms(feats(["Alert", "XPHB"]), 3).map((t) => t.value)).toEqual([3]);
  });

  it("adds 2 hit points per level for Tough in either edition", () => {
    for (const source of ["PHB", "XPHB"])
      expect(featHitPointTerms(feats(["Tough", source]), 4).map((t) => t.value)).toEqual([8]);
  });

  it("raises the walk speed for Mobile and Speedy", () => {
    for (const [name, source] of [
      ["Mobile", "PHB"],
      ["Speedy", "XPHB"],
    ] as [string, string][])
      expect(speedWithFeats({ walk: 30 }, feats([name, source])).speed.walk).toBe(40);
  });

  it("ignores a feat the records do not name", () => {
    const none = feats(["Actor", "PHB"]);
    expect(featInitiativeTerms(none, 3)).toEqual([]);
    expect(featHitPointTerms(none, 4)).toEqual([]);
    expect(speedWithFeats({ walk: 30 }, none).speed.walk).toBe(30);
  });
});
