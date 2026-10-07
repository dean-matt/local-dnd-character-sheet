import { describe, expect, it } from "vitest";
import { backgroundSkillChoiceSchema, classSkillChoiceSchema } from "./index.ts";

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

describe("backgroundSkillChoiceSchema", () => {
  it("reads a pick of one where the background states no count", () => {
    const row = { skillProficiencies: [{ choose: { from: ["arcana", "history"] } }] };
    expect(backgroundSkillChoiceSchema.parse(row)).toEqual({
      from: ["arcana", "history"],
      count: 1,
    });
  });

  it("offers nothing where the background grants its skills outright", () => {
    const sage = { skillProficiencies: [{ arcana: true, history: true }] };
    expect(backgroundSkillChoiceSchema.parse(sage)).toBeUndefined();
  });

  it("offers nothing from a list of alternatives", () => {
    const row = { skillProficiencies: [{ any: 1 }, { any: 2 }] };
    expect(backgroundSkillChoiceSchema.parse(row)).toBeUndefined();
  });
});
