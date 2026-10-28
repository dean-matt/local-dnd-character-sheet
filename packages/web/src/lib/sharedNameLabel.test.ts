import { describe, expect, it } from "vitest";
import { sharedNameLabel } from "./sharedNameLabel.ts";

describe("sharedNameLabel", () => {
  it("names a shared name's source, or homebrew, and a unique name alone", () => {
    const fighter = { name: "Fighter", source: "PHB" };
    const homebrewFighter = { id: "hc-1", name: "Fighter" };
    const warden = { id: "hc-2", name: "Warden" };
    const label = sharedNameLabel([fighter, homebrewFighter, warden]);

    expect(label(fighter)).toBe("Fighter (PHB)");
    expect(label(homebrewFighter)).toBe("Fighter (homebrew)");
    expect(label(warden)).toBe("Warden");
  });
});
