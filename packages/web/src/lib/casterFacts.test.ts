import { describe, expect, it } from "vitest";
import { casterFacts } from "./casterFacts.ts";

const table = (resources: Record<string, string>, slots: number[] = []) => ({
  resources: Object.entries(resources).map(([resourceKey, value]) => ({ resourceKey, value })),
  spellSlots: slots.map((count, index) => ({ slotLevel: index + 1, slots: count })),
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
