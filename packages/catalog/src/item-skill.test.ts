import { describe, expect, it } from "vitest";
import { itemSkillGrantsSchema } from "./index.ts";

describe("itemSkillGrantsSchema", () => {
  it("reads proficiency as a race states it and expertise as a feat does, lowercased", () => {
    expect(
      itemSkillGrantsSchema.parse({
        skillProficiencies: [{ Intimidation: true, "sleight of hand": true }],
        expertise: [{ intimidation: true }],
      }),
    ).toEqual({ skills: ["intimidation", "sleight of hand"], expertise: ["intimidation"] });
  });

  it("grants nothing for a row naming no skill, a pick or alternatives", () => {
    expect(itemSkillGrantsSchema.parse({ name: "Rope" })).toBeUndefined();
    expect(
      itemSkillGrantsSchema.parse({
        skillProficiencies: [{ any: 1 }],
        expertise: [{ anyProficientSkill: 1 }],
      }),
    ).toBeUndefined();
    expect(
      itemSkillGrantsSchema.parse({ skillProficiencies: [{ stealth: true }, { arcana: true }] }),
    ).toBeUndefined();
    expect(itemSkillGrantsSchema.parse({ skillProficiencies: "stealth" })).toBeUndefined();
  });

  it("grants nothing from a potion, whose effect lasts as long as the drink", () => {
    expect(
      itemSkillGrantsSchema.parse({ type: "P", skillProficiencies: [{ stealth: true }] }),
    ).toBeUndefined();
  });
});
