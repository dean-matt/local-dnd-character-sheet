import { describe, expect, it } from "vitest";
import { type HitDie, resetsOn, rest } from "./index.ts";

describe("resetsOn", () => {
  it.each([
    ["restShort", "short"],
    ["restLong", "long"],
    ["dawn", "dawn"],
  ] as const)("maps %s to %s", (recharge, expected) => {
    expect(resetsOn(recharge)).toBe(expected);
  });

  it.each(["dusk", "midnight", "special", "", "consumed"])("degrades %s to manual", (recharge) => {
    expect(resetsOn(recharge)).toBe("manual");
  });

  it.each(["constructor", "toString", "hasOwnProperty"])(
    "degrades the inherited key %s to manual",
    (recharge) => {
      expect(resetsOn(recharge)).toBe("manual");
    },
  );

  it.each([null, undefined])("degrades %s to manual", (recharge) => {
    expect(resetsOn(recharge)).toBe("manual");
  });
});

describe("rest", () => {
  const conditions = [{ name: "Poisoned", source: "XPHB" }];
  const deathSaves = { successes: 1, failures: 2 };
  const state = () => ({
    hitPoints: { current: 7, temporary: 4 },
    hitDice: [
      { die: 10 as const, total: 3, remaining: 1 },
      { die: 6 as const, total: 2, remaining: 2 },
    ],
    spellSlots: [
      { level: 1, total: 4, expended: 3 },
      { level: 2, total: 2, expended: 2 },
    ],
    pactSlots: { level: 3, total: 2, expended: 2 },
    resources: [
      { name: "Ki", current: 1, maximum: 5, resetsOn: "short" as const },
      { name: "Rage", current: 0, maximum: 3, resetsOn: "long" as const },
      { name: "Wand charges", current: 2, maximum: 7, resetsOn: "dawn" as const },
      { name: "Favor", current: 0, maximum: 1, resetsOn: "manual" as const },
    ],
    conditions,
    deathSaves,
    exhaustion: 2,
  });
  const long = { length: "long" as const, edition: "one" as const, everyHitDie: false };
  const short = { ...long, length: "short" as const };
  const classic = { ...long, edition: "classic" as const };

  it("restores hit points, slots and exhaustion on a long rest", () => {
    const after = rest(state(), long);
    expect(after.hitPoints).toEqual({ current: null, temporary: 0 });
    expect(after.spellSlots.map((slot) => slot.expended)).toEqual([0, 0]);
    expect(after.exhaustion).toBe(1);
    expect(rest({ ...state(), exhaustion: 0 }, long).exhaustion).toBe(0);
  });

  it("leaves hit points, slots, exhaustion and hit dice alone on a short rest", () => {
    const before = state();
    const after = rest(before, short);
    expect(after.hitPoints).toEqual(before.hitPoints);
    expect(after.spellSlots).toEqual(before.spellSlots);
    expect(after.exhaustion).toBe(2);
    expect(after.hitDice).toEqual(before.hitDice);
  });

  it.each([short, long])("clears pact slots on a $length rest", (options) => {
    expect(rest(state(), options).pactSlots).toEqual({ level: 3, total: 2, expended: 0 });
    expect(rest({ ...state(), pactSlots: null }, options).pactSlots).toBeNull();
  });

  it.each([
    [short, [5, 0, 2, 0]],
    [long, [5, 3, 7, 0]],
  ])("resets the resources a $length rest recovers", (options, expected) => {
    expect(rest(state(), options).resources.map((resource) => resource.current)).toEqual(expected);
  });

  it("returns every spent hit die on a 2024 long rest", () => {
    expect(rest(state(), long).hitDice.map((pool) => pool.remaining)).toEqual([3, 2]);
  });

  describe("a classic long rest", () => {
    const fiveDice = () => ({
      ...state(),
      hitDice: [
        { die: 10 as const, total: 3, remaining: 0 },
        { die: 6 as const, total: 2, remaining: 1 },
      ],
    });
    const remaining = (picked?: HitDie[]) =>
      rest(fiveDice(), { ...classic, picked }).hitDice.map((pool) => pool.remaining);

    it("returns every spent die when no more were spent than half the total", () => {
      expect(rest(state(), classic).hitDice.map((pool) => pool.remaining)).toEqual([3, 2]);
    });

    it("returns at least 1 die", () => {
      const one = { ...state(), hitDice: [{ die: 8 as const, total: 1, remaining: 0 }] };
      expect(rest(one, classic).hitDice).toEqual([{ die: 8, total: 1, remaining: 1 }]);
    });

    it("returns exactly the picked sizes when more were spent than return", () => {
      expect(remaining([10, 6])).toEqual([1, 2]);
      expect(remaining([10])).toEqual([1, 1]);
    });

    it("needs picks when more were spent than return", () => {
      expect(() => remaining()).toThrow(/4 hit dice were spent and 2 return/);
    });

    it("rejects more picks than dice return", () => {
      expect(() => remaining([10, 10, 10])).toThrow(/3 hit dice were picked and at most 2 return/);
    });

    it("rejects a size picked more times than dice of it were spent", () => {
      expect(() => remaining([6, 6])).toThrow(/More d6 hit dice were picked than were spent/);
      expect(() => remaining([8])).toThrow(/More d8 hit dice/);
    });

    it("returns every spent die under the house rule, with no picks", () => {
      expect(
        rest(fiveDice(), { ...classic, everyHitDie: true }).hitDice.map((pool) => pool.remaining),
      ).toEqual([3, 2]);
    });
  });

  it.each([short, long])("passes conditions and death saves through a $length rest", (options) => {
    const after = rest(state(), options);
    expect(after.conditions).toEqual(conditions);
    expect(after.deathSaves).toEqual(deathSaves);
  });

  it("leaves its input unmodified and gives the same result every time", () => {
    const before = state();
    const first = rest(before, classic);
    expect(before).toEqual(state());
    expect(rest(before, classic)).toEqual(first);
  });
});
