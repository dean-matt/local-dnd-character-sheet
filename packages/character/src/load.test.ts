import {
  carryingCapacity,
  type Edition,
  encumbranceThresholds,
  exhaustionEffects,
  reducedSpeed,
} from "@dnd/rules";
import { describe, expect, it } from "vitest";
import {
  type ContainerTrait,
  carriedWeight,
  characterDefinitionSchema,
  characterDerivedSchema,
  derivedValue,
  encumberedSpeed,
  entryKey,
  itemKey,
} from "./index.ts";
import { containerOverflows } from "./load.ts";
import { definition, derivedInput } from "./test/vex.ts";

describe("carried weight", () => {
  const ARROW = { name: "Arrow", source: "XPHB" };
  const BALL_BEARING = { name: "Ball Bearing", source: "PHB" };
  const CALTROP = { name: "Caltrop", source: "PHB" };
  const SLING_BULLET = { name: "Sling Bullet", source: "XPHB" };
  const DART = { name: "Dart", source: "XPHB" };
  const ROPE = { name: "Hempen Rope (50 feet)", source: "PHB" };
  const VIAL = { name: "Vial", source: "XPHB" };
  const CHEST = { name: "Chest", source: "PHB" };

  /** Upstream's own pounds, `Vial` (XPHB) among the rows that print none. */
  const catalog = new Map<string, number | null>([
    [entryKey(ARROW), 0.05],
    [entryKey(BALL_BEARING), 0.002],
    [entryKey(CALTROP), 0.1],
    [entryKey(SLING_BULLET), 0.075],
    [entryKey(DART), 0.25],
    [entryKey(ROPE), 10],
    [entryKey(VIAL), null],
    [entryKey(CHEST), 25],
    [entryKey({ homebrewId: "hb_01" }), 1],
  ]);

  const packing = (inventory: object[], money: object) =>
    characterDefinitionSchema.parse({ ...structuredClone(definition), inventory, money });

  it("totals what the character holds, homebrew and coins included", () => {
    const packed = packing(
      [{ ref: ROPE }, { ref: ARROW, quantity: 20 }, { ref: { homebrewId: "hb_01" }, quantity: 3 }],
      { gold: 50 },
    );
    expect(carriedWeight(packed, catalog, new Map())).toBe(10 + 1 + 3 + 1);
  });

  it("leaves out what is stored elsewhere, equipment and containers alike", () => {
    const packed = packing(
      [{ ref: ROPE }, { ref: CHEST, carried: false }, { ref: ARROW, quantity: 20, carried: false }],
      {},
    );
    expect(carriedWeight(packed, catalog, new Map())).toBe(10);
  });

  describe("containers", () => {
    const BAG = { name: "Bag of Holding", source: "XDMG" };
    const BACKPACK = { name: "Backpack", source: "XPHB" };
    const QUIVER = { name: "Quiver", source: "XPHB" };
    const stored = new Map<string, number | null>([
      ...catalog,
      [entryKey(BAG), 15],
      [entryKey(BACKPACK), 5],
      [entryKey(QUIVER), 1],
    ]);
    const containers = new Map<string, ContainerTrait>([
      [entryKey(BAG), { name: "Bag of Holding", weightless: true, weight: 500, items: {} }],
      [entryKey(BACKPACK), { name: "Backpack", weightless: false, weight: 30, items: {} }],
      [entryKey(QUIVER), { name: "Quiver", weightless: false, items: { "arrow|xphb": 20 } }],
    ]);
    const packedIn = (holder: object, ...contents: object[]) =>
      packing(
        [{ ref: BAG, id: "a", ...holder }, ...contents.map((item) => ({ inside: "a", ...item }))],
        {},
      );

    it("weighs nothing for what a weightless container holds, and the container itself", () => {
      const packed = packedIn({}, { ref: ROPE }, { ref: CHEST });
      expect(carriedWeight(packed, stored, containers)).toBe(15);
    });

    it("counts what an ordinary container holds", () => {
      const packed = packing(
        [
          { ref: BACKPACK, id: "a" },
          { ref: ROPE, inside: "a" },
        ],
        {},
      );
      expect(carriedWeight(packed, stored, containers)).toBe(15);
    });

    it("leaves out the contents of a container left behind", () => {
      const packed = packing(
        [
          { ref: BACKPACK, id: "a", carried: false },
          { ref: ROPE, inside: "a" },
        ],
        {},
      );
      expect(carriedWeight(packed, stored, containers)).toBe(0);
    });

    it("reads an entry stored without a container as outside any", () => {
      const parsed = characterDefinitionSchema.parse({
        ...structuredClone(definition),
        inventory: [{ ref: ROPE }],
      });
      expect(parsed.inventory[0]).not.toHaveProperty("inside");
    });

    it("refuses a placement in a missing, shared or nested holder", () => {
      const bad = (inventory: object[]) =>
        characterDefinitionSchema.safeParse({ ...structuredClone(definition), inventory }).success;
      expect(bad([{ ref: ROPE, inside: "nowhere" }])).toBe(false);
      expect(
        bad([
          { ref: BAG, id: "a" },
          { ref: CHEST, id: "a" },
        ]),
      ).toBe(false);
      expect(
        bad([
          { ref: BAG, id: "a" },
          { ref: CHEST, id: "b", inside: "a" },
          { ref: ROPE, inside: "b" },
        ]),
      ).toBe(false);
    });

    it("names the container and the excess when its contents pass its pounds", () => {
      const packed = packing(
        [
          { ref: BACKPACK, id: "a" },
          { ref: CHEST, inside: "a" },
          { ref: ROPE, inside: "a" },
        ],
        {},
      );
      expect(containerOverflows(packed, stored, containers)).toEqual([
        { entry: 0, name: "Backpack", excess: 5, unit: "lb" },
      ]);
    });

    it("names the excess of a counted thing, and none at the limit", () => {
      const quiver = (count: number) =>
        packing(
          [
            { ref: QUIVER, id: "a" },
            { ref: ARROW, quantity: count, inside: "a" },
          ],
          {},
        );
      expect(containerOverflows(quiver(20), stored, containers)).toEqual([]);
      expect(containerOverflows(quiver(23), stored, containers)).toEqual([
        { entry: 0, name: "Quiver", excess: 3, unit: "arrow|xphb" },
      ]);
    });
  });

  it("weighs an item whose row states no weight as nothing", () => {
    const packed = packing([{ ref: VIAL, quantity: 12 }, { ref: ROPE }], {});
    expect(carriedWeight(packed, catalog, new Map())).toBe(10);
  });

  it("rejects a reference neither store names, rather than weighing it zero", () => {
    const packed = packing([{ ref: { name: "Hat of Disguise", source: "XDMG" } }], {});
    expect(() => carriedWeight(packed, catalog, new Map())).toThrow(
      "No item row for catalog|Hat of Disguise|XDMG",
    );

    const homebrew = packing([{ ref: { homebrewId: "hb_99" } }], {});
    expect(() => carriedWeight(homebrew, catalog, new Map())).toThrow(
      "No item row for homebrew|hb_99",
    );
  });

  it("sums fractional weights exactly at the quantities a real pack reaches", () => {
    /** The printed bundles: a quiver, a bag of bearings, a bag of caltrops, a pouch, a sheaf. */
    const ammunition = [
      { ref: ARROW, quantity: 20 },
      { ref: BALL_BEARING, quantity: 1000 },
      { ref: CALTROP, quantity: 20 },
      { ref: SLING_BULLET, quantity: 20 },
      { ref: DART, quantity: 10 },
    ];
    const packed = packing(ammunition, { gold: 400, copper: 12 });
    const drifting = ammunition.reduce(
      (sum, entry) => sum + (catalog.get(entryKey(entry.ref)) ?? 0) * entry.quantity,
      0.02 * 412,
    );

    expect(carriedWeight(packed, catalog, new Map())).toBe(17.24);
    expect(drifting).not.toBe(17.24);
  });

  it("weighs a magic variant apart from the base item it expands", () => {
    const CHAIN_MAIL = { name: "Chain Mail", source: "PHB" };
    const BARDING = { name: "Barding", source: "PHB" };
    const weights = new Map([
      [itemKey({ ref: CHAIN_MAIL }), 55],
      [itemKey({ ref: CHAIN_MAIL, variant: BARDING }), 110],
    ]);
    const packed = packing([{ ref: CHAIN_MAIL }, { ref: CHAIN_MAIL, variant: BARDING }], {});
    expect(carriedWeight(packed, weights, new Map())).toBe(165);
  });

  it("counts every denomination the same, because every coin weighs the same", () => {
    const purse = { copper: 10, silver: 10, electrum: 10, gold: 10, platinum: 10 };
    expect(carriedWeight(packing([], purse), catalog, new Map())).toBe(1);
  });

  it("feeds the encumbrance thresholds a caller would otherwise invent a weight for", () => {
    const packed = packing([{ ref: ROPE, quantity: 5 }], {});
    const { encumbered } = encumbranceThresholds(packed.abilityScores.str, "medium");
    expect(carriedWeight(packed, catalog, new Map())).toBeGreaterThan(encumbered.atWeight);
  });
});

describe("encumbered speed", () => {
  /** A Strength of 8 at Medium: encumbered above 40 pounds, heavily above 80. */
  const ENCUMBERED_AT = 40;
  const HEAVILY_ENCUMBERED_AT = 80;

  const winged = { speed: { computed: { walk: 30, fly: 30, swim: 10 } } };

  const speeds = (
    weight: number,
    houseRules: object = { encumbrance: true },
    traits: object = winged,
  ) =>
    encumberedSpeed(
      characterDefinitionSchema.parse({ ...structuredClone(definition), houseRules }),
      characterDerivedSchema.parse(derivedInput(traits)),
      weight,
    );

  it("leaves the race's speeds alone where the table never opted in", () => {
    expect(speeds(HEAVILY_ENCUMBERED_AT * 10, {})).toEqual({
      speed: { walk: 30, fly: 30, swim: 10 },
      speedReduction: 0,
      disadvantage: false,
      reductionBreakdown: { total: 0, terms: [] },
    });
  });

  it("reduces every movement mode, not only walking", () => {
    expect(speeds(ENCUMBERED_AT + 1).speed).toEqual({ walk: 20, fly: 20, swim: 0 });
  });

  it("floors a mode at zero rather than moving the character backwards", () => {
    expect(speeds(HEAVILY_ENCUMBERED_AT + 1).speed).toEqual({ walk: 10, fly: 10, swim: 0 });
  });

  it.each([0, ENCUMBERED_AT])(
    "carries no penalty at %s pounds, the rule reading in excess of",
    (weight) => {
      expect(speeds(weight)).toEqual({
        speed: { walk: 30, fly: 30, swim: 10 },
        speedReduction: 0,
        disadvantage: false,
        reductionBreakdown: { total: 0, terms: [] },
      });
    },
  );

  it.each([ENCUMBERED_AT + 0.05, HEAVILY_ENCUMBERED_AT])(
    "loses 10 feet in excess of the lighter threshold, at %s pounds",
    (weight) => {
      expect(speeds(weight)).toEqual({
        speed: { walk: 20, fly: 20, swim: 0 },
        speedReduction: 10,
        disadvantage: false,
        reductionBreakdown: {
          total: 10,
          terms: [
            { label: "Encumbrance", value: 10, reference: { houseRuleOption: "encumbrance" } },
          ],
        },
      });
    },
  );

  it("surfaces the disadvantage the heavily encumbered state carries", () => {
    expect(speeds(HEAVILY_ENCUMBERED_AT + 0.05)).toEqual({
      speed: { walk: 10, fly: 10, swim: 0 },
      speedReduction: 20,
      disadvantage: true,
      reductionBreakdown: {
        total: 20,
        terms: [{ label: "Encumbrance", value: 20, reference: { houseRuleOption: "encumbrance" } }],
      },
    });
  });

  it("names the house rule behind a nonzero reduction rather than a bare number", () => {
    const laden = speeds(ENCUMBERED_AT + 1);
    expect(laden.reductionBreakdown.total).toBe(laden.speedReduction);
    expect(laden.reductionBreakdown.terms).toEqual([
      {
        label: "Encumbrance",
        value: laden.speedReduction,
        reference: { houseRuleOption: "encumbrance" },
      },
    ]);
  });

  it("reduces the speed a user typed over, not the one the race granted", () => {
    const typedOver = { speed: { computed: { walk: 30 }, manual: { walk: 40 } } };
    expect(speeds(HEAVILY_ENCUMBERED_AT + 1, { encumbrance: true }, typedOver).speed).toEqual({
      walk: 20,
    });
  });

  it("reads the size, which clamps a Tiny character's threshold to what it can carry", () => {
    const tiny = { size: { computed: "tiny" }, speed: { computed: { walk: 30 } } };
    const clamped = carryingCapacity(definition.abilityScores.str, "tiny");

    expect(clamped).toBe(60);
    expect(speeds(clamped, { encumbrance: true }, tiny).disadvantage).toBe(false);
    expect(speeds(clamped + 0.05, { encumbrance: true }, tiny)).toEqual({
      speed: { walk: 10 },
      speedReduction: 20,
      disadvantage: true,
      reductionBreakdown: {
        total: 20,
        terms: [{ label: "Encumbrance", value: 20, reference: { houseRuleOption: "encumbrance" } }],
      },
    });
  });

  /** What exhaustion costs a speed, in the terms `reducedSpeed` takes. */
  const exhaustionSpeedCost = (level: number, edition: Edition) => {
    const effects = exhaustionEffects(level, edition);
    return {
      reduction: effects.edition === "one" ? effects.speedReduction : 0,
      halved: effects.edition === "classic" && effects.speedHalved,
      zeroed: effects.edition === "classic" && effects.speedZero,
    };
  };

  it.each(["one", "classic"] as const)(
    "hands the reduction back unapplied, so %s exhaustion composes against the derived speed",
    (edition) => {
      const exhaustion = exhaustionSpeedCost(2, edition);
      const base = derivedValue(characterDerivedSchema.parse(derivedInput(winged)).speed).walk;
      const laden = speeds(ENCUMBERED_AT + 1);

      expect(laden.speedReduction).toBe(10);
      expect(laden.speed.walk).toBe(20);
      expect(
        reducedSpeed({
          ...exhaustion,
          base,
          reduction: laden.speedReduction + exhaustion.reduction,
        }),
      ).toBe(10);
    },
  );

  it.each([{ encumbrance: true }, {}])(
    "drops a mode written as undefined, which the parse keeps, under house rules %j",
    (houseRules) => {
      const absent = { speed: { computed: { walk: 30, fly: undefined } } };
      expect(Object.keys(speeds(ENCUMBERED_AT + 1, houseRules, absent).speed)).toEqual(["walk"]);
    },
  );

  it("stores nothing, so turning the option off restores the race's speeds", () => {
    const derived = characterDerivedSchema.parse(derivedInput(winged));
    const stored = characterDefinitionSchema.parse(structuredClone(definition));
    const laden = encumberedSpeed(stored, derived, HEAVILY_ENCUMBERED_AT + 1);

    expect(laden.speed).toEqual({ walk: 10, fly: 10, swim: 0 });
    expect(derivedValue(derived.speed)).toEqual({ walk: 30, fly: 30, swim: 10 });
    expect(speeds(HEAVILY_ENCUMBERED_AT + 1, {}).speed).toEqual({ walk: 30, fly: 30, swim: 10 });
  });
});
