import { describe, expect, it } from "vitest";
import { type Edition, encumbranceAt, exhaustionEffects, reducedSpeed } from "./index.ts";

const WOOD_ELF_SPEED = 35;
const DWARF_SPEED = 25;
const HUMAN_SPEED = 30;

/** What exhaustion costs a speed, in the three terms `reducedSpeed` takes. */
function exhaustionSpeedCost(level: number, edition: Edition) {
  const effects = exhaustionEffects(level, edition);
  return {
    reduction: effects.edition === "one" ? effects.speedReduction : 0,
    halved: effects.edition === "classic" && effects.speedHalved,
    zeroed: effects.edition === "classic" && effects.speedZero,
  };
}

describe("reducedSpeed", () => {
  it("leaves an unreduced speed alone", () => {
    expect(reducedSpeed({ base: HUMAN_SPEED })).toBe(HUMAN_SPEED);
  });

  it("subtracts before halving, where the other order strands the creature at zero", () => {
    const speed = reducedSpeed({ base: WOOD_ELF_SPEED, reduction: 20, halved: true });
    const halvingFirst = Math.max(0, Math.floor(WOOD_ELF_SPEED / 2) - 20);
    expect(halvingFirst).toBe(0);
    expect(speed).toBe(7);
  });

  it("rounds a halved odd speed down", () => {
    expect(reducedSpeed({ base: DWARF_SPEED, halved: true })).toBe(12);
  });

  it.each([
    { reduction: HUMAN_SPEED, halved: false },
    { reduction: 45, halved: false },
    { reduction: 45, halved: true },
  ])("floors at zero rather than moving a creature backwards", (parts) => {
    expect(reducedSpeed({ base: HUMAN_SPEED, ...parts })).toBe(0);
  });

  it.each([
    { reduction: 0, halved: false },
    { reduction: 20, halved: true },
  ])("zeroes a classic exhaustion 5 speed over any arithmetic", (parts) => {
    expect(reducedSpeed({ base: WOOD_ELF_SPEED, ...parts, zeroed: true })).toBe(0);
  });

  it.each([-1, 2.5, Number.NaN])("rejects a base speed of %s", (base) => {
    expect(() => reducedSpeed({ base })).toThrow(RangeError);
  });

  it.each([-1, 2.5, Number.NaN])("rejects a reduction of %s", (reduction) => {
    expect(() => reducedSpeed({ base: HUMAN_SPEED, reduction })).toThrow(RangeError);
  });
});

describe("reducedSpeed against the two tables", () => {
  it("walks a heavily encumbered Wood Elf at classic exhaustion 2 at 7 feet", () => {
    const load = encumbranceAt(10, "medium", 105);
    const exhaustion = exhaustionSpeedCost(2, "classic");
    expect(load.speedReduction).toBe(20);
    expect(exhaustion.halved).toBe(true);
    expect(
      reducedSpeed({
        base: WOOD_ELF_SPEED,
        reduction: load.speedReduction + exhaustion.reduction,
        halved: exhaustion.halved,
        zeroed: exhaustion.zeroed,
      }),
    ).toBe(7);
  });

  it("subtracts both flat penalties for a `one` character running the encumbrance variant", () => {
    const load = encumbranceAt(10, "medium", 60);
    const exhaustion = exhaustionSpeedCost(3, "one");
    expect(load.speedReduction).toBe(10);
    expect(exhaustion.reduction).toBe(15);
    expect(
      reducedSpeed({
        base: HUMAN_SPEED,
        reduction: load.speedReduction + exhaustion.reduction,
        halved: exhaustion.halved,
        zeroed: exhaustion.zeroed,
      }),
    ).toBe(5);
  });

  it("stops a classic character at exhaustion 5 whatever they carry", () => {
    const load = encumbranceAt(10, "medium", 0);
    const exhaustion = exhaustionSpeedCost(5, "classic");
    expect(
      reducedSpeed({
        base: WOOD_ELF_SPEED,
        reduction: load.speedReduction + exhaustion.reduction,
        halved: exhaustion.halved,
        zeroed: exhaustion.zeroed,
      }),
    ).toBe(0);
  });
});
