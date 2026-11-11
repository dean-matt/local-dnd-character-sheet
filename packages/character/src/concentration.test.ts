import { describe, expect, it } from "vitest";
import { concentrationCheck, concentrationEnded, concentrationStarted } from "./index.ts";
import { definition, state } from "./test/vex.ts";

const bless = { spell: { name: "Bless", source: "PHB" }, level: 1 };

describe("concentrationStarted", () => {
  it("holds the new spell alone and names the one it ended", () => {
    const { state: started, ended } = concentrationStarted(state, bless);
    expect(started).toEqual({ ...state, concentration: bless });
    expect(ended).toEqual(state.concentration);
  });

  it("names nothing ended where none was held", () => {
    const idle = { ...state, concentration: null };
    expect(concentrationStarted(idle, bless)).toEqual({
      state: { ...state, concentration: bless },
      ended: null,
    });
  });
});

describe("concentrationEnded", () => {
  it("holds none and changes nothing else", () => {
    expect(concentrationEnded(state)).toEqual({ ...state, concentration: null });
  });
});

describe("concentrationCheck", () => {
  const save = (computed: number, manual: number | null = null) => ({
    computed,
    manual,
    terms: [],
  });
  const savingThrows = {
    str: save(0),
    dex: save(0),
    con: save(3),
    int: save(0),
    wis: save(0),
    cha: save(0),
  };

  it("weighs the Constitution save while no item adds to concentration", () => {
    expect(concentrationCheck(definition, { savingThrows, concentrationSave: null }, 25)).toEqual({
      dc: 12,
      save: 3,
    });
  });

  it("weighs the concentration save an item adds to, with its override", () => {
    const derived = { savingThrows, concentrationSave: save(5, 7) };
    expect(concentrationCheck(definition, derived, 4)).toEqual({ dc: 10, save: 7 });
  });

  it("caps the DC at 30 under the 2024 rules alone", () => {
    const derived = { savingThrows, concentrationSave: null };
    expect(concentrationCheck({ edition: "one" }, derived, 80).dc).toBe(30);
    expect(concentrationCheck({ edition: "classic" }, derived, 80).dc).toBe(40);
  });
});
