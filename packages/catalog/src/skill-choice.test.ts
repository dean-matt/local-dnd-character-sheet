import { describe, expect, it } from "vitest";
import { classSkillChoiceSchema, skillProficienciesChoiceSchema } from "./index.ts";

describe("classSkillChoiceSchema", () => {
  it("reads the skills a class offers and how many", () => {
    const wizard = {
      startingProficiencies: {
        skills: [{ choose: { from: ["arcana", "Sleight of Hand"], count: 2 } }],
      },
    };
    expect(classSkillChoiceSchema.parse(wizard)).toEqual({
      from: ["arcana", "sleight of hand"],
      count: 2,
    });
  });

  it("reads any skill where the class names none", () => {
    const bard = { startingProficiencies: { skills: [{ any: 3 }] } };
    expect(classSkillChoiceSchema.parse(bard)).toEqual({ from: null, count: 3 });
  });

  it("offers nothing from a row that states no skills, or a malformed list", () => {
    expect(classSkillChoiceSchema.parse({ name: "Mystery" })).toBeUndefined();
    expect(
      classSkillChoiceSchema.parse({ startingProficiencies: { skills: "arcana" } }),
    ).toBeUndefined();
  });
});

describe("skillProficienciesChoiceSchema", () => {
  it("reads a pick of one where the background states no count", () => {
    const row = { skillProficiencies: [{ choose: { from: ["arcana", "history"] } }] };
    expect(skillProficienciesChoiceSchema.parse(row)).toEqual({
      from: ["arcana", "history"],
      count: 1,
    });
  });

  it("reads the pick a race offers", () => {
    const halfElf = { name: "Half-Elf", source: "PHB", skillProficiencies: [{ any: 2 }] };
    expect(skillProficienciesChoiceSchema.parse(halfElf)).toEqual({ from: null, count: 2 });
    const elf = {
      name: "Elf",
      source: "XPHB",
      skillProficiencies: [{ choose: { from: ["insight", "perception", "survival"] } }],
    };
    expect(skillProficienciesChoiceSchema.parse(elf)).toEqual({
      from: ["insight", "perception", "survival"],
      count: 1,
    });
  });

  it("offers nothing where the background grants its skills outright", () => {
    const sage = { skillProficiencies: [{ arcana: true, history: true }] };
    expect(skillProficienciesChoiceSchema.parse(sage)).toBeUndefined();
  });

  it("offers nothing from a list of alternatives", () => {
    const row = { skillProficiencies: [{ any: 1 }, { any: 2 }] };
    expect(skillProficienciesChoiceSchema.parse(row)).toBeUndefined();
  });
});
