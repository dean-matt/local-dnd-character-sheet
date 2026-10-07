import { describe, expect, it } from "vitest";
import { backgroundToolChoicesSchema, classToolChoicesSchema } from "./index.ts";

const classWith = (toolProficiencies: unknown) => ({
  startingProficiencies: { toolProficiencies },
});

describe("classToolChoicesSchema", () => {
  it("reads a pick of any tool of a kind, leaving the tools granted outright", () => {
    const artificer = classWith([
      { "thieves' tools": true, "tinker's tools": true, anyArtisansTool: 1 },
    ]);
    expect(classToolChoicesSchema.parse(artificer)).toEqual([
      { names: [], types: ["artisan"], count: 1 },
    ]);
    expect(classToolChoicesSchema.parse(classWith([{ anyMusicalInstrument: 3 }]))).toEqual([
      { names: [], types: ["instrument"], count: 3 },
    ]);
  });

  it("merges a list of alternatives into one pick from any of them", () => {
    const monk = classWith([{ anyArtisansTool: 1 }, { anyMusicalInstrument: 1 }]);
    expect(classToolChoicesSchema.parse(monk)).toEqual([
      { names: [], types: ["artisan", "instrument"], count: 1 },
    ]);
  });

  it("offers nothing where the class grants its tools outright, states none, or is malformed", () => {
    expect(classToolChoicesSchema.parse(classWith([{ "thieves' tools": true }]))).toEqual([]);
    expect(classToolChoicesSchema.parse({ name: "Wizard" })).toEqual([]);
    expect(classToolChoicesSchema.parse(classWith("thieves' tools"))).toEqual([]);
  });
});

describe("backgroundToolChoicesSchema", () => {
  it("offers each pick an alternative holds", () => {
    const vizier = { toolProficiencies: [{ anyArtisansTool: 1, anyMusicalInstrument: 1 }] };
    expect(backgroundToolChoicesSchema.parse(vizier)).toEqual([
      { names: [], types: ["artisan"], count: 1 },
      { names: [], types: ["instrument"], count: 1 },
    ]);
  });

  it("reads a choose list's named tools and the kinds it names in their place", () => {
    const row = {
      toolProficiencies: [
        { choose: { from: ["gaming set", "Musical Instrument", "thieves' tools"], count: 2 } },
      ],
    };
    expect(backgroundToolChoicesSchema.parse(row)).toEqual([
      { names: ["thieves' tools"], types: ["gaming", "instrument"], count: 2 },
    ]);
    const guild = {
      toolProficiencies: [{ choose: { from: ["anyArtisansTool", "navigator's tools"] } }],
    };
    expect(backgroundToolChoicesSchema.parse(guild)).toEqual([
      { names: ["navigator's tools"], types: ["artisan"], count: 1 },
    ]);
  });

  it("takes as many tools from merged alternatives as the largest holds", () => {
    const agent = {
      toolProficiencies: [
        { "alchemist's supplies": true, "tinker's tools": true },
        { "navigator's tools": true, "vehicles (air)": true, "vehicles (water)": true },
        { "disguise kit": true, anyMusicalInstrument: 1 },
      ],
    };
    expect(backgroundToolChoicesSchema.parse(agent)).toEqual([
      {
        names: [
          "alchemist's supplies",
          "tinker's tools",
          "navigator's tools",
          "vehicles (air)",
          "vehicles (water)",
          "disguise kit",
        ],
        types: ["instrument"],
        count: 3,
      },
    ]);
  });
});
