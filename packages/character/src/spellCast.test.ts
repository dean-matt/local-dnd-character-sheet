import { describe, expect, it } from "vitest";
import {
  defaultCharacterState,
  spellBeams,
  spellCast,
  spellCastOptions,
  spellDamageDice,
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
