import { describe, expect, it } from "vitest";
import { blockGrantorOf } from "./spellGrantors.ts";

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
