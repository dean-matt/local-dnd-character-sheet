import { describe, expect, it } from "vitest";
import { blurbOf } from "./catalogBlurb.ts";

describe("blurbOf", () => {
  it("takes the first sentence of the first text, its markup flattened", () => {
    expect(
      blurbOf(["A {@item Versatile|XPHB} weapon can be used with one or two hands. More follows."]),
    ).toBe("A Versatile weapon can be used with one or two hands.");
  });

  it("passes a lead-in to the first list item, as a 2024 condition reads", () => {
    expect(
      blurbOf([
        "While you have the Blinded condition, you experience the following effects.",
        { type: "list", items: [{ type: "item", name: "Can't See.", entry: "You can't see." }] },
      ]),
    ).toBe("You can't see.");
  });

  it("reads into a section, and has none for a row with no text", () => {
    expect(blurbOf([{ type: "entries", entries: ["Heavy weapons are big"] }])).toBe(
      "Heavy weapons are big",
    );
    expect(blurbOf([])).toBeUndefined();
  });
});
