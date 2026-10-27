import { describe, expect, it } from "vitest";
import { homebrewSkillInputSchema, skillEntrySchema } from "./skill.ts";

describe("homebrewSkillInputSchema", () => {
  it("takes a name, an ability and an edition, with rules text optional", () => {
    expect(
      homebrewSkillInputSchema.parse({ name: "Sailing", ability: "wis", edition: "one" }),
    ).toEqual({ name: "Sailing", ability: "wis", edition: "one" });
  });

  it("accepts the flat ability, which the catalog shape refuses", () => {
    expect(
      homebrewSkillInputSchema.parse({ name: "Cartography", ability: "flat", edition: "one" }),
    ).toMatchObject({ ability: "flat" });
    expect(
      skillEntrySchema.safeParse({ name: "Cartography", source: "HB", ability: "flat" }).success,
    ).toBe(false);
  });

  it("refuses a skill with no ability or an ability that does not exist", () => {
    expect(homebrewSkillInputSchema.safeParse({ name: "Sailing", edition: "one" }).success).toBe(
      false,
    );
    expect(
      homebrewSkillInputSchema.safeParse({ name: "Sailing", ability: "luck", edition: "one" })
        .success,
    ).toBe(false);
  });

  it("leaves the source to the server", () => {
    expect(
      homebrewSkillInputSchema.parse({
        name: "Sailing",
        ability: "wis",
        edition: "one",
        source: "PHB",
      }),
    ).not.toHaveProperty("source", "HB");
    expect(skillEntrySchema.safeParse({ name: "Sailing", ability: "wis" }).success).toBe(false);
  });
});
