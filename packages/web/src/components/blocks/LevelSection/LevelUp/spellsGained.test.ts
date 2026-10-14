import { describe, expect, it } from "vitest";
import { spellsGained } from "./spellsGained.ts";

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
});
