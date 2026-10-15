import { describe, expect, it } from "vitest";
import { optionalFeaturePrerequisitesSchema } from "./index.ts";

const NONE = { spells: [], options: [], unjudged: [] };

describe("optionalFeaturePrerequisitesSchema", () => {
  it("reads a class level and a pact boon as one alternative", () => {
    expect(
      optionalFeaturePrerequisitesSchema.parse([
        { level: { level: 12, class: { name: "Warlock" } }, pact: "Talisman" },
      ]),
    ).toEqual([{ ...NONE, level: 12, className: "Warlock", pact: "Talisman" }]);
  });

  it("reads a spell by the name before its mark, and an option by its key", () => {
    expect(
      optionalFeaturePrerequisitesSchema.parse([
        { spell: ["eldritch blast#c"], optionalfeature: ["Pact of the Blade|XPHB"] },
      ]),
    ).toEqual([{ ...NONE, spells: ["eldritch blast"], options: ["pact of the blade|xphb"] }]);
  });

  it("prints a spell met another way rather than requiring it", () => {
    expect(optionalFeaturePrerequisitesSchema.parse([{ spell: ["hex/curse#x"] }])).toEqual([
      { ...NONE, unjudged: ["hex or curse"] },
    ]);
  });

  it("keeps what a sheet cannot check as upstream summarizes it", () => {
    expect(
      optionalFeaturePrerequisitesSchema.parse([
        {
          spell: [{ choose: "level=0|class=Warlock", entrySummary: "Warlock Cantrip" }],
          item: ["A shield (requires attunement)"],
          otherSummary: { entry: "Renown 3+", entrySummary: "Renown 3+" },
        },
      ]),
    ).toEqual([
      { ...NONE, unjudged: ["Warlock Cantrip", "A shield (requires attunement)", "Renown 3+"] },
    ]);
  });

  it("reads an absent or unreadable prerequisite as none", () => {
    expect(optionalFeaturePrerequisitesSchema.parse(undefined)).toEqual([]);
    expect(optionalFeaturePrerequisitesSchema.parse("Warlock")).toEqual([]);
  });
});
