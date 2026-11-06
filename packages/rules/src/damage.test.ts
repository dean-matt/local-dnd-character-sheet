import { describe, expect, it } from "vitest";
import { damageAtZeroHitPoints, deathSave, heal, takeDamage } from "./index.ts";

const clear = { successes: 0, failures: 0 };
const printed = { instantDeath: true };
const hp = (current: number | null, temporary = 0) => ({ current, temporary });

describe("takeDamage", () => {
  it("spends temporary hit points before current ones", () => {
    expect(takeDamage(hp(20, 5), clear, 20, 8, printed)).toEqual({
      hitPoints: hp(17, 0),
      deathSaves: clear,
      outcome: "conscious",
    });
  });

  it("reads a null current as the maximum", () => {
    expect(takeDamage(hp(null), clear, 20, 3, printed).hitPoints).toEqual(hp(17));
  });

  it("stops current at 0 and leaves the character dying with clear saves", () => {
    expect(takeDamage(hp(5), { successes: 1, failures: 1 }, 20, 12, printed)).toEqual({
      hitPoints: hp(0),
      deathSaves: clear,
      outcome: "dying",
    });
  });

  it("records one failure for damage at 0", () => {
    const saves = { successes: 3, failures: 1 };
    expect(takeDamage(hp(0), saves, 20, 4, printed)).toEqual({
      hitPoints: hp(0),
      deathSaves: { successes: 0, failures: 1 },
      outcome: "dying",
    });
  });

  it("dies on a third failure at 0", () => {
    expect(takeDamage(hp(0), { successes: 0, failures: 2 }, 20, 1, printed).outcome).toBe("dead");
  });

  it("records nothing when temporary hit points absorb damage at 0", () => {
    expect(takeDamage(hp(0, 5), { successes: 1, failures: 1 }, 20, 5, printed)).toEqual({
      hitPoints: hp(0, 0),
      deathSaves: { successes: 1, failures: 1 },
      outcome: "dying",
    });
  });

  describe("instant death", () => {
    it.each([
      ["at 0, equal to the maximum", hp(0), 20],
      ["from above 0, a remainder equal to the maximum", hp(5), 25],
      ["past temporary hit points, a remainder over the maximum", hp(5, 10), 40],
    ])("kills %s", (_, hitPoints, amount) => {
      const result = takeDamage(hitPoints, clear, 20, amount, printed);
      expect(result.outcome).toBe("dead");
      expect(result.hitPoints.current).toBe(0);
      expect(deathSave(result.deathSaves, 20).outcome).toBe("dead");
      expect(damageAtZeroHitPoints(result.deathSaves, false).outcome).toBe("dead");
    });

    it("spares a remainder one short of the maximum", () => {
      expect(takeDamage(hp(5), clear, 20, 24, printed).outcome).toBe("dying");
      expect(takeDamage(hp(0), clear, 20, 19, printed).outcome).toBe("dying");
    });

    it("follows the death saves instead under the house rule", () => {
      const lenient = { ...printed, instantDeath: false };
      expect(takeDamage(hp(5), clear, 20, 25, lenient)).toEqual({
        hitPoints: hp(0),
        deathSaves: clear,
        outcome: "dying",
      });
      expect(takeDamage(hp(0), clear, 20, 20, lenient)).toEqual({
        hitPoints: hp(0),
        deathSaves: { successes: 0, failures: 1 },
        outcome: "dying",
      });
    });
  });

  it("leaves a dead character as it is", () => {
    const dead = { successes: 0, failures: 3 };
    expect(takeDamage(hp(0, 4), dead, 20, 6, printed)).toEqual({
      hitPoints: hp(0, 4),
      deathSaves: dead,
      outcome: "dead",
    });
  });
});

describe("heal", () => {
  it("raises current and leaves temporary alone", () => {
    expect(heal(hp(5, 3), clear, 20, 4)).toEqual({
      hitPoints: hp(9, 3),
      deathSaves: clear,
      outcome: "conscious",
    });
  });

  it.each([
    ["reaching", 15],
    ["passing", 30],
  ])("stores null on %s the maximum", (_, amount) => {
    expect(heal(hp(5), clear, 20, amount).hitPoints).toEqual(hp(null));
  });

  it("leaves a current already above the maximum where it stands", () => {
    expect(heal(hp(25), clear, 20, 5).hitPoints).toEqual(hp(25));
  });

  it("clears both death save counts when healing from 0", () => {
    expect(heal(hp(0), { successes: 2, failures: 2 }, 20, 1)).toEqual({
      hitPoints: hp(1),
      deathSaves: clear,
      outcome: "conscious",
    });
  });

  it("changes nothing for a dead character", () => {
    const dead = { successes: 1, failures: 3 };
    expect(heal(hp(0), dead, 20, 10)).toEqual({
      hitPoints: hp(0),
      deathSaves: dead,
      outcome: "dead",
    });
  });
});

describe.each([
  ["takeDamage", (amount: number) => takeDamage(hp(10, 2), clear, 20, amount, printed)],
  ["heal", (amount: number) => heal(hp(10, 2), clear, 20, amount)],
])("%s amounts", (_, apply) => {
  it("changes nothing for 0", () => {
    expect(apply(0)).toEqual({ hitPoints: hp(10, 2), deathSaves: clear, outcome: "conscious" });
  });

  it.each([-1, 1.5, Number.NaN])("throws a RangeError for %d", (amount) => {
    expect(() => apply(amount)).toThrow(RangeError);
  });
});

describe("hit point inputs", () => {
  const damage = (hitPoints: { current: number | null; temporary: number }, maximum = 20) =>
    takeDamage(hitPoints, clear, maximum, 1, printed);

  it.each([0, -1, 1.5])("throws a RangeError for a maximum of %d", (maximum) => {
    expect(() => damage(hp(5), maximum)).toThrow(RangeError);
    expect(() => heal(hp(5), clear, maximum, 1)).toThrow(RangeError);
  });

  it("throws a RangeError for a fractional current", () => {
    expect(() => damage(hp(5.5))).toThrow(RangeError);
  });

  it.each([-1, 1.5])("throws a RangeError for temporary hit points of %d", (temporary) => {
    expect(() => damage(hp(5, temporary))).toThrow(RangeError);
  });

  it("reads a stored negative current as 0", () => {
    expect(heal(hp(-3), clear, 20, 4).hitPoints).toEqual(hp(4));
    expect(damage(hp(-3)).outcome).toBe("dying");
  });
});
