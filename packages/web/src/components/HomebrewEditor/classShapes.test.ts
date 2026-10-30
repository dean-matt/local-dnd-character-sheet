import { describe, expect, it } from "vitest";
import {
  readEquipment,
  readNames,
  readPrimaryAbility,
  readRequirements,
  requirementProblem,
  withMulticlassing,
  writeEquipment,
  writeNames,
  writePrimaryAbility,
  writeRequirements,
} from "./classShapes.ts";

describe("primary ability", () => {
  it("reads an alternative apiece as any one and one alternative of several as all", () => {
    expect(readPrimaryAbility([{ str: true }, { dex: true }])).toEqual({
      abilities: ["str", "dex"],
      all: false,
    });
    expect(readPrimaryAbility([{ dex: true, wis: true }])).toEqual({
      abilities: ["dex", "wis"],
      all: true,
    });
    expect(readPrimaryAbility(undefined)).toEqual({ abilities: [], all: false });
  });

  it("leaves a score in place of true, and a mixed shape, to the JSON", () => {
    expect(readPrimaryAbility([{ str: 13 }])).toBeUndefined();
    expect(readPrimaryAbility([{ str: true, dex: true }, { wis: true }])).toBeUndefined();
  });

  it("writes either reading back, in ability order, and nothing for none", () => {
    expect(writePrimaryAbility({ abilities: ["dex", "str"], all: false })).toEqual([
      { str: true },
      { dex: true },
    ]);
    expect(writePrimaryAbility({ abilities: ["dex", "str"], all: true })).toEqual([
      { str: true, dex: true },
    ]);
    expect(writePrimaryAbility({ abilities: [], all: true })).toBeUndefined();
  });
});

describe("proficiency names", () => {
  it("writes the structured list beside the prose one for plain names only", () => {
    expect(writeNames({ skills: "kept" }, "armor", ["light", "{@item shield|phb}"])).toEqual({
      skills: "kept",
      armor: ["light", "{@item shield|phb}"],
      armorProficiencies: [{ light: true }],
    });
    expect(writeNames({ weapons: ["simple"] }, "weapons", ["simple", "martial"])).toEqual({
      weapons: ["simple", "martial"],
    });
  });

  it("drops both lists once emptied", () => {
    expect(
      writeNames({ armor: ["light"], armorProficiencies: [{ light: true }] }, "armor", []),
    ).toEqual({});
  });

  it("reads the structured list where no prose one is stated, and refuses a non-string", () => {
    expect(readNames({ toolProficiencies: [{ "thieves' tools": true }] }, "tools")).toEqual([
      "thieves' tools",
    ]);
    expect(readNames({ armor: ["Light"] }, "armor")).toEqual(["light"]);
    expect(readNames({ armor: [{ proficiency: "medium" }] }, "armor")).toBeUndefined();
  });
});

describe("multiclassing", () => {
  it("reads minimums and leaves alternatives to the JSON", () => {
    expect(readRequirements({ requirements: { str: 13, dex: 13 } })).toEqual({ str: 13, dex: 13 });
    expect(readRequirements(undefined)).toEqual({});
    expect(readRequirements({ requirements: { or: [{ str: 13 }] } })).toBeUndefined();
  });

  it("writes minimums in ability order and skips an empty one", () => {
    expect(writeRequirements({ wis: 13, str: 15, dex: null })).toEqual({ str: 15, wis: 13 });
    expect(writeRequirements({ str: null })).toBeUndefined();
  });

  it("names the ability whose minimum is out of range", () => {
    expect(requirementProblem({ requirements: { dex: 0 } })).toBe(
      "DEX minimum: a whole number from 1 to 30",
    );
    expect(requirementProblem({ requirements: { dex: 13 } })).toBeUndefined();
  });

  it("drops the field once nothing is left in it, and keeps other keys", () => {
    expect(
      withMulticlassing(
        { name: "A", multiclassing: { requirements: { str: 13 } } },
        "requirements",
        undefined,
      ),
    ).toEqual({ name: "A" });
    expect(
      withMulticlassing({ multiclassing: { proficienciesGained: {} } }, "requirements", {
        str: 13,
      }),
    ).toEqual({ multiclassing: { proficienciesGained: {}, requirements: { str: 13 } } });
  });
});

describe("starting equipment", () => {
  it("reads the choices, gold and flag, and refuses a choice that is not text", () => {
    expect(
      readEquipment({ default: ["a"], goldAlternative: "5", additionalFromBackground: true }),
    ).toEqual({ lines: ["a"], gold: "5", withBackground: true });
    expect(readEquipment({ default: [{ item: "x" }] })).toBeUndefined();
  });

  it("keeps what it has no control for and leaves once emptied", () => {
    expect(
      writeEquipment(
        { defaultData: [1], default: ["a"] },
        { lines: [], gold: "", withBackground: false },
      ),
    ).toEqual({ defaultData: [1] });
    expect(
      writeEquipment({ default: ["a"] }, { lines: [], gold: "", withBackground: false }),
    ).toBeUndefined();
  });
});
