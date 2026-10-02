import { describe, expect, it } from "vitest";
import { type CharacterDefinition, describeChange } from "./index.ts";
import { definition } from "./test/vex.ts";

const edit = (change: Partial<CharacterDefinition>): CharacterDefinition => ({
  ...structuredClone(definition),
  ...change,
});

describe("describeChange", () => {
  it("is null where nothing changed", () => {
    expect(describeChange(definition, structuredClone(definition))).toBeNull();
  });

  it("names an ability score by its ability, with both values", () => {
    const after = edit({ abilityScores: { ...definition.abilityScores, cha: 18 } });
    expect(describeChange(definition, after)).toEqual({
      paths: ["abilityScores.cha"],
      describedAs: "Charisma 17 to 18",
    });
  });

  it("names the item and field of a single inventory entry's edit", () => {
    const after = edit({
      inventory: definition.inventory.map((entry, at) =>
        at === 0 ? { ...entry, grip: "two-handed" as const } : entry,
      ),
    });
    expect(describeChange(definition, after)).toEqual({
      paths: ["inventory.0.grip"],
      describedAs: "Dagger grip set to two-handed",
    });
  });

  it("names a whole section where the list changed length", () => {
    const after = edit({ inventory: definition.inventory.slice(1) });
    expect(describeChange(definition, after)?.describedAs).toBe("Inventory edited");
  });

  it("reads an override key as words, and a cleared one as cleared", () => {
    const set = edit({ overrides: { "skills.Stealth|XPHB.modifier": 9 } });
    expect(describeChange(definition, set)?.describedAs).toBe(
      "Skills Stealth modifier override set to 9",
    );
    expect(describeChange(set, definition)?.describedAs).toBe(
      "Skills Stealth modifier override cleared",
    );
    const attack = edit({ overrides: { "attacks.catalog|Dagger|XPHB#0.attackBonus": 7 } });
    expect(describeChange(definition, attack)?.describedAs).toBe(
      "Attacks Dagger attack bonus override set to 7",
    );
  });

  it("reads a first note as set and an emptied one as cleared", () => {
    const empty = edit({ notes: "" });
    const noted = edit({ notes: "Buy rope" });
    expect(describeChange(empty, noted)?.describedAs).toBe("Notes set to Buy rope");
    expect(describeChange(noted, empty)?.describedAs).toBe("Notes cleared");
  });

  it("says edited rather than quoting long text", () => {
    const after = edit({ notes: "x".repeat(41) });
    expect(describeChange(definition, after)?.describedAs).toBe("Notes edited");
  });

  it("counts past three changes rather than listing them", () => {
    const after = edit({
      name: "Nyx",
      abilityScores: { ...definition.abilityScores, str: 9, dex: 17, con: 15 },
    });
    expect(describeChange(definition, after)?.describedAs).toBe(
      "Name Vex to Nyx, Strength 8 to 9 and 2 more changes",
    );
  });
});
