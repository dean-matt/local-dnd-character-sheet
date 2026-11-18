import { describe, expect, it } from "vitest";
import { featureOfferings } from "./featureOfferings.ts";

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
