import {
  abilityGrantSchema,
  appliedItemFieldsSchema,
  armorTraitSchema,
  defenseTraitSchema,
  entriesSchema,
  itemBonusSchema,
  spellCastingFactsSchema,
  weaponTraitSchema,
} from "@dnd/catalog";
import { describe, expect, it } from "vitest";
import { ITEM_STARTERS, SPELL_STARTERS } from "../../lib/homebrewStarters.ts";
import { checkHomebrewEntry } from "./homebrewDraft.ts";
import { EDITING_KINDS } from "./homebrewKinds.ts";

const starter = (label: string) => {
  const found = [...ITEM_STARTERS, ...SPELL_STARTERS].find((each) => each.label === label);
  if (!found) throw new Error(`no ${label} starter`);
  return found.entry;
};

describe("homebrew starters", () => {
  it.each(
    Object.values(EDITING_KINDS).flatMap((kind) =>
      kind.starters.map(({ label, entry }) => ({ kind, label, entry })),
    ),
  )("saves the $label example as it opens", ({ kind, entry }) => {
    expect(checkHomebrewEntry(entry, "one", kind.inputSchema)).toHaveProperty("input");
  });

  it("gives the weapon an attack the sheet reads, bonus and versatile die included", () => {
    expect(weaponTraitSchema.parse(starter("Weapon"))).toMatchObject({
      category: "martial",
      damage: { dice: "1d8", type: "slashing" },
      baseName: "longsword",
      versatileDamage: "1d10",
      bonus: { attack: 1, damage: 1 },
    });
  });

  it("gives the armor an armor class and a defense of each sort", () => {
    const armor = starter("Armor");
    expect(armorTraitSchema.parse(armor)).toEqual({ category: "medium", armorClass: 15 });
    expect(defenseTraitSchema.parse(armor)).toMatchObject({
      resist: ["cold"],
      immune: ["fire"],
      conditionImmune: ["frightened"],
    });
  });

  it("shows only fields the sheet applies, beside a name and rules text", () => {
    const applied = new Set([...Object.keys(appliedItemFieldsSchema.shape), "name", "entries"]);
    const shown = ITEM_STARTERS.flatMap(({ entry }) => Object.keys(entry));
    expect(shown.filter((key) => !applied.has(key))).toEqual([]);
  });

  it("prices the gear under 1 gp, in copper", () => {
    expect(starter("Gear").value).toBe(50);
  });

  it("gives the wondrous item a score, every bonus, a speed, a critical range and a vulnerability", () => {
    const circlet = starter("Wondrous item");
    expect(abilityGrantSchema.parse(circlet)).toEqual({ static: {}, bonus: { wis: 1 } });
    expect(itemBonusSchema.parse(circlet)).toEqual({
      ac: 0,
      save: 1,
      concentration: 2,
      spellAttack: 1,
      spellSaveDc: 1,
      spellDamage: 1,
      abilityCheck: 1,
      proficiencyBonus: 1,
      grantsProficiency: false,
      grantsLanguage: false,
      critThreshold: 19,
      speed: { static: { fly: 30 } },
    });
    expect(defenseTraitSchema.parse(circlet)).toMatchObject({ vulnerable: ["thunder"] });
  });

  it("gives the spell every casting fact and its upcast text in the shape the sheet reads", () => {
    const { time, range, components, duration, entriesHigherLevel } = starter("Spell");
    expect(() =>
      spellCastingFactsSchema.parse({ time, range, components, duration }),
    ).not.toThrow();
    expect(entriesSchema.safeParse(entriesHigherLevel).success).toBe(true);
  });
});
