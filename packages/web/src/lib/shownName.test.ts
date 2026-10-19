import { describe, expect, it } from "vitest";
import { shownName } from "./shownName.ts";

describe("shownName", () => {
  it.each([
    ["Arrow of Slaying (*)", "Arrow of Slaying"],
    ["+1 Shield (*)", "+1 Shield"],
    ["Potion of Healing (*)", "Potion of Healing"],
  ])("leaves the star off %s", (name, shown) => {
    expect(shownName(name)).toBe(shown);
  });

  it.each(["Longsword", "Potion of Healing", "Star (*) Map", "Thing(*)"])(
    "keeps %s as given",
    (name) => {
      expect(shownName(name)).toBe(name);
    },
  );
});
