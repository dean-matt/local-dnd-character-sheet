import {
  armorTraitSchema,
  defenseTraitSchema,
  entriesSchema,
  spellCastingFactsSchema,
  weaponTraitSchema,
} from "@dnd/catalog";
import { describe, expect, it } from "vitest";
import { checkHomebrewEntry } from "./homebrewDraft.ts";
import { HOMEBREW_KINDS } from "./homebrewKinds.ts";
import { ITEM_STARTERS, SPELL_STARTERS } from "./homebrewStarters.ts";

const starter = (label: string) => {
  const found = [...ITEM_STARTERS, ...SPELL_STARTERS].find((each) => each.label === label);
  if (!found) throw new Error(`no ${label} starter`);
  return found.entry;
};

describe("homebrew starters", () => {
  it.each(
    HOMEBREW_KINDS.flatMap((kind) =>
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

  it("gives the spell every casting fact and its upcast text in the shape the sheet reads", () => {
    const { time, range, components, duration, entriesHigherLevel } = starter("Spell");
    expect(() =>
      spellCastingFactsSchema.parse({ time, range, components, duration }),
    ).not.toThrow();
    expect(entriesSchema.safeParse(entriesHigherLevel).success).toBe(true);
  });
});
