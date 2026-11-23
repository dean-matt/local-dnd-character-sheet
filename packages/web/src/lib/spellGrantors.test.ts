import { describe, expect, it } from "vitest";
import { blockGrantorOf, rowPickedFor } from "./spellGrantors.ts";

describe("blockGrantorOf", () => {
  const ref = { name: "Circle of the Land", source: "PHB" };
  const druid = { name: "Druid", source: "PHB" };

  it("names a subclass's class and a subrace's race beside it", () => {
    expect(blockGrantorOf({ grantor: "subclass", ref, parent: druid, level: 3 })).toEqual({
      kind: "subclass",
      ref,
      class: druid,
    });
    expect(blockGrantorOf({ grantor: "subrace", ref, parent: druid, level: 1 })).toEqual({
      kind: "subrace",
      ref,
      race: druid,
    });
  });

  it("stores no choice for a class, or a subclass with no class", () => {
    expect(blockGrantorOf({ grantor: "class", ref, level: 1 })).toBeUndefined();
    expect(blockGrantorOf({ grantor: "subclass", ref, level: 3 })).toBeUndefined();
  });
});

describe("rowPickedFor", () => {
  it("names the row a spell was picked for, and none for a class feature's pick", () => {
    const ref = { name: "Magic Initiate", source: "PHB" };
    const feat = { kind: "feat", ref };
    expect(rowPickedFor({ pickedFor: feat })).toBe(feat);
    expect(rowPickedFor({ pickedFor: { kind: "classFeature", ref } })).toBeUndefined();
    expect(rowPickedFor({})).toBeUndefined();
  });
});
