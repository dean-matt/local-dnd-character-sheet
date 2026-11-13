import { describe, expect, it } from "vitest";
import { defaultCharacterState, longRestHitDicePick, restedState, sheetState } from "./index.ts";

const total = (computed: number, manual: number | null = null) => ({ computed, manual, terms: [] });

const sheet = {
  hitDice: [
    { die: 10 as const, total: total(3) },
    { die: 6 as const, total: total(2, 3) },
  ],
  spellSlots: [{ level: 1, total: total(4) }],
  pactSlots: { level: 2, total: total(2) },
  classResources: [],
};

const BARBARIAN = { name: "Barbarian", source: "PHB" };
const MONK = { name: "Monk", source: "PHB" };

const rages = (maximum: number | null) => ({
  class: BARBARIAN,
  key: "rages",
  maximum: maximum === null ? null : total(maximum),
});

const superiorityDice = {
  name: "Superiority Dice",
  current: 1,
  maximum: 4,
  resetsOn: "short" as const,
};

const state = () => ({
  ...defaultCharacterState(),
  hitPoints: { current: 5, temporary: 2 },
  hitDice: [
    { die: 10 as const, total: 5, remaining: 4 },
    { die: 8 as const, total: 2, remaining: 0 },
  ],
  spellSlots: [
    { level: 1, total: 4, expended: 3 },
    { level: 3, total: 2, expended: 2 },
  ],
  pactSlots: { level: 1, total: 2, expended: 1 },
});

const tired = () => ({
  ...state(),
  hitDice: [
    { die: 10 as const, total: 3, remaining: 0 },
    { die: 6 as const, total: 3, remaining: 0 },
  ],
});

const classic = { edition: "classic" as const, houseRules: {} };

describe("sheetState", () => {
  it("reads each shown pool's total from the derived block and caps what remains at it", () => {
    expect(sheetState(sheet, state()).hitDice).toEqual([
      { die: 10, total: 3, remaining: 3 },
      { die: 6, total: 3, remaining: 3 },
    ]);
  });
});

describe("sheetState's class resources", () => {
  it("holds each pool the derived block lists at its maximum, nothing spent where state holds none", () => {
    const read = sheetState(
      {
        ...sheet,
        classResources: [rages(3), { class: MONK, key: "ki_points", maximum: total(5, 6) }],
      },
      state(),
    );
    expect(read.classResources).toEqual([
      { class: BARBARIAN, key: "rages", maximum: 3, expended: 0 },
      { class: MONK, key: "ki_points", maximum: 6, expended: 0 },
    ]);
  });

  it("caps what was spent at a lowered maximum and never caps an unlimited pool", () => {
    const spent = {
      ...state(),
      classResources: [{ class: BARBARIAN, key: "rages", maximum: 5, expended: 4 }],
    };
    expect(sheetState({ ...sheet, classResources: [rages(3)] }, spent).classResources).toEqual([
      { class: BARBARIAN, key: "rages", maximum: 3, expended: 3 },
    ]);
    expect(sheetState({ ...sheet, classResources: [rages(null)] }, spent).classResources).toEqual([
      { class: BARBARIAN, key: "rages", maximum: null, expended: 4 },
    ]);
  });

  it("drops a pool the derived block no longer lists and keeps every counter the user added", () => {
    const spent = {
      ...state(),
      resources: [superiorityDice],
      classResources: [{ class: BARBARIAN, key: "rages", maximum: 2, expended: 1 }],
    };
    const read = sheetState(sheet, spent);
    expect(read.classResources).toEqual([]);
    expect(read.resources).toEqual([superiorityDice]);
  });
});

describe("restedState", () => {
  it("measures a long rest against the totals the sheet shows", () => {
    const after = restedState(classic, sheet, state(), "long");
    expect(after.hitDice).toEqual([
      { die: 10, total: 3, remaining: 3 },
      { die: 6, total: 3, remaining: 3 },
    ]);
    expect(after.spellSlots).toEqual([{ level: 1, total: 4, expended: 0 }]);
    expect(after.pactSlots).toEqual({ level: 2, total: 2, expended: 0 });
    expect(after.hitPoints).toEqual({ current: null, temporary: 0 });
  });

  it("leaves slots the sheet shows spent where a short rest does not reach", () => {
    const after = restedState(classic, sheet, state(), "short");
    expect(after.spellSlots).toEqual([{ level: 1, total: 4, expended: 3 }]);
    expect(after.hitPoints).toEqual({ current: 5, temporary: 2 });
  });

  it("returns the picked sizes on a classic long rest", () => {
    expect(longRestHitDicePick(classic, sheet, tired())).toEqual({
      allowed: 3,
      spent: [
        { die: 10, count: 3 },
        { die: 6, count: 3 },
      ],
    });
    expect(restedState(classic, sheet, tired(), "long", [10, 6]).hitDice).toEqual([
      { die: 10, total: 3, remaining: 1 },
      { die: 6, total: 3, remaining: 1 },
    ]);
  });

  it("asks nothing under the house rule or in the 2024 rules", () => {
    const house = { ...classic, houseRules: { everyHitDieOnLongRest: true } };
    expect(longRestHitDicePick(house, sheet, tired())).toBeNull();
    expect(longRestHitDicePick({ ...classic, edition: "one" }, sheet, tired())).toBeNull();
    expect(
      restedState(house, sheet, tired(), "long").hitDice.map((pool) => pool.remaining),
    ).toEqual([3, 3]);
  });

  describe("class resource pools", () => {
    const pools = {
      ...sheet,
      classResources: [rages(3), { class: MONK, key: "ki_points", maximum: total(5) }],
    };
    const spent = {
      ...state(),
      classResources: [
        { class: BARBARIAN, key: "rages", maximum: 3, expended: 2 },
        { class: MONK, key: "ki_points", maximum: 5, expended: 3 },
      ],
    };
    const expended = (after: ReturnType<typeof restedState>) =>
      after.classResources.map((pool) => pool.expended);

    it("restores a short-rest pool on a short rest and leaves a long-rest pool spent", () => {
      expect(expended(restedState(classic, pools, spent, "short"))).toEqual([2, 0]);
    });

    it("restores short- and long-rest pools on a long rest", () => {
      expect(expended(restedState(classic, pools, spent, "long"))).toEqual([0, 0]);
    });

    it("restores a pool on the rest its edition names", () => {
      const wild = {
        ...sheet,
        classResources: [{ class: MONK, key: "second_wind", maximum: total(3) }],
      };
      const used = {
        ...state(),
        classResources: [{ class: MONK, key: "second_wind", maximum: 3, expended: 2 }],
      };
      expect(expended(restedState(classic, wild, used, "short"))).toEqual([0]);
      expect(expended(restedState({ ...classic, edition: "one" }, wild, used, "short"))).toEqual([
        1,
      ]);
    });

    describe("a homebrew pool", () => {
      const homebrew = (key: string, resetsOn: "short" | "long" | null) => ({
        sheet: {
          ...sheet,
          classResources: [{ class: MONK, key, maximum: total(3), resets: resetsOn }],
        },
        state: {
          ...state(),
          classResources: [{ class: MONK, key, maximum: 3, expended: 2 }],
        },
      });

      it.each([
        ["short", "short", 0],
        ["short", "long", 0],
        ["long", "short", 2],
        ["long", "long", 0],
        [null, "short", 2],
        [null, "long", 2],
      ] as const)("with resets %s, a %s rest leaves %s spent", (on, length, left) => {
        const { sheet: s, state: st } = homebrew("Ki", on);
        const reloaded = sheetState(s, st);
        expect(expended(restedState(classic, s, reloaded, length))).toEqual([left]);
      });

      it("takes only its stored cadence when named like a catalog pool", () => {
        const { sheet: s, state: st } = homebrew("rages", null);
        const one = { ...classic, edition: "one" as const };
        expect(expended(restedState(one, s, st, "short"))).toEqual([2]);
        expect(expended(restedState(one, s, st, "long"))).toEqual([2]);
      });
    });

    describe("a 2024 partial recharge", () => {
      const one = { ...classic, edition: "one" as const };
      const key = (name: string, expendedUses: number) => ({
        sheet: { ...sheet, classResources: [{ class: MONK, key: name, maximum: total(3) }] },
        state: {
          ...state(),
          classResources: [{ class: MONK, key: name, maximum: 3, expended: expendedUses }],
        },
      });

      it.each(["rages", "channel_divinity", "wild_shape", "second_wind"])(
        "%s regains one use on a short rest and all on a long rest",
        (name) => {
          const { sheet: s, state: st } = key(name, 3);
          expect(expended(restedState(one, s, st, "short"))).toEqual([2]);
          expect(expended(restedState(one, s, st, "long"))).toEqual([0]);
        },
      );

      it("regains none when no use is spent", () => {
        const { sheet: s, state: st } = key("rages", 0);
        expect(expended(restedState(one, s, st, "short"))).toEqual([0]);
      });

      it("leaves a classic rages pool spent on a short rest", () => {
        const { sheet: s, state: st } = key("rages", 3);
        expect(expended(restedState(classic, s, st, "short"))).toEqual([3]);
      });
    });
  });
});

describe("a rest ends a rage", () => {
  const raging = {
    ...defaultCharacterState(),
    activeEffects: [{ name: "Rage" }, { name: "Bless" }],
  };

  it.each(["short", "long"] as const)("on a %s rest, and leaves any other effect", (length) => {
    const definition = { edition: "one" as const, houseRules: {} };
    expect(restedState(definition, sheet, raging, length).activeEffects).toEqual([
      { name: "Bless" },
    ]);
  });
});

describe("a rest and concentration", () => {
  const concentrating = {
    ...defaultCharacterState(),
    concentration: { spell: { name: "Hex", source: "PHB" }, level: 1 },
  };

  it("ends on a long rest and holds through a short one", () => {
    const definition = { edition: "one" as const, houseRules: {} };
    expect(restedState(definition, sheet, concentrating, "long").concentration).toBeNull();
    expect(restedState(definition, sheet, concentrating, "short").concentration).toEqual(
      concentrating.concentration,
    );
  });
});

describe("a rest and a reduction to the hit point maximum", () => {
  const definition = { edition: "one" as const, houseRules: {} };
  const reduced = (clearsOnLongRest: boolean) => ({
    ...defaultCharacterState(),
    hitPointMaximumReduction: { amount: 5, clearsOnLongRest },
  });
  const after = (clearsOnLongRest: boolean, length: "short" | "long") =>
    restedState(definition, sheet, reduced(clearsOnLongRest), length).hitPointMaximumReduction;

  it("clears on a long rest and holds through a short one", () => {
    expect(after(true, "long")).toBeNull();
    expect(after(true, "short")).toEqual({ amount: 5, clearsOnLongRest: true });
  });

  it("holds through a long rest where marked to", () => {
    expect(after(false, "long")).toEqual({ amount: 5, clearsOnLongRest: false });
  });
});

describe("a rest and a feature's limited uses", () => {
  const features = [
    { key: "Race|Dwarf|PHB|Stone's Endurance", reset: "short" as const },
    { key: "Race|Half-Orc|PHB|Relentless Endurance", reset: "long" as const },
  ];
  const used = {
    ...defaultCharacterState(),
    featureUses: features.map((feature) => ({ key: feature.key, expended: 1 })),
  };
  const spent = (length: "short" | "long") =>
    restedState(classic, sheet, used, length, undefined, features).featureUses;

  it("restores every feature's uses on a long rest", () => {
    expect(spent("long")).toEqual([]);
  });

  it("restores only a short-rest feature's uses on a short rest", () => {
    expect(spent("short")).toEqual([{ key: features[1]?.key, expended: 1 }]);
  });
});

describe("a rest and an item's charges", () => {
  const used = {
    ...defaultCharacterState(),
    itemCharges: [
      { id: "wand", expended: 5 },
      { id: "rod", expended: 2 },
      { id: "staff", expended: 4 },
    ],
  };
  const recharges = [
    { id: "wand", max: 7, regained: 3 },
    { id: "rod", max: 3, regained: 6 },
  ];

  it("returns the regained charges to each recharging item on a long rest, never past what was spent", () => {
    expect(restedState(classic, sheet, used, "long", undefined, [], recharges).itemCharges).toEqual(
      [
        { id: "wand", expended: 2 },
        { id: "staff", expended: 4 },
      ],
    );
  });

  it("restores nothing on a short rest", () => {
    expect(
      restedState(classic, sheet, used, "short", undefined, [], recharges).itemCharges,
    ).toEqual(used.itemCharges);
  });
});
