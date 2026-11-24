import { describe, expect, it } from "vitest";
import { featureOfferings, featurePickings } from "./featureOfferings.ts";

const feature = (name: string, offeredBy?: string, choose?: number) =>
  ({
    name,
    source: "TCE",
    level: 3,
    json: {},
    ...(choose && { choose }),
    ...(offeredBy && { offeredBy: { name: offeredBy, source: "TCE" } }),
  }) as never;

describe("featureOfferings", () => {
  it("offers each armor model, and none of the features a model lists", () => {
    const owner = {
      className: "Artificer",
      classSource: "TCE",
      subclass: { shortName: "Armorer", source: "TCE" },
    };
    const features = [
      feature("Armor Model", undefined, 1),
      feature("Guardian", "Armor Model"),
      feature("Infiltrator", "Armor Model"),
      feature("Thunder Gauntlets", "Guardian"),
      feature("Powered Steps", "Infiltrator"),
    ];

    expect(featureOfferings(features, owner)).toEqual([
      {
        feature: { ...owner, name: "Armor Model", source: "TCE", level: 3 },
        options: [
          { name: "Guardian", source: "TCE" },
          { name: "Infiltrator", source: "TCE" },
        ],
      },
    ]);
  });
});

describe("featurePickings", () => {
  const owner = { className: "Bard", classSource: "PHB" };
  const expertise = { name: "Expertise", source: "PHB", level: 3 } as never;

  it("offers the picks a homebrew effect rules in place of the recorded ones", () => {
    const effects = new Map([
      ["Expertise|PHB", [{ kind: "pick" as const, fields: ["expertise" as const], count: 4 }]],
    ]);
    expect(featurePickings([expertise], owner)[0]?.offers).toEqual([
      { fields: ["expertise"], count: 2, from: null },
    ]);
    expect(featurePickings([expertise], owner, effects)[0]?.offers).toEqual([
      { fields: ["expertise"], count: 4, from: null },
    ]);
  });
});
