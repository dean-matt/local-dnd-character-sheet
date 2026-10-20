import { describe, expect, it } from "vitest";
import { spellsGained, subclassSpellsGained } from "./spellsGained.ts";

const table = (resources: Record<string, string>, slots: number[] = []) => ({
  resources: Object.entries(resources).map(([resourceKey, value]) => ({ resourceKey, value })),
  spellSlots: slots.map((count, index) => ({ slotLevel: index + 1, slots: count })),
});

describe("spellsGained", () => {
  it("counts what the class's known columns grew by, and the highest slot after", () => {
    const before = table({ cantrips_known: "4", spells_known: "4" }, [4, 2]);
    const after = table({ cantrips_known: "5", spells_known: "5" }, [4, 3, 0]);
    expect(spellsGained([before], [after])).toEqual({ cantrips: 1, spells: 1, maxLevel: 2 });
  });

  it("counts every spell known where the level enters the class or picks the subclass", () => {
    const fighter = table({});
    const knight = table({ cantrips_known: "2", spells_known: "3" }, [2]);
    expect(spellsGained([fighter, undefined], [fighter, knight])).toEqual({
      cantrips: 2,
      spells: 3,
      maxLevel: 1,
    });
  });

  it("gives a class that prepares its spells no spell to pick, though a cantrip still counts", () => {
    const before = table({ cantrips_known: "3", prepared_spells: "6" }, [4, 3]);
    const after = table({ cantrips_known: "4", prepared_spells: "7" }, [4, 3]);
    expect(spellsGained([before], [after])).toEqual({ cantrips: 1, spells: 0, maxLevel: 2 });
  });

  it("reads a cell that is not a count as none", () => {
    expect(spellsGained([], [table({ spells_known: "—" })])).toEqual({
      cantrips: 0,
      spells: 0,
      maxLevel: 0,
    });
  });

  it("gives a spellbook class two spells a level, prepared or not, at levels whose slots cast", () => {
    const before = table({ cantrips_known: "3", prepared_spells: "6" }, [4, 3]);
    const after = table({ cantrips_known: "3", prepared_spells: "7" }, [4, 3, 2]);
    expect(spellsGained([before], [after], true)).toEqual({ cantrips: 0, spells: 2, maxLevel: 3 });
    expect(spellsGained([table({}, [2])], [table({ cantrips_known: "3" }, [3])], true).spells).toBe(
      2,
    );
    expect(spellsGained([], [table({})], true).spells).toBe(0);
  });
});

describe("subclassSpellsGained", () => {
  const choose = (filter: string, count = 1) =>
    Array.from({ length: count }, () => ({ choose: filter }));
  const lore = { additionalSpells: [{ known: { "6": choose("level=0;1;2;3", 2) } }] };
  const arcana = { additionalSpells: [{ known: { "1": choose("level=0|class=Wizard", 2) } }] };
  const none = { after: [], subclass: undefined };

  it("counts the picks a level reaches, and none before it", () => {
    expect(subclassSpellsGained(lore, true, 5, 6, none)).toEqual({ cantrips: 0, spells: 2 });
    expect(subclassSpellsGained(lore, true, 6, 7, none)).toEqual({ cantrips: 0, spells: 0 });
    expect(subclassSpellsGained(lore, true, 4, 5, none)).toEqual({ cantrips: 0, spells: 0 });
  });

  it("counts a cantrip filter as cantrips, and every pick when the level picks the subclass", () => {
    expect(subclassSpellsGained(arcana, false, 0, 1, none)).toEqual({ cantrips: 2, spells: 0 });
    expect(subclassSpellsGained(lore, false, 6, 7, none)).toEqual({ cantrips: 0, spells: 2 });
  });

  it("leaves a kind the subclass's own table counts to the table", () => {
    const table = { resources: [{ resourceKey: "cantrips_known", value: "2" }], spellSlots: [] };
    expect(subclassSpellsGained(arcana, false, 0, 1, { after: [], subclass: table })).toEqual({
      cantrips: 0,
      spells: 0,
    });
  });

  it("leaves out the spells a spellbook class learns, and a subclass's alternative blocks", () => {
    const savant = { additionalSpells: [{ known: { "3": choose("level=1;2", 2) } }] };
    expect(subclassSpellsGained(savant, false, 2, 3, none)).toEqual({ cantrips: 0, spells: 2 });
    expect(subclassSpellsGained(savant, false, 2, 3, none, true)).toEqual({
      cantrips: 0,
      spells: 0,
    });
    const blocks = { additionalSpells: [lore.additionalSpells[0], lore.additionalSpells[0]] };
    expect(subclassSpellsGained(blocks, false, 5, 6, none)).toEqual({ cantrips: 0, spells: 0 });
  });
});
