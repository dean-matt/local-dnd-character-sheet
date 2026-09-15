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
});

describe("damageAtZeroHitPoints", () => {
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
});
