import { describe, expect, it } from "vitest";
import { defenseTraitSchema } from "./index.ts";

describe("defenseTraitSchema", () => {
  it("reads a race's resistances and an item's immunities", () => {
    expect(defenseTraitSchema.parse({ name: "Hill", resist: ["poison"] })).toEqual({
      resist: ["poison"],
      immune: [],
      conditionImmune: [],
    });
    expect(
      defenseTraitSchema.parse({
        name: "Periapt of Proof against Poison",
        immune: ["poison"],
        conditionImmune: ["poisoned"],
      }),
    ).toEqual({ resist: [], immune: ["poison"], conditionImmune: ["poisoned"] });
  });

  it("grants nothing for a choice the character has not stored", () => {
    const dragonborn = { resist: [{ choose: { from: ["acid", "cold", "fire"] } }] };
    expect(defenseTraitSchema.parse(dragonborn).resist).toEqual([]);
  });

  it("reads a subrace's null as no resistance", () => {
    expect(defenseTraitSchema.parse({ name: "Draconblood", resist: null }).resist).toEqual([]);
  });

  it("lowercases and folds a homebrew spelling into upstream's", () => {
    expect(defenseTraitSchema.parse({ resist: ["Fire", " fire ", ""] }).resist).toEqual(["fire"]);
  });

  it("grants nothing for a potion, whose effect lasts only as long as the drink", () => {
    const potion = { type: "P|XPHB", resist: ["fire"] };
    expect(defenseTraitSchema.parse(potion).resist).toEqual([]);
  });

  it("grants nothing for a malformed list rather than refusing the row", () => {
    expect(defenseTraitSchema.parse({ resist: "fire" }).resist).toEqual([]);
  });
});
