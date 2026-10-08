import { describe, expect, it } from "vitest";
import {
  casterFacts,
  otherPicks,
  type PickedSpell,
  spellDeparture,
  spellsFilled,
} from "./spellPicks.ts";

const table = (resources: Record<string, string>, slots: number[] = []) => ({
  resources: Object.entries(resources).map(([resourceKey, value]) => ({ resourceKey, value })),
  spellSlots: slots.map((count, index) => ({ slotLevel: index + 1, slots: count })),
});

const pick = (name: string, level?: number, listed?: boolean): PickedSpell => ({
  ref: { name, source: "PHB" },
  name,
  ...(level !== undefined && { level }),
  ...(listed !== undefined && { listed }),
});

describe("casterFacts", () => {
  it("reads a 2024 caster's printed Prepared Spells column as preparing", () => {
    expect(casterFacts([table({ cantrips_known: "3", prepared_spells: "4" }, [2])])).toEqual({
      cantrips: 3,
      spells: 4,
      prepares: true,
      maxLevel: 1,
    });
  });

  it("counts a 2014 preparer's list from its formula, and a 2014 knower's from its column", () => {
    const wizard = table({ cantrips_known: "3" }, [4, 2]);
    expect(casterFacts([wizard], { rule: "level", modifier: 3, level: 3 })).toEqual({
      cantrips: 3,
      spells: 6,
      prepares: true,
      maxLevel: 2,
    });
    expect(casterFacts([table({ cantrips_known: "4", spells_known: "2" }, [2])])).toEqual({
      cantrips: 4,
      spells: 2,
      prepares: false,
      maxLevel: 1,
    });
  });

  it("reads a subclass's table where the class's states nothing, as an Eldritch Knight's", () => {
    const fighter = table({});
    const knight = table({ cantrips_known: "2", spells_known: "3" }, [2]);
    expect(casterFacts([fighter, knight])).toMatchObject({ cantrips: 2, spells: 3, maxLevel: 1 });
  });

  it("finds no caster where the level grants neither a cantrip nor a slot", () => {
    expect(casterFacts([table({})], { rule: "half-level", modifier: 3, level: 1 })).toBeUndefined();
  });
});

const NONE = { cantrips: 0, spells: 0 };

describe("spellDeparture", () => {
  const knower = { cantrips: 1, spells: 1, prepares: false, maxLevel: 1 };
  const offered = (name: string, level: number) => ({
    ...pick(name, level, false),
    offered: true,
  });

  it("notes nothing while every pick holds", () => {
    const picked = [pick("Light", 0, true), pick("Shield", 1, true)];
    expect(spellDeparture(knower, picked, "Wizard", NONE)).toBe(undefined);
  });

  it("notes an overspend, a pick off the list and one no slot casts, in one note", () => {
    const picked = [
      pick("Light", 0, true),
      pick("Mage Hand", 0, true),
      pick("Shield", 1, true),
      pick("Cure Wounds", 1, false),
      pick("Fireball", 3, true),
    ];
    expect(spellDeparture(knower, picked, "Wizard", NONE)).toBe(
      "2 cantrips picked, where the class knows 1; 3 spells known, where the class allows 1; " +
        "Cure Wounds picked off the Wizard spell list; Fireball of a level no slot the class has can cast.",
    );
  });

  it("excuses as many picks another row offers as it leaves room for, and no more", () => {
    const others = { cantrips: 2, spells: 1 };
    const fits = [
      pick("Light", 0, true),
      offered("Guidance", 0),
      offered("Sacred Flame", 0),
      offered("Bless", 1),
    ];
    expect(spellDeparture(knower, fits, "Wizard", others)).toBe(undefined);

    const past = [...fits, offered("Thaumaturgy", 0)];
    expect(spellDeparture(knower, past, "Wizard", others)).toBe(
      "4 cantrips picked, where the class knows 1, and other rows offer 2; " +
        "Thaumaturgy picked off the Wizard spell list.",
    );
  });

  it("notes any pick for a class that casts nothing yet, past what other rows offer", () => {
    expect(spellDeparture(undefined, [pick("Bless", 1)], "Paladin", NONE)).toBe(
      "Bless picked for a class that casts no spells at its level.",
    );
    expect(
      spellDeparture(undefined, [offered("Light", 0)], "Fighter", { cantrips: 1, spells: 0 }),
    ).toBe(undefined);
  });

  it("never overspends a count no table states", () => {
    const homebrew = { prepares: false, maxLevel: 9 };
    const picked = [pick("Light", 0), pick("Wish", 9)];
    expect(spellDeparture(homebrew, picked, "Homebrew", NONE)).toBe(undefined);
  });
});

describe("spellsFilled", () => {
  const facts = { cantrips: 1, spells: 2, prepares: true, maxLevel: 1 };
  const owing = (cantrips: number) => ({ cantrips, spells: 0, owed: { cantrips, spells: 0 } });

  it("asks for every count filled, an overspend counting", () => {
    expect(spellsFilled(facts, [pick("Light", 0), pick("Bless", 1)], owing(0))).toBe(false);
    const filled = [pick("Light", 0), pick("Bless", 1), pick("Shield", 1)];
    expect(spellsFilled(facts, filled, owing(0))).toBe(true);
    expect(spellsFilled(facts, [...filled, pick("Sleep", 1)], owing(0))).toBe(true);
  });

  it("asks for the picks other rows owe as well as the class's", () => {
    const filled = [pick("Light", 0), pick("Bless", 1), pick("Shield", 1)];
    expect(spellsFilled(facts, filled, owing(1))).toBe(false);
    expect(spellsFilled(facts, [...filled, pick("Guidance", 0)], owing(1))).toBe(true);
  });

  it("finds a class that casts nothing, beside rows that owe nothing, filled", () => {
    expect(spellsFilled(undefined, [], owing(0))).toBe(true);
  });
});

describe("otherPicks", () => {
  const offer = (grantor: string, cantrips: number, spells: number, alternatives = false) => ({
    grantor,
    picks: { cantrips, spells, alternatives },
  });
  const states = { cantrips: false, spells: false };

  it("sums every row but the class, owing only the rows with one block", () => {
    const offers = [offer("class", 9, 9), offer("race", 1, 0), offer("feat", 2, 1, true)];
    expect(otherPicks(offers, states)).toEqual({
      cantrips: 3,
      spells: 1,
      owed: { cantrips: 1, spells: 0 },
    });
  });

  it("counts a subclass's picks only where its own table states no count of that kind", () => {
    const arcana = [offer("subclass", 2, 0)];
    expect(otherPicks(arcana, states).owed).toEqual({ cantrips: 2, spells: 0 });
    expect(otherPicks(arcana, { cantrips: true, spells: true }).owed).toEqual({
      cantrips: 0,
      spells: 0,
    });
  });
});
