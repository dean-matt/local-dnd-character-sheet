import { describe, expect, it } from "vitest";
import { mergeHomebrewSubrace } from "./homebrew-subrace-merge.ts";

const RACE = {
  name: "Elf",
  source: "PHB",
  size: ["M"],
  speed: 30,
  darkvision: 60,
  ability: [{ dex: 2 }],
  languageProficiencies: [{ common: true, elvish: true }],
  skillProficiencies: [{ perception: true }],
  entries: [
    { type: "entries", name: "Darkvision", entries: ["A"] },
    { type: "entries", name: "Trance", entries: ["B"] },
  ],
};

const sub = (fields: Record<string, unknown>) => ({ name: "Sea", source: "HB", ...fields });

describe("mergeHomebrewSubrace", () => {
  it("keeps the race's name and appends the subrace's traits", () => {
    const merged = mergeHomebrewSubrace(
      RACE,
      sub({ entries: [{ type: "entries", name: "Swim", entries: ["C"] }] }),
    );

    expect(merged.name).toBe("Elf");
    expect(merged.source).toBe("PHB");
    expect((merged.entries as { name: string }[]).map((trait) => trait.name)).toEqual([
      "Darkvision",
      "Trance",
      "Swim",
    ]);
  });

  it("puts a trait in place of the one its data.overwrite names", () => {
    const merged = mergeHomebrewSubrace(
      RACE,
      sub({
        entries: [
          { type: "entries", name: "Superior Darkvision", data: { overwrite: "darkvision" } },
        ],
      }),
    );

    expect((merged.entries as { name: string }[]).map((trait) => trait.name)).toEqual([
      "Superior Darkvision",
      "Trance",
    ]);
  });

  it("adds increases slot by slot, and replaces them where the slot counts differ", () => {
    expect(mergeHomebrewSubrace(RACE, sub({ ability: [{ int: 1 }] })).ability).toEqual([
      { dex: 2, int: 1 },
    ]);
    const choices = [{ wis: 1 }, { choose: { from: ["str", "con"], count: 1 } }];
    expect(mergeHomebrewSubrace(RACE, sub({ ability: choices })).ability).toEqual(choices);
  });

  it("joins languages and skills, and replaces them where either side offers a choice of sets", () => {
    const merged = mergeHomebrewSubrace(
      RACE,
      sub({ languageProficiencies: [{ aquan: true }], skillProficiencies: [{ athletics: true }] }),
    );
    expect(merged.languageProficiencies).toEqual([{ common: true, elvish: true, aquan: true }]);
    expect(merged.skillProficiencies).toEqual([{ perception: true, athletics: true }]);

    const choice = [{ aquan: true }, { primordial: true }];
    expect(mergeHomebrewSubrace(RACE, sub({ languageProficiencies: choice }))).toMatchObject({
      languageProficiencies: choice,
    });
  });

  it("replaces every other field it states, and drops one it sets to null", () => {
    const merged = mergeHomebrewSubrace(RACE, sub({ speed: 35, size: ["S"], darkvision: null }));

    expect(merged).toMatchObject({ speed: 35, size: ["S"] });
    expect(merged).not.toHaveProperty("darkvision");
    expect(RACE.speed).toBe(30);
  });
});
