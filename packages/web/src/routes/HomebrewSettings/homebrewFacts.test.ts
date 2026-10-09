import { describe, expect, it } from "vitest";
import { itemFacts, spellFacts } from "./homebrewFacts.ts";

describe("homebrew facts", () => {
  it("states an item's attunement condition and leaves out what it lacks", () => {
    expect(
      itemFacts({ name: "Ring", edition: "one", type: "RG", reqAttune: "by a wizard" }),
    ).toEqual([
      ["Type", "Ring"],
      ["Attunement", "Required by a wizard"],
    ]);
    expect(itemFacts({ name: "Rope", edition: "one", reqAttune: "optional", weight: 10 })).toEqual([
      ["Type", "Other"],
      ["Attunement", "Optional"],
      ["Weight", "10 lb."],
    ]);
  });

  it("adds a magic bonus to armor class, and counts a value in its largest whole coin", () => {
    expect(
      itemFacts({ name: "Plate", edition: "one", type: "HA", ac: 18, bonusAc: "+2", value: 1550 }),
    ).toEqual([
      ["Type", "Heavy armor"],
      ["Armor class", "20"],
      ["Value", "155 sp"],
    ]);
  });

  it("adds a shield to armor class, and takes a negative bonus off each damage roll", () => {
    expect(itemFacts({ name: "Buckler", edition: "one", type: "S", ac: 1, bonusAc: "+1" })).toEqual(
      [
        ["Type", "Shield"],
        ["Armor class", "+2"],
      ],
    );
    expect(
      itemFacts({ name: "Cracked Shield", edition: "one", type: "S", ac: 0, bonusAc: "-1" }),
    ).toContainEqual(["Armor class", "-1"]);
    expect(
      itemFacts({
        name: "Blunted Sword",
        edition: "one",
        type: "M",
        dmg1: "1d8",
        dmg2: "1d10",
        dmgType: "S",
        bonusWeapon: "-1",
      }),
    ).toEqual([
      ["Type", "Melee weapon"],
      ["Attack bonus", "-1"],
      ["Damage", "1d8 - 1 slashing (1d10 - 1 versatile)"],
    ]);
  });

  it("names a ritual cantrip, and drops a malformed fact while keeping the rest", () => {
    expect(
      spellFacts({
        name: "Glow",
        edition: "one",
        level: 0,
        school: "V",
        time: [{ number: 1, unit: "action" }],
        range: { distance: "far" },
        duration: [{ type: "instant" }],
        meta: { ritual: true },
      }),
    ).toEqual([
      ["Level", "Cantrip"],
      ["School", "Evocation"],
      ["Casting time", "1 action or Ritual"],
      ["Duration", "Instantaneous"],
    ]);
    expect(
      spellFacts({
        name: "Alarm",
        edition: "classic",
        level: 1,
        school: "A",
        time: [{ number: 1, unit: "minute" }],
        duration: [{ type: "instant" }],
        meta: { ritual: true },
      }).slice(0, 3),
    ).toEqual([
      ["Level", "1st"],
      ["School", "Abjuration"],
      ["Casting time", "1 minute (ritual)"],
    ]);
  });
});
