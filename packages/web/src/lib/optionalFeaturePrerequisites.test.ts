import { describe, expect, it } from "vitest";
import { warlockRecord } from "../test/records.ts";
import { prerequisiteFacts, prerequisiteNotes } from "./optionalFeaturePrerequisites.ts";

const NONE = { spells: [], options: [], unjudged: [] };
const WARLOCK = { name: "Warlock", source: "XPHB" } as const;

const facts = prerequisiteFacts({
  ...warlockRecord().definition,
  spells: [{ ref: { name: "Eldritch Blast", source: "XPHB" }, prepared: false }],
  optionalFeatures: [
    {
      ref: { name: "Pact of the Blade", source: "XPHB" },
      featureType: "EI",
      grantedBy: { kind: "class", ref: WARLOCK },
    },
  ],
});

describe("prerequisiteNotes", () => {
  it("is silent on an option with no prerequisite, or one whose every part holds", () => {
    expect(prerequisiteNotes([], facts)).toEqual({ unmet: undefined, unchecked: undefined });
    expect(
      prerequisiteNotes(
        [
          {
            ...NONE,
            level: 2,
            className: "Warlock",
            spells: ["eldritch blast"],
            options: ["pact of the blade|xphb"],
          },
        ],
        facts,
      ).unmet,
    ).toBeUndefined();
  });

  it("names each part the character falls short of", () => {
    expect(
      prerequisiteNotes(
        [{ ...NONE, level: 5, className: "Warlock", pact: "Tome", spells: ["hex"] }],
        facts,
      ).unmet,
    ).toBe("Needs Warlock level 5, Pact of the Tome, Hex");
    expect(prerequisiteNotes([{ ...NONE, level: 4 }], facts).unmet).toBe("Needs Level 4");
    expect(prerequisiteNotes([{ ...NONE, options: ["pact of the chain|xphb"] }], facts).unmet).toBe(
      "Needs Pact of the Chain",
    );
  });

  it("reads a pact boon held under any source, by the name it carries", () => {
    expect(prerequisiteNotes([{ ...NONE, pact: "Blade" }], facts).unmet).toBeUndefined();
  });

  it("is met by any one alternative", () => {
    expect(
      prerequisiteNotes(
        [
          { ...NONE, level: 9 },
          { ...NONE, level: 3 },
        ],
        facts,
      ).unmet,
    ).toBeUndefined();
  });

  it("prints what the sheet cannot check and never refuses for it", () => {
    expect(
      prerequisiteNotes([{ ...NONE, unjudged: ["A shield (requires attunement)"] }], facts),
    ).toEqual({ unmet: undefined, unchecked: "Not checked: A shield (requires attunement)" });
  });
});
