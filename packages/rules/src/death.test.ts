import { describe, expect, it } from "vitest";
import { damageAtZeroHitPoints, deathSave } from "./index.ts";

describe("deathSave", () => {
  it.each([
    [10, 1, 0],
    [11, 1, 0],
    [19, 1, 0],
  ])("counts a %i as a success", (roll, successes, failures) => {
    expect(deathSave({ successes: 0, failures: 0 }, roll)).toEqual({
      successes,
      failures,
      outcome: "dying",
    });
  });

  it.each([
    [2, 0, 1],
    [9, 0, 1],
  ])("counts a %i as a failure", (roll, successes, failures) => {
    expect(deathSave({ successes: 0, failures: 0 }, roll)).toEqual({
      successes,
      failures,
      outcome: "dying",
    });
  });

  it("stabilizes on the third success and clears both counts", () => {
    expect(deathSave({ successes: 2, failures: 2 }, 10)).toEqual({
      successes: 0,
      failures: 0,
      outcome: "stable",
    });
  });

  it("dies on the third failure", () => {
    expect(deathSave({ successes: 2, failures: 2 }, 9)).toEqual({
      successes: 2,
      failures: 3,
      outcome: "dead",
    });
  });

  it("wakes at 1 hit point on a natural 20 rather than recording a third success", () => {
    expect(deathSave({ successes: 2, failures: 2 }, 20)).toEqual({
      successes: 0,
      failures: 0,
      outcome: "conscious",
    });
  });

  it("records two failures on a natural 1", () => {
    expect(deathSave({ successes: 0, failures: 0 }, 1)).toEqual({
      successes: 0,
      failures: 2,
      outcome: "dying",
    });
  });

  it.each([1, 2])(
    "reaches three rather than four from %i failure(s) on a natural 1",
    (failures) => {
      expect(deathSave({ successes: 0, failures }, 1)).toEqual({
        successes: 0,
        failures: 3,
        outcome: "dead",
      });
    },
  );

  it.each([0, 21, 10.5, Number.NaN])("rejects a d20 result of %s", (roll) => {
    expect(() => deathSave({ successes: 0, failures: 0 }, roll)).toThrow(RangeError);
  });

  it.each([-1, 4, 1.5, Number.NaN])("rejects a count of %s in either column", (count) => {
    expect(() => deathSave({ successes: count, failures: 0 }, 10)).toThrow(RangeError);
    expect(() => deathSave({ successes: 0, failures: count }, 10)).toThrow(RangeError);
  });

  it.each(["successes", "failures"])("rejects an absent %s count", (label) => {
    const saves = { successes: 0, failures: 0 };
    delete (saves as Record<string, number>)[label];
    expect(() => deathSave(saves, 10)).toThrow(RangeError);
  });

  it("answers a state already holding three successes without reading the roll", () => {
    expect(deathSave({ successes: 3, failures: 0 }, 5)).toEqual({
      successes: 0,
      failures: 0,
      outcome: "stable",
    });
  });

  it.each([20, 15, 1])("leaves a character already dead dead on a %i", (roll) => {
    expect(deathSave({ successes: 2, failures: 3 }, roll)).toEqual({
      successes: 2,
      failures: 3,
      outcome: "dead",
    });
  });

  it("round-trips its own dead result rather than reviving on a natural 20", () => {
    const { outcome, ...counts } = deathSave({ successes: 2, failures: 2 }, 9);
    expect(outcome).toBe("dead");
    expect(deathSave(counts, 20).outcome).toBe("dead");
  });

  it.each([1, 5, 10, 15, 20])(
    "returns three in both columns only where given them, on a %i",
    (roll) => {
      for (const successes of [0, 1, 2, 3]) {
        for (const failures of [0, 1, 2, 3]) {
          const result = deathSave({ successes, failures }, roll);
          expect(successes === 3 && failures === 3).toBe(
            result.successes === 3 && result.failures === 3,
          );
        }
      }
    },
  );
});

describe("damageAtZeroHitPoints", () => {
  it("starts the saves again on a stable character, whose counts are cleared", () => {
    expect(damageAtZeroHitPoints({ successes: 0, failures: 0 }, false)).toEqual({
      successes: 0,
      failures: 1,
      outcome: "dying",
    });
  });

  it("records one failure", () => {
    expect(damageAtZeroHitPoints({ successes: 1, failures: 0 }, false)).toEqual({
      successes: 1,
      failures: 1,
      outcome: "dying",
    });
  });

  it("records two failures for a critical hit", () => {
    expect(damageAtZeroHitPoints({ successes: 1, failures: 0 }, true)).toEqual({
      successes: 1,
      failures: 2,
      outcome: "dying",
    });
  });

  it.each([
    [2, false],
    [1, true],
    [2, true],
  ])("dies at three failures from %i and critical %s", (failures, critical) => {
    expect(damageAtZeroHitPoints({ successes: 0, failures }, critical)).toEqual({
      successes: 0,
      failures: 3,
      outcome: "dead",
    });
  });

  it.each([-1, 4, 1.5, Number.NaN])("rejects a count of %s in either column", (count) => {
    expect(() => damageAtZeroHitPoints({ successes: count, failures: 0 }, false)).toThrow(
      RangeError,
    );
    expect(() => damageAtZeroHitPoints({ successes: 0, failures: count }, false)).toThrow(
      RangeError,
    );
  });

  it.each(["successes", "failures"])("rejects an absent %s count", (label) => {
    const saves = { successes: 0, failures: 0 };
    delete (saves as Record<string, number>)[label];
    expect(() => damageAtZeroHitPoints(saves, false)).toThrow(RangeError);
  });

  it.each([false, true])("leaves a character already dead dead, critical %s", (critical) => {
    expect(damageAtZeroHitPoints({ successes: 2, failures: 3 }, critical)).toEqual({
      successes: 2,
      failures: 3,
      outcome: "dead",
    });
  });

  it.each([
    [false, 1],
    [true, 2],
  ])("ends being stable and records %s damage as %i failure(s)", (critical, failures) => {
    expect(damageAtZeroHitPoints({ successes: 3, failures: 0 }, critical)).toEqual({
      successes: 0,
      failures,
      outcome: "dying",
    });
  });
});
