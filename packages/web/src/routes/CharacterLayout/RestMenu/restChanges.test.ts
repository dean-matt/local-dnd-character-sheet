import type {
  CharacterFeatures,
  CharacterInventory,
  CharacterSpells,
  ItemRegains,
  LimitedUses,
} from "@dnd/catalog";
import type { USES_PARTS, USES_RESTORED_BY } from "@dnd/character";
import { describe, expect, expectTypeOf, it } from "vitest";
import { chargedItems, featureUses, rechargeOf } from "./restChanges.ts";

const item = (regains: ItemRegains) => ({ id: "wand", name: "Wand", max: 7, regains });

describe("rechargeOf", () => {
  it("returns a fixed count as printed", () => {
    expect(rechargeOf(item({ kind: "fixed", count: 3 }))).toMatchObject({ regained: 3 });
  });

  it("returns every charge where the amount is not printed", () => {
    expect(rechargeOf(item({ kind: "all" }))).toMatchObject({ regained: 7 });
  });

  it("returns every charge where the notation does not parse, with no roll", () => {
    const rolled = rechargeOf(item({ kind: "roll", notation: "not dice" }));
    expect(rolled.regained).toBe(7);
    expect(rolled.roll).toBeUndefined();
  });

  it("returns none where the roll totals below 1, and still logs it", () => {
    const rolled = rechargeOf(item({ kind: "roll", notation: "1d1 - 3" }));
    expect(rolled.regained).toBe(0);
    expect(rolled.roll).toMatchObject({ label: "Wand recharge", total: -2 });
  });
});

describe("chargedItems", () => {
  const charges = (recharge: string | null) => ({
    max: 7,
    printedMax: 7,
    recharge,
    regains: { kind: "all" },
  });
  const inventory = (items: object[]) => ({ items }) as unknown as CharacterInventory;

  it("keeps only a resolved entry with an id and a long-rest recharge", () => {
    const listed = chargedItems(
      inventory([
        { resolved: true, id: "a", name: "Kept", charges: charges("dawn") },
        { resolved: true, name: "No id", charges: charges("dawn") },
        { resolved: false, id: "b", name: "Unresolved", charges: charges("dawn") },
        { resolved: true, id: "c", name: "No charges", charges: null },
        { resolved: true, id: "d", name: "Special", charges: charges("special") },
      ]),
    );
    expect(listed.map(({ id }) => id)).toEqual(["a"]);
  });
});

describe("featureUses", () => {
  it("lists a feature's main use and each other use under its own key", () => {
    const use = (key: string) => ({ key, count: 1, reset: "long" as const });
    const features = {
      groups: [
        {
          features: [
            {
              resolved: true,
              name: "Manifest Mind",
              uses: use("a"),
              otherUses: [{ ...use("a|conjuring"), part: "conjuring" }],
            },
            { resolved: false, name: "Unresolved", uses: use("b") },
          ],
        },
      ],
    } as unknown as CharacterFeatures;
    expect(featureUses(features, { spells: [] }).map(({ key, name }) => [key, name])).toEqual([
      ["a", "Manifest Mind"],
      ["a|conjuring", "Manifest Mind"],
    ]);
  });

  it("lists a spell a grantor lets the character cast a limited number of times", () => {
    const spells = {
      spells: [
        { resolved: false, name: "Faerie Fire", prepared: true },
        {
          resolved: false,
          name: "Darkness",
          prepared: true,
          uses: { key: "spell|race|PHB|Drow|Darkness", count: 1, reset: "long" },
        },
      ],
    } as unknown as CharacterSpells;
    expect(featureUses({ groups: [] }, spells)).toEqual([
      { name: "Darkness", key: "spell|race|PHB|Drow|Darkness", count: 1, reset: "long" },
    ]);
  });
});

describe("the catalog's limited uses", () => {
  it("carries the character package's restoredBy and part vocabularies", () => {
    expectTypeOf<NonNullable<LimitedUses["restoredBy"]>>().toEqualTypeOf<
      (typeof USES_RESTORED_BY)[number]
    >();
    expectTypeOf<NonNullable<LimitedUses["part"]>>().toEqualTypeOf<(typeof USES_PARTS)[number]>();
  });
});
