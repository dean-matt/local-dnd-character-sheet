import type { SpellGrantor } from "@dnd/catalog";
import { describe, expect, it } from "vitest";
import {
  type PickedSpell,
  type PickGrantor,
  rowPicks,
  spellDeparture,
  spellsFilled,
  subclassPicks,
} from "./spellPicks.ts";

const pick = (name: string, level?: number, listed?: boolean): PickedSpell => ({
  ref: { name, source: "PHB" },
  name,
  ...(level !== undefined && { level }),
  ...(listed !== undefined && { listed }),
});

const NONE = { cantrips: 0, spells: 0 };

const offerOf = (
  grantor: SpellGrantor,
  cantrips: number,
  spells: number,
  { alternatives = false, learned = 0, name = "Magic Initiate" } = {},
) => ({
  row: { grantor, ref: { name, source: "PHB" }, level: 1 },
  picks: { cantrips, spells, learned, alternatives },
});

const madeFor = (spell: PickedSpell, name = "Magic Initiate"): PickedSpell => ({
  ...spell,
  pickedFor: { kind: "feat", ref: { name, source: "PHB" } } satisfies PickGrantor,
});

describe("spellDeparture", () => {
  const knower = { cantrips: 1, spells: 1, prepares: false, maxLevel: 1 };

  it("notes nothing while every pick holds", () => {
    const picked = [pick("Light", 0, true), pick("Shield", 1, true)];
    expect(spellDeparture(knower, picked, "Wizard", NONE, [])).toBe(undefined);
  });

  it("notes an overspend, a pick off the list and one no slot casts, in one note", () => {
    const picked = [
      pick("Light", 0, true),
      pick("Mage Hand", 0, true),
      pick("Shield", 1, true),
      pick("Cure Wounds", 1, false),
      pick("Fireball", 3, true),
    ];
    expect(spellDeparture(knower, picked, "Wizard", NONE, [])).toBe(
      "2 cantrips picked, where the class knows 1; 3 spells known, where the class allows 1; " +
        "Cure Wounds picked off the Wizard spell list; Fireball of a level no slot the class has can cast.",
    );
  });

  it("widens a count by the subclass's picks, and still notes a pick off the list", () => {
    const arcana = { cantrips: 2, spells: 0 };
    const fits = [pick("Light", 0, true), pick("Guidance", 0, true), pick("Mage Hand", 0, true)];
    expect(spellDeparture(knower, fits, "Wizard", arcana, [])).toBe(undefined);

    const past = [...fits, pick("Sacred Flame", 0, false)];
    expect(spellDeparture(knower, past, "Wizard", arcana, [])).toBe(
      "4 cantrips picked, where the class knows 1, and the subclass offers 2; " +
        "Sacred Flame picked off the Wizard spell list.",
    );
  });

  it("notes any pick for a class that casts nothing yet, past what its subclass offers", () => {
    expect(spellDeparture(undefined, [pick("Bless", 1)], "Paladin", NONE, [])).toBe(
      "Bless picked for a class that casts no spells at its level.",
    );
    const scion = { cantrips: 1, spells: 0 };
    expect(spellDeparture(undefined, [pick("Blade Ward", 0)], "Rogue", scion, [])).toBe(undefined);
    expect(
      spellDeparture(undefined, [pick("Blade Ward", 0), pick("Light", 0)], "Rogue", scion, []),
    ).toBe("Light picked for a class that casts no spells at its level.");
  });

  it("never overspends a count no table states", () => {
    const homebrew = { prepares: false, maxLevel: 9 };
    const picked = [pick("Light", 0), pick("Wish", 9)];
    expect(spellDeparture(homebrew, picked, "Homebrew", NONE, [])).toBe(undefined);
  });
});

describe("spellsFilled", () => {
  const facts = { cantrips: 1, spells: 2, prepares: true, maxLevel: 1 };
  const owing = (cantrips: number) => ({ cantrips, spells: 0, owed: { cantrips, spells: 0 } });

  it("asks for every count filled, an overspend counting", () => {
    expect(spellsFilled(facts, [pick("Light", 0), pick("Bless", 1)], owing(0), [])).toBe(false);
    const filled = [pick("Light", 0), pick("Bless", 1), pick("Shield", 1)];
    expect(spellsFilled(facts, filled, owing(0), [])).toBe(true);
    expect(spellsFilled(facts, [...filled, pick("Sleep", 1)], owing(0), [])).toBe(true);
  });

  it("asks for the picks the subclass owes as well as the class's", () => {
    const filled = [pick("Light", 0), pick("Bless", 1), pick("Shield", 1)];
    expect(spellsFilled(facts, filled, owing(1), [])).toBe(false);
    expect(spellsFilled(facts, [...filled, pick("Guidance", 0)], owing(1), [])).toBe(true);
  });

  it("finds a class that casts nothing, beside a subclass that owes nothing, filled", () => {
    expect(spellsFilled(undefined, [], owing(0), [])).toBe(true);
  });
});

describe("subclassPicks", () => {
  const offer = (
    grantor: string,
    cantrips: number,
    spells: number,
    { alternatives = false, learned = 0 } = {},
  ) => offerOf(grantor as SpellGrantor, cantrips, spells, { alternatives, learned });
  const states = { cantrips: false, spells: false };

  it("counts the subclass alone, owing none of its alternative blocks", () => {
    const offers = [
      offer("class", 9, 9),
      offer("race", 1, 0),
      offer("feat", 2, 1),
      offer("subclass", 1, 0, { alternatives: true }),
    ];
    expect(subclassPicks(offers, states, false)).toEqual({
      cantrips: 1,
      spells: 0,
      owed: { cantrips: 0, spells: 0 },
    });
  });

  it("counts a subclass's picks only where its own table states no count of that kind", () => {
    const arcana = [offer("subclass", 2, 0)];
    expect(subclassPicks(arcana, states, true).owed).toEqual({ cantrips: 2, spells: 0 });
    expect(subclassPicks(arcana, { cantrips: true, spells: true }, true).owed).toEqual({
      cantrips: 0,
      spells: 0,
    });
  });

  it("leaves out the spells a row has a preparer learn, as a 2024 Evoker's Savant picks", () => {
    const evoker = [offer("subclass", 0, 2, { learned: 2 })];
    expect(subclassPicks(evoker, states, true)).toEqual({
      cantrips: 0,
      spells: 0,
      owed: { cantrips: 0, spells: 0 },
    });
    expect(subclassPicks(evoker, states, false).owed.spells).toBe(2);
  });
});

describe("a row's own picks", () => {
  const knower = { cantrips: 1, spells: 1, prepares: false, maxLevel: 1 };
  const initiate = [offerOf("feat", 2, 1)];
  const classFilled = [pick("Fire Bolt", 0, true), pick("Shield", 1, true)];

  it("counts a row's picks apart from the class's, never widening its counts", () => {
    const rows = rowPicks(initiate, [...classFilled, madeFor(pick("Light", 0, true))]);
    expect(rows.map((row) => [row.counts, row.picked.map((spell) => spell.name)])).toEqual([
      [{ cantrips: 2, spells: 1 }, ["Light"]],
    ]);
    const picked = [...classFilled, pick("Mage Hand", 0, true)];
    expect(spellDeparture(knower, picked, "Wizard", NONE, rowPicks(initiate, picked))).toBe(
      "2 cantrips picked, where the class knows 1.",
    );
  });

  it("never excuses a class pick off the class's list for a spell a row offers", () => {
    const picked = [pick("Sacred Flame", 0, false), pick("Shield", 1, true)];
    expect(spellDeparture(knower, picked, "Wizard", NONE, rowPicks(initiate, picked))).toBe(
      "Sacred Flame picked off the Wizard spell list.",
    );
  });

  it("notes a row's pick past its count or outside its offer", () => {
    const picked = [
      ...classFilled,
      madeFor(pick("Light", 0, true)),
      madeFor(pick("Guidance", 0, true)),
      madeFor(pick("Druidcraft", 0, false)),
    ];
    expect(spellDeparture(knower, picked, "Wizard", NONE, rowPicks(initiate, picked))).toBe(
      "3 cantrips picked for Magic Initiate, where it offers 2; " +
        "Druidcraft picked outside what Magic Initiate offers.",
    );
  });

  it("notes a pick made for a row that offers none now", () => {
    const picked = [...classFilled, madeFor(pick("Light", 0, true), "Alert")];
    expect(spellDeparture(knower, picked, "Wizard", NONE, rowPicks(initiate, picked))).toBe(
      "Light picked for Alert, which offers none.",
    );
  });

  it("asks for a row's owed picks before the step is filled, and owes none of alternatives", () => {
    const owing = { cantrips: 0, spells: 0, owed: NONE };
    const some = [...classFilled, madeFor(pick("Light", 0)), madeFor(pick("Guidance", 0))];
    expect(spellsFilled(knower, some, owing, rowPicks(initiate, some))).toBe(false);
    const all = [...some, madeFor(pick("Bless", 1))];
    expect(spellsFilled(knower, all, owing, rowPicks(initiate, all))).toBe(true);

    const alternatives = [offerOf("feat", 2, 1, { alternatives: true })];
    const [row] = rowPicks(alternatives, classFilled);
    expect(row?.owed).toEqual(NONE);
    expect(spellsFilled(knower, classFilled, owing, rowPicks(alternatives, classFilled))).toBe(
      true,
    );
  });

  it("leaves the class and subclass out of the rows", () => {
    const offers = [offerOf("class", 1, 1), offerOf("subclass", 1, 0), offerOf("race", 0, 0)];
    expect(rowPicks(offers, [])).toEqual([]);
  });
});
