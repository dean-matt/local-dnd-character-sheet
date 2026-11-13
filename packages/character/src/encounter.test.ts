import { describe, expect, it } from "vitest";
import {
  characterStateSchema,
  describeStateChange,
  encounterEnded,
  encounterStarted,
  initiativeRolled,
  roundAdvanced,
} from "./index.ts";
import { state } from "./test/vex.ts";

const idle = { ...state, encounter: null };

describe("encounter", () => {
  it("starts at round 1 with no initiative", () => {
    expect(encounterStarted(idle).encounter).toEqual({ round: 1, initiative: null });
  });

  it("starts an encounter by rolling initiative, and a reroll keeps the round", () => {
    const rolled = initiativeRolled(idle, 14);
    expect(rolled.encounter).toEqual({ round: 1, initiative: 14 });
    const later = roundAdvanced(roundAdvanced(rolled));
    expect(initiativeRolled(later, 9).encounter).toEqual({ round: 3, initiative: 9 });
  });

  it("advances a round and stops at the bound", () => {
    expect(roundAdvanced(encounterStarted(idle)).encounter?.round).toBe(2);
    const last = { ...idle, encounter: { round: 999, initiative: null } };
    expect(roundAdvanced(last)).toBe(last);
    expect(roundAdvanced(idle)).toBe(idle);
  });

  it("ends with nothing left, concentration's round included", () => {
    const held = {
      ...state,
      concentration: { spell: { name: "Hex", source: "PHB" }, level: 2, round: 2 },
      encounter: { round: 4, initiative: 11 },
    };
    expect(encounterEnded(held)).toEqual({
      ...state,
      concentration: { spell: { name: "Hex", source: "PHB" }, level: 2 },
      encounter: null,
    });
  });

  it("refuses a round past the bound", () => {
    expect(
      characterStateSchema.safeParse({ ...state, encounter: { round: 1000, initiative: null } })
        .success,
    ).toBe(false);
  });

  it("describes a round, an initiative and an ending as changes", () => {
    expect(describeStateChange(idle, initiativeRolled(idle, 14))).toContain("Initiative");
    expect(
      describeStateChange(encounterStarted(idle), roundAdvanced(encounterStarted(idle))),
    ).toContain("round 2");
    expect(describeStateChange(encounterStarted(idle), idle)).toContain("Encounter");
  });

  it("does not describe forgetting concentration's round as a concentration change", () => {
    const held = {
      ...idle,
      concentration: { spell: { name: "Hex", source: "PHB" }, level: 2, round: 2 },
      encounter: { round: 4, initiative: null },
    };
    expect(describeStateChange(held, encounterEnded(held))).not.toContain("Concentration");
  });
});
