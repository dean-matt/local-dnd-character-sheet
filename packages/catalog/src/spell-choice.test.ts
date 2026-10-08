import { describe, expect, it } from "vitest";
import { offeredPicks } from "./index.ts";

const row = (...additionalSpells: unknown[]) => ({ additionalSpells });

describe("offeredPicks", () => {
  it("counts the picks under each level key at or below the level", () => {
    const savant = row({
      known: {
        "3": [{ choose: "level=0;1;2|class=Wizard" }, { choose: "level=0;1;2|class=Wizard" }],
        "5": [{ choose: "level=0;1;2;3|class=Wizard" }],
      },
    });
    expect(offeredPicks(savant, 2)).toEqual({
      cantrips: 0,
      spells: 0,
      learned: 0,
      alternatives: false,
    });
    expect(offeredPicks(savant, 5)).toEqual({
      cantrips: 0,
      spells: 3,
      learned: 3,
      alternatives: false,
    });
  });

  it("reads a pick naming level 0 alone as a cantrip, and a count beside it", () => {
    const arcana = row({ known: { "1": { _: [{ choose: "level=0|class=Wizard", count: 2 }] } } });
    expect(offeredPicks(arcana, 1)).toMatchObject({ cantrips: 2, spells: 0, learned: 0 });
  });

  it("reaches a pick nested under a frequency and counts the object form's count", () => {
    const nested = row({
      innate: { _: { daily: { "1": [{ choose: "level=1|class=Wizard" }] } } },
      prepared: { _: [{ choose: { from: ["blade ward|xphb"], count: 2 } }] },
    });
    expect(offeredPicks(nested, 1)).toMatchObject({ cantrips: 0, spells: 3, learned: 0 });
  });

  it("reads a list whose every name is marked a cantrip as a cantrip, as Scion of the Three's", () => {
    const scion = row({
      innate: {
        "3": [{ choose: { from: ["minor illusion|xphb#c", "blade ward|xphb#c"], count: 1 } }],
      },
    });
    expect(offeredPicks(scion, 3)).toMatchObject({ cantrips: 1, spells: 0 });
    const mixed = row({ known: { _: [{ choose: { from: ["light#c", "shield"] } }] } });
    expect(offeredPicks(mixed, 1)).toMatchObject({ cantrips: 0, spells: 1 });
  });

  it("offers none from an expanded list", () => {
    const expanded = row({ expanded: { s1: [{ choose: "level=1|class=Wizard" }] } });
    expect(offeredPicks(expanded, 20)).toMatchObject({ cantrips: 0, spells: 0 });
  });

  it("takes the largest of alternative blocks as a ceiling", () => {
    const initiate = row(
      { known: { _: [{ choose: "level=0|class=Cleric", count: 2 }] } },
      {
        known: { _: [{ choose: "level=0|class=Druid", count: 2 }] },
        innate: { _: [{ choose: "level=1|class=Druid" }] },
      },
    );
    expect(offeredPicks(initiate, 1)).toEqual({
      cantrips: 2,
      spells: 1,
      learned: 0,
      alternatives: true,
    });
  });
});
