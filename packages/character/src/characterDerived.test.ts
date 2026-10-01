import { carryingCapacity, encumbranceThresholds } from "@dnd/rules";
import { describe, expect, it } from "vitest";
import { characterDefinitionSchema, characterDerivedSchema, derivedValue } from "./index.ts";
import { definition, derivedInput } from "./test/vex.ts";

describe("size and speed", () => {
  it("feeds the rules functions a caller would otherwise invent a size for", () => {
    const stored = characterDefinitionSchema.parse(structuredClone(definition));
    const size = derivedValue(characterDerivedSchema.parse(derivedInput()).size);

    expect(carryingCapacity(stored.abilityScores.str, size)).toBe(120);
    expect(encumbranceThresholds(stored.abilityScores.str, size)).toEqual({
      encumbered: { tier: "encumbered", atWeight: 40, speedReduction: 10, disadvantage: false },
      heavilyEncumbered: {
        tier: "heavilyEncumbered",
        atWeight: 80,
        speedReduction: 20,
        disadvantage: true,
      },
    });
  });

  it("recomputes both when the race changes, keeping a manual size", () => {
    const enlarged = characterDerivedSchema.parse(
      derivedInput({ size: { computed: "medium", manual: "large" } }),
    );
    const asHalfling = characterDerivedSchema.parse({
      ...enlarged,
      size: { ...enlarged.size, computed: "small" },
      speed: { computed: { walk: 25 } },
    });

    expect(asHalfling.size.computed).toBe("small");
    expect(derivedValue(asHalfling.size)).toBe("large");
    expect(derivedValue(asHalfling.speed)).toEqual({ walk: 25 });
  });

  it("carries the other movement modes a race grants", () => {
    const winged = characterDerivedSchema.parse(
      derivedInput({ speed: { computed: { walk: 30, fly: 30 } } }),
    );
    expect(derivedValue(winged.speed)).toEqual({ walk: 30, fly: 30 });
  });

  it("refuses a size the rules vocabulary does not name", () => {
    expect(
      characterDerivedSchema.safeParse(derivedInput({ size: { computed: "colossal" } })).success,
    ).toBe(false);
  });

  it("requires a walking speed, and refuses a mode the vocabulary does not name", () => {
    expect(
      characterDerivedSchema.safeParse(derivedInput({ speed: { computed: { fly: 30 } } })).success,
    ).toBe(false);
    expect(
      characterDerivedSchema.safeParse(
        derivedInput({ speed: { computed: { walk: 30, hover: 30 } } }),
      ).success,
    ).toBe(false);
  });
});
