import { describe, expect, it } from "vitest";
import { concentrationEnded, concentrationStarted } from "./index.ts";
import { state } from "./test/vex.ts";

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
