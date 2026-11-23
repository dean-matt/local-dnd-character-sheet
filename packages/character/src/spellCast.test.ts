import { describe, expect, it } from "vitest";
import {
  defaultCharacterState,
  spellBeams,
  spellCast,
  spellCastOptions,
  spellDamageDice,
  spellUses,
} from "./index.ts";

const total = (computed: number, manual: number | null = null) => ({ computed, manual, terms: [] });

const sheet = {
  hitDice: [],
  spellSlots: [
    { level: 1, total: total(4) },
    { level: 2, total: total(3) },
    { level: 3, total: total(2, 0) },
  ],
  pactSlots: { level: 2, total: total(2) },
  classResources: [],
};

const state = {
  ...defaultCharacterState(),
  spellSlots: [{ level: 2, total: 3, expended: 3 }],
};

const BLESS = { name: "Bless", source: "XPHB" };
const HEX = { name: "Hex", source: "XPHB" };

describe("spellCastOptions", () => {
  it("offers each slot level from the spell's own up, counting what is left", () => {
    expect(
      spellCastOptions({ level: 2, ritual: false }, { ...sheet, pactSlots: null }, state),
    ).toEqual([{ via: "slot", level: 2, left: 0 }]);
    expect(
      spellCastOptions({ level: 1, ritual: false }, { ...sheet, pactSlots: null }, state),
    ).toEqual([
      { via: "slot", level: 1, left: 4 },
      { via: "slot", level: 2, left: 0 },
    ]);
  });

  it("offers a cantrip at 0 with no slot", () => {
    expect(spellCastOptions({ level: 0, ritual: false }, sheet, state)).toEqual([
      { via: "cantrip", level: 0, left: null },
    ]);
  });

  it("offers a ritual cast at the spell's own level beside its slots", () => {
    expect(
      spellCastOptions({ level: 3, ritual: true }, { ...sheet, pactSlots: null }, state),
    ).toEqual([{ via: "ritual", level: 3, left: null }]);
  });

  it("offers the pact slot at its own level for a spell of that level or lower", () => {
    const pact = { ...sheet, spellSlots: [] };
    expect(spellCastOptions({ level: 1, ritual: false }, pact, state)).toEqual([
      { via: "pact", level: 2, left: 2 },
    ]);
    expect(spellCastOptions({ level: 2, ritual: false }, pact, state)).toHaveLength(1);
    expect(spellCastOptions({ level: 3, ritual: false }, pact, state)).toEqual([]);
  });
});

const MONK = { name: "Monk", source: "PHB" };
const ki = (maximum: number | null, expended: number) => ({
  derived: {
    ...sheet,
    spellSlots: [],
    pactSlots: null,
    classResources: [
      { class: MONK, key: "ki_points", maximum: maximum === null ? null : total(maximum) },
    ],
  },
  state: {
    ...defaultCharacterState(),
    classResources: [{ class: MONK, key: "ki_points", maximum, expended }],
  },
});
const DARKNESS = { level: 2, ritual: false, cost: { amount: 2, resource: "Ki" } };

describe("a spell a feature casts for a pool", () => {
  it("offers the pool's cast at the spell's own level, with the points left", () => {
    const held = ki(5, 1);
    expect(spellCastOptions(DARKNESS, held.derived, held.state)).toEqual([
      { via: "pool", level: 2, left: 4, pool: { class: MONK, key: "ki_points", amount: 2 } },
    ]);
  });

  it("names the pool by its singular or plural, bare or with Points", () => {
    for (const resource of ["Ki", "Ki Points", "ki point"]) {
      const held = ki(5, 0);
      const options = spellCastOptions(
        { ...DARKNESS, cost: { amount: 2, resource } },
        held.derived,
        held.state,
      );
      expect(options.map(({ via }) => via)).toEqual(["pool"]);
    }
  });

  it("names the sorcery and focus pools by their own keys", () => {
    for (const [resource, key] of [
      ["Sorcery Point", "sorcery_points"],
      ["Focus Points", "focus_points"],
    ] as const) {
      const held = ki(5, 1);
      const pool = { ...(held.derived.classResources[0] as object), key };
      const options = spellCastOptions(
        { ...DARKNESS, cost: { amount: 2, resource } },
        { ...held.derived, classResources: [pool as never] },
        { ...held.state, classResources: [{ ...held.state.classResources[0], key } as never] },
      );
      expect(options).toEqual([
        { via: "pool", level: 2, left: 4, pool: { class: MONK, key, amount: 2 } },
      ]);
    }
  });

  it("lists the pool's cast before the slots and the ritual cast", () => {
    const held = ki(5, 0);
    const options = spellCastOptions(
      { level: 2, ritual: true, cost: DARKNESS.cost },
      { ...sheet, pactSlots: null, classResources: held.derived.classResources },
      { ...state, classResources: held.state.classResources },
    );
    expect(options.map(({ via }) => via)).toEqual(["pool", "slot", "ritual"]);
  });

  it("offers none where the sheet counts no such pool", () => {
    expect(
      spellCastOptions(
        { level: 2, ritual: false, cost: { amount: 1, resource: "Sorcery Point" } },
        ki(5, 0).derived,
        ki(5, 0).state,
      ),
    ).toEqual([]);
  });

  it("spends the cost from the pool and no slot", () => {
    const held = ki(5, 1);
    const [option] = spellCastOptions(DARKNESS, held.derived, held.state);
    const cast = spellCast(held.derived, held.state, {
      spell: { name: "Darkness", source: "PHB" },
      option: option as NonNullable<typeof option>,
      spend: true,
      concentrate: false,
    });
    expect(cast.state.classResources).toEqual([
      { class: MONK, key: "ki_points", maximum: 5, expended: 3 },
    ]);
  });

  it("refuses a cast the pool cannot pay for", () => {
    const held = ki(5, 4);
    const [option] = spellCastOptions(DARKNESS, held.derived, held.state);
    expect(() =>
      spellCast(held.derived, held.state, {
        spell: { name: "Darkness", source: "PHB" },
        option: option as NonNullable<typeof option>,
        spend: true,
        concentrate: false,
      }),
    ).toThrow(RangeError);
  });
});

const FAERIE_FIRE = {
  level: 1,
  ritual: false,
  uses: { key: "spell|race|PHB|Drow|Faerie Fire", count: 1 },
};

describe("a spell a feature casts by spending a use", () => {
  const spent = (expended: number) => ({
    ...defaultCharacterState(),
    featureUses: [{ key: FAERIE_FIRE.uses.key, expended }],
  });
  const cast = (from: ReturnType<typeof spent>) => {
    const [option] = spellCastOptions(FAERIE_FIRE, sheet, from);
    return spellCast(sheet, from, {
      spell: { name: "Faerie Fire", source: "PHB" },
      option: option as NonNullable<typeof option>,
      spend: true,
      concentrate: false,
    });
  };

  it("lists the use's cast first, with the uses left", () => {
    expect(spellCastOptions(FAERIE_FIRE, sheet, spent(0))[0]).toEqual({
      via: "use",
      level: 1,
      left: 1,
      use: { ...FAERIE_FIRE.uses, left: 1 },
    });
    expect(spellCastOptions(FAERIE_FIRE, sheet, spent(1))[0]?.left).toBe(0);
  });

  it("spends the use and no slot", () => {
    const after = cast(spent(0)).state;
    expect(after.featureUses).toEqual([{ key: FAERIE_FIRE.uses.key, expended: 1 }]);
    expect(after.spellSlots).toEqual([]);
  });

  it("refuses a cast with no use left", () => {
    expect(() => cast(spent(1))).toThrow(RangeError);
  });
});

describe("a spell a feature casts with the pact slot, once", () => {
  const uses = { key: "optionalFeature|PHB|Sign of Ill Omen", count: 1, slot: true as const };
  const bane = { level: 1, ritual: false, uses };
  const held = (expended: number) => ({
    ...defaultCharacterState(),
    featureUses: [{ key: uses.key, expended }],
  });

  it("offers the pact slot cast carrying the use, after the plain casts of a spell picked", () => {
    const options = spellCastOptions(bane, sheet, held(0));
    expect(options.map(({ via, use }) => [via, use?.left])).toEqual([
      ["slot", undefined],
      ["slot", undefined],
      ["pact", undefined],
      ["pact", 1],
    ]);
  });

  it("offers only the pact slot cast carrying the use for a spell it grants", () => {
    const options = spellCastOptions({ ...bane, granted: true }, sheet, held(0));
    expect(options.map(({ via }) => via)).toEqual(["pact"]);
  });

  it("spends the pact slot and the use together", () => {
    const [option] = spellCastOptions({ ...bane, granted: true }, sheet, held(0));
    const after = spellCast(sheet, held(0), {
      spell: { name: "Bane", source: "PHB" },
      option: option as NonNullable<typeof option>,
      spend: true,
      concentrate: false,
    }).state;
    expect(after.pactSlots).toEqual({ level: 2, total: 2, expended: 1 });
    expect(after.featureUses).toEqual([{ key: uses.key, expended: 1 }]);
  });
});

describe("spellUses", () => {
  const arcanum = { name: "Mystic Arcanum (6th level)", source: "PHB" };
  const limited = {
    limitedUses: [
      {
        feature: arcanum,
        origin: "class" as const,
        level: 11,
        key: "feature|Warlock|PHB|||11|PHB|Mystic Arcanum (6th level)",
        count: 1,
        reset: "long" as const,
      },
    ],
  };

  it("takes the uses a grantor gives the spell", () => {
    const uses = { key: "k", count: 2 };
    expect(spellUses({ uses }, limited)).toBe(uses);
  });

  it("takes the uses of the class feature a spell was picked for", () => {
    expect(spellUses({ pickedFor: { kind: "classFeature", ref: arcanum } }, limited)).toEqual({
      key: limited.limitedUses[0]?.key,
      count: 1,
    });
  });

  it("finds none for a feature that counts none, or a pick made for a race", () => {
    const magical = { name: "Magical Secrets", source: "PHB" };
    expect(
      spellUses({ pickedFor: { kind: "classFeature", ref: magical } }, limited),
    ).toBeUndefined();
    expect(spellUses({ pickedFor: { kind: "race", ref: arcanum } }, limited)).toBeUndefined();
  });
});

describe("spellCast", () => {
  it("spends the chosen slot and nothing else", () => {
    const option = { via: "slot" as const, level: 1, left: 4 };
    const cast = spellCast(sheet, state, { spell: BLESS, option, spend: true, concentrate: false });
    expect(cast.state).toEqual({
      ...state,
      spellSlots: [
        { level: 1, total: 4, expended: 1 },
        { level: 2, total: 3, expended: 3 },
      ],
    });
    expect(cast.ended).toBeNull();
  });

  it("spends a pact slot", () => {
    const option = { via: "pact" as const, level: 2, left: 2 };
    const cast = spellCast(sheet, state, { spell: HEX, option, spend: true, concentrate: false });
    expect(cast.state.pactSlots).toEqual({ level: 2, total: 2, expended: 1 });
    expect(cast.state.spellSlots).toEqual(state.spellSlots);
  });

  it("spends no slot for a ritual or a cantrip", () => {
    for (const via of ["ritual", "cantrip"] as const) {
      const option = { via, level: 1, left: null };
      const cast = spellCast(sheet, state, {
        spell: BLESS,
        option,
        spend: true,
        concentrate: false,
      });
      expect(cast.state).toEqual(state);
    }
  });

  it("refuses a spend with no slot left", () => {
    const option = { via: "slot" as const, level: 2, left: 0 };
    expect(() =>
      spellCast(sheet, state, { spell: BLESS, option, spend: true, concentrate: false }),
    ).toThrow(RangeError);
  });

  it("concentrates at the cast's level, naming what it ended, in the same state", () => {
    const held = { ...state, concentration: { spell: HEX, level: 1 } };
    const option = { via: "slot" as const, level: 1, left: 4 };
    const cast = spellCast(sheet, held, { spell: BLESS, option, spend: true, concentrate: true });
    expect(cast.state.concentration).toEqual({ spell: BLESS, level: 1 });
    expect(cast.state.spellSlots[0]).toEqual({ level: 1, total: 4, expended: 1 });
    expect(cast.ended).toEqual({ spell: HEX, level: 1 });
  });

  it("records the encounter round a concentration spell was cast in", () => {
    const running = { ...state, encounter: { round: 3, initiative: null } };
    const option = { via: "slot" as const, level: 2, left: 0 };
    const cast = spellCast(sheet, running, {
      spell: BLESS,
      option,
      spend: false,
      concentrate: true,
    });
    expect(cast.state.concentration).toEqual({ spell: BLESS, level: 2, round: 3 });
  });

  it("leaves the slot alone where the spend is switched off", () => {
    const option = { via: "slot" as const, level: 2, left: 0 };
    const cast = spellCast(sheet, state, { spell: BLESS, option, spend: false, concentrate: true });
    expect(cast.state).toEqual({ ...state, concentration: { spell: BLESS, level: 2 } });
  });
});

describe("spellBeams", () => {
  const blast = {
    level: 0,
    beamTiers: [
      { level: 5, count: 2 },
      { level: 11, count: 3 },
    ],
  };

  it("counts the beams at the character's level", () => {
    expect(spellBeams(blast, 4)).toBeUndefined();
    expect(spellBeams(blast, 5)).toBe(2);
    expect(spellBeams(blast, 20)).toBe(3);
  });
});

describe("spellDamageDice", () => {
  const bolt = {
    level: 0,
    damageDice: "1d10",
    damageTiers: [
      { level: 1, dice: "1d10" },
      { level: 5, dice: "2d10" },
      { level: 11, dice: "3d10" },
    ],
  };
  const fireball = { level: 3, damageDice: "8d6", damageUpcast: "1d6" };

  it("rolls a cantrip's tier at the character's level", () => {
    expect(spellDamageDice(bolt, 0, 4)).toBe("1d10");
    expect(spellDamageDice(bolt, 0, 5)).toBe("2d10");
    expect(spellDamageDice(bolt, 0, 20)).toBe("3d10");
  });

  it("adds the upcast step once per slot level above the spell's", () => {
    expect(spellDamageDice(fireball, 3, 9)).toBe("8d6");
    expect(spellDamageDice(fireball, 5, 9)).toBe("10d6");
    expect(spellDamageDice({ ...fireball, damageUpcast: "1d8" }, 4, 9)).toBe("8d6+1d8");
  });

  it("rolls the printed dice where nothing scales, and nothing where none print", () => {
    expect(spellDamageDice({ level: 1, damageDice: "1d4 + 1" }, 3, 9)).toBe("1d4 + 1");
    expect(spellDamageDice({ level: 1 }, 3, 9)).toBeUndefined();
  });
});
