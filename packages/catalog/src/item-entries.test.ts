import { describe, expect, it } from "vitest";
import { itemEntries } from "./index.ts";

const FEATURE = "replicate magic item|artificer|efa|2|efa";
const INFUSION = "replicate magic item|tce";

describe("itemEntries", () => {
  it("closes the text with the class feature and the infusion that replicate the item", () => {
    expect(
      itemEntries({ entries: ["Worn."], classFeatures: [FEATURE], optionalfeatures: [INFUSION] }),
    ).toEqual([
      "Worn.",
      "An Artificer can replicate this item with {@classFeature replicate magic item|artificer|efa|2|efa|Replicate Magic Item} or the {@optfeature replicate magic item|tce|Replicate Magic Item} infusion.",
    ]);
  });

  it("pads a reference short of its fields, so the display never lands in the key", () => {
    expect(itemEntries({ optionalfeatures: ["replicate magic item"] })).toEqual([
      "An Artificer can replicate this item with the {@optfeature replicate magic item||Replicate Magic Item} infusion.",
    ]);
  });

  it("adds nothing to an item that names neither, or names them in a shape it cannot read", () => {
    expect(itemEntries({ entries: ["Worn."] })).toEqual(["Worn."]);
    expect(itemEntries({ entries: ["Worn."], classFeatures: "replicate magic item" })).toEqual([
      "Worn.",
    ]);
  });
});
