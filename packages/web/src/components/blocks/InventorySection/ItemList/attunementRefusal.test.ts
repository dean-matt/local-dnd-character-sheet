import { describe, expect, it } from "vitest";
import { attunementRefusal } from "./attunementRefusal.ts";

describe("attunementRefusal", () => {
  it("allows an attunement while a slot is free", () => {
    expect(attunementRefusal(3, ["Cloak of Protection", "Ring of Warmth"])).toBeUndefined();
  });

  it("names every item holding a slot once all are taken", () => {
    expect(attunementRefusal(3, ["Cloak", "Ring", "Wand"])).toBe(
      "All 3 attunement slots are taken by Cloak, Ring and Wand. End attunement to one of them first.",
    );
  });

  it("says when more items are attuned than an override leaves slots for", () => {
    expect(attunementRefusal(1, ["Cloak", "Ring"])).toBe(
      "Cloak and Ring are attuned, more than the one slot this character has. End attunement to 2 of them first.",
    );
  });

  it("says when a character has no slots at all", () => {
    expect(attunementRefusal(0, [])).toBe("This character has no attunement slots.");
  });
});
