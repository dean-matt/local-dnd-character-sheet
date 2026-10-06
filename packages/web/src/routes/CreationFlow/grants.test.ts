import { describe, expect, it } from "vitest";
import { NO_GRANTS, resolveGrants, swapGrants, titleCase } from "./grants.ts";

const ref = (name: string, source = "PHB") => ({ name, source });
const skill = (name: string, level: "proficient" | "expertise" = "proficient") => ({
  ref: ref(name),
  level,
});

describe("swapGrants", () => {
  const held = {
    savingThrows: ["int" as const],
    skills: [skill("Arcana", "expertise"), skill("Stealth")],
    languages: [ref("Common")],
    tools: [],
    weapons: ["Dagger"],
    armor: [],
  };

  it("takes back what the old choice granted and keeps what the player added", () => {
    const before = { ...NO_GRANTS, skills: [skill("Stealth")], weapons: ["Dagger"] };
    const after = { ...NO_GRANTS, skills: [skill("History")] };

    expect(swapGrants(held, before, after)).toEqual({
      ...held,
      skills: [skill("Arcana", "expertise"), skill("History")],
      weapons: [],
    });
  });

  it("swaps the saving throws a replaced class granted", () => {
    const before = { ...NO_GRANTS, savingThrows: ["int" as const, "wis" as const] };
    const after = { ...NO_GRANTS, savingThrows: ["str" as const, "con" as const] };

    expect(swapGrants(held, before, after).savingThrows).toEqual(["str", "con"]);
  });

  it("keeps a held proficiency's level when a grant names it again", () => {
    const after = { ...NO_GRANTS, skills: [skill("Arcana")], languages: [ref("Common")] };

    expect(swapGrants(held, NO_GRANTS, after)).toEqual(held);
  });
});

describe("resolveGrants", () => {
  it("reads every source once, preferring the core book's row, and drops a name no row answers", () => {
    const hits = [
      { type: "language", name: "Common", source: "ERLW", edition: "classic" as const },
      { type: "language", name: "Common", source: "PHB", edition: "classic" as const },
      { type: "skill", name: "Perception", source: "PHB", edition: "classic" as const },
    ];
    const none = { skills: [], languages: [], tools: [], weapons: [], armor: [] };
    const race = { ...none, skills: ["perception"], languages: ["common", "sylvan"] };
    const background = { ...none, skills: ["perception"], tools: ["thieves' tools"] };

    expect(resolveGrants([race, background], hits, "classic")).toEqual({
      ...NO_GRANTS,
      skills: [skill("Perception")],
      languages: [ref("Common")],
      tools: [{ name: "Thieves' Tools", level: "proficient" }],
    });
  });

  it("takes the saving throws a class grants, and its weapons and armor as a sheet prints them", () => {
    const none = { skills: [], languages: [], tools: [], weapons: [], armor: [] };
    const fighter = {
      ...none,
      savingThrows: ["str" as const, "con" as const],
      weapons: ["martial"],
    };
    const race = { ...none, armor: ["light"] };

    expect(resolveGrants([race, fighter], [], "classic")).toEqual({
      ...NO_GRANTS,
      savingThrows: ["str", "con"],
      weapons: ["Martial"],
      armor: ["Light"],
    });
  });
});

describe("titleCase", () => {
  it("capitalizes each word and a parenthesized one, never a letter after an apostrophe", () => {
    expect(titleCase("vehicles (land)")).toBe("Vehicles (Land)");
    expect(titleCase("cook's utensils")).toBe("Cook's Utensils");
  });
});
