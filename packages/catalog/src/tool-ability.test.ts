import { describe, expect, it } from "vitest";
import { toolAbility } from "./tool-ability.ts";

describe("toolAbility", () => {
  it("reads the Ability line of a 2024 tool", () => {
    const entries = [
      {
        type: "list",
        items: [
          { name: "Ability:", type: "item", entries: ["Dexterity"] },
          { name: "Utilize:", type: "item", entries: ["Pick a lock"] },
        ],
      },
    ];
    expect(toolAbility({ entries })).toBe("dex");
  });

  it("is absent where the text prints none", () => {
    expect(toolAbility({ entries: ["A small file and lock picks."] })).toBeUndefined();
    expect(toolAbility({})).toBeUndefined();
  });

  it("is absent where the label is not exactly one ability", () => {
    const line = (text: unknown) => [
      { type: "list", items: [{ name: "Ability:", type: "item", entries: [text] }] },
    ];
    expect(toolAbility({ entries: line("Dexterity or Intelligence") })).toBeUndefined();
    expect(toolAbility({ entries: line("{@variantrule Dexterity|XPHB}") })).toBeUndefined();
  });
});
