import type { HitDie } from "@dnd/rules";
import { describe, expect, it } from "vitest";
import {
  type CasterTable,
  type CharacterDefinition,
  type CharacterDerived,
  carriedWeight,
  characterDefinitionSchema,
  characterDerivedSchema,
  deriveCharacter,
  derivedValue,
  type EntryRef,
  entryKey,
  hitPointMaximum,
  type ItemDefenseTrait,
  itemKey,
  passiveSkill,
  type WeaponTrait,
} from "./index.ts";
import {
  DECEPTION,
  definition,
  derivedInput,
  hitDice,
  PERCEPTION,
  ROGUE,
  STEALTH,
  WARLOCK,
  withSkills,
} from "./test/vex.ts";

/** Vex is level 5, so the proficiency bonus is +3; Dexterity 16 and Charisma 17 give +3, Wisdom 12 gives +1. */
describe("passive scores", () => {
  it("doubles the bonus for expertise and adds it once for proficiency", () => {
    expect(passiveSkill(definition, STEALTH, "dex")).toBe(19);
    expect(passiveSkill(definition, DECEPTION, "cha")).toBe(16);
  });

  it("scores a skill the character is not proficient in rather than refusing it", () => {
    expect(passiveSkill(definition, PERCEPTION, "wis")).toBe(11);
  });

  it("rounds half proficiency down, as a bard's Jack of All Trades does", () => {
    const bard = withSkills([{ ref: STEALTH, level: "half" }]);

    expect(passiveSkill(characterDefinitionSchema.parse(bard), STEALTH, "dex")).toBe(14);
  });

  it("matches on the source too, so the other ruleset's row is a different skill", () => {
    expect(passiveSkill(definition, { name: "Stealth", source: "PHB" }, "dex")).toBe(13);
  });

  it("reads a character back out of the database column it was stored in", () => {
    const stored = characterDefinitionSchema.parse(JSON.parse(JSON.stringify(definition)));

    expect(passiveSkill(stored, STEALTH, "dex")).toBe(19);
  });
});

describe("hit point maximum", () => {
  it("takes the first die's highest face, then the roll or the average", () => {
    expect(hitPointMaximum(definition, hitDice).total).toBe(8 + 6 + 5 + 3 + 5 + 2 * 5);
  });

  it("reads a character back out of the database column it was stored in", () => {
    const stored = characterDefinitionSchema.parse(JSON.parse(JSON.stringify(definition)));
    expect(hitPointMaximum(stored, hitDice).total).toBe(8 + 6 + 5 + 3 + 5 + 2 * 5);
  });

  it("moves when a multiclass character reorders the levels it took", () => {
    const fighter = { name: "Fighter", source: "XPHB" };
    const wizard = { name: "Wizard", source: "XPHB" };
    const dice = new Map<string, HitDie>([
      [entryKey(fighter), 10],
      [entryKey(wizard), 6],
    ]);
    const fighterFirst = { ...definition, levels: [{ class: fighter }, { class: wizard }] };
    const wizardFirst = { ...definition, levels: [{ class: wizard }, { class: fighter }] };

    expect(hitPointMaximum(fighterFirst, dice).total).toBe(10 + 4 + 2 * 2);
    expect(hitPointMaximum(wizardFirst, dice).total).toBe(6 + 6 + 2 * 2);
  });

  it("rejects a class whose die the catalog did not supply", () => {
    expect(() => hitPointMaximum(definition, new Map([[entryKey(ROGUE), 8]]))).toThrow(
      "No hit die for catalog|Warlock|XPHB",
    );
  });

  it("takes the die for a homebrew class, keyed by its id rather than a name and source", () => {
    const homebrewLevels = { ...definition, levels: [{ class: { homebrewId: "hb_warden" } }] };
    const dice = new Map<string, HitDie>([[entryKey({ homebrewId: "hb_warden" }), 10]]);

    expect(hitPointMaximum(homebrewLevels, dice).total).toBe(10 + 2);
  });

  it("has somewhere to live, overridable like any derived field", () => {
    const computed = hitPointMaximum(definition, hitDice).total;
    const derived = characterDerivedSchema.parse(derivedInput({ hitPointMaximum: { computed } }));
    expect(derivedValue(derived.hitPointMaximum)).toBe(37);
    expect(derivedValue({ ...derived.hitPointMaximum, manual: 45 })).toBe(45);
  });
});

describe("deriveCharacter", () => {
  const STUDDED_LEATHER = { name: "Studded Leather Armor", source: "XPHB" };
  const SHIELD = { name: "Shield", source: "XPHB" };
  const LONGSWORD = { name: "Longsword", source: "XPHB" };
  const PLUS_ONE = { name: "+1 Weapon", source: "DMG" };
  const noBonus = { attack: 0, damage: 0 };
  const noDefenses = { resist: [], resistChoice: [], immune: [], conditionImmune: [] };
  const DAGGER_TRAIT: WeaponTrait = {
    kind: "melee",
    properties: ["F|XPHB", "L|XPHB", "T|XPHB"],
    damage: "1d4",
    name: "Dagger",
    category: "simple",
    damageType: "piercing",
    bonus: noBonus,
  };
  const LONGSWORD_TRAIT: WeaponTrait = {
    kind: "melee",
    properties: ["V|XPHB"],
    damage: "1d8",
    versatileDamage: "1d10",
    name: "Longsword",
    category: "martial",
    damageType: "slashing",
    bonus: noBonus,
  };

  /** The Warlock/Rogue fixture, with armor and a shield equipped. */
  const equipped: CharacterDefinition = {
    ...definition,
    inventory: [
      ...definition.inventory,
      { ref: STUDDED_LEATHER, quantity: 1, carried: true, equipped: true, attuned: false },
      { ref: SHIELD, quantity: 1, carried: true, equipped: true, attuned: false },
    ],
  };

  const catalog = {
    hitDice,
    spellcastingAbilities: new Map([[entryKey(WARLOCK), "cha" as const]]),
    casterTables: new Map([
      [
        entryKey(WARLOCK),
        {
          progression: "pact" as const,
          slots: [{ level: 2, total: 2 }],
          preparation: { printed: 4 },
        },
      ],
    ]),
    skills: [
      { ref: DECEPTION, ability: "cha" as const },
      { ref: STEALTH, ability: "dex" as const },
      { ref: PERCEPTION, ability: "wis" as const },
    ],
    sizes: ["medium" as const],
    speed: { walk: 30 },
    armor: new Map([
      [entryKey(STUDDED_LEATHER), { category: "light" as const, armorClass: 12 }],
      [entryKey(SHIELD), { category: "shield" as const, armorClass: 2 }],
    ]),
    weights: new Map<string, number | null>([
      [entryKey({ name: "Dagger", source: "XPHB" }), 1],
      [entryKey({ homebrewId: "hb_01" }), null],
      [entryKey(STUDDED_LEATHER), 13],
      [entryKey(SHIELD), 6],
      [entryKey(LONGSWORD), 3],
    ]),
    weapons: new Map<string, WeaponTrait>([
      [entryKey({ name: "Dagger", source: "XPHB" }), DAGGER_TRAIT],
      [entryKey(LONGSWORD), LONGSWORD_TRAIT],
    ]),
    raceDefenses: noDefenses,
    itemDefenses: new Map<string, ItemDefenseTrait>(),
  };

  const derived = deriveCharacter(equipped, catalog);

  it("parses as a derived block", () => {
    expect(characterDerivedSchema.safeParse(derived).success).toBe(true);
  });

  it("assembles hit points, size and speed the way the existing fields already do", () => {
    expect(derived.hitPointMaximum.computed).toBe(hitPointMaximum(equipped, hitDice).total);
    expect(derived.size.computed).toBe("medium");
    expect(derived.speed.computed).toEqual({ walk: 30 });
  });

  it("takes the size the definition picks where the race offers it, and the largest otherwise", () => {
    const sizes = ["tiny" as const, "medium" as const];
    const sized = (size?: "tiny" | "small") =>
      deriveCharacter({ ...equipped, size }, { ...catalog, sizes });
    expect(sized("tiny").size.computed).toBe("tiny");
    expect(sized("tiny").carryingCapacity.computed).toBe(60);
    expect(sized().size.computed).toBe("medium");
    expect(sized("small").size.computed).toBe("medium");
  });

  it("reads the proficiency bonus off total level", () => {
    expect(derived.proficiencyBonus.computed).toBe(3);
  });

  it("grants a saving throw only where the character is proficient", () => {
    expect(derived.savingThrows.wis).toEqual({
      computed: 4,
      manual: null,
      terms: [
        { label: "Wisdom", value: 1 },
        { label: "Proficiency", value: 3 },
      ],
    });
    expect(derived.savingThrows.cha.computed).toBe(6);
    expect(derived.savingThrows.str).toEqual({
      computed: -1,
      manual: null,
      terms: [{ label: "Strength", value: -1 }],
    });
  });

  it("scores every catalog skill, proficient or not, and attaches the skill it came from", () => {
    const deception = derived.skills.find((skill) => skill.ref.name === "Deception");
    const stealth = derived.skills.find((skill) => skill.ref.name === "Stealth");
    const perception = derived.skills.find((skill) => skill.ref.name === "Perception");

    expect(deception?.ability).toBe("cha");
    expect(stealth?.ability).toBe("dex");
    expect(deception?.modifier).toEqual({
      computed: 6,
      manual: null,
      terms: [
        { label: "Charisma", value: 3, reference: DECEPTION },
        { label: "Proficiency", value: 3 },
      ],
    });
    expect(deception?.passive.computed).toBe(16);

    expect(stealth?.modifier.computed).toBe(9);
    expect(stealth?.passive.computed).toBe(19);

    expect(perception?.modifier).toEqual({
      computed: 1,
      manual: null,
      terms: [{ label: "Wisdom", value: 1, reference: PERCEPTION }],
    });
    expect(perception?.passive.computed).toBe(11);
  });

  it("sums worn armor, Dexterity and a shield, referencing the item each term came from", () => {
    expect(derived.armorClass).toEqual({
      computed: 17,
      manual: null,
      terms: [
        { label: "Armor", value: 12, reference: STUDDED_LEATHER },
        { label: "Dexterity", value: 3 },
        { label: "Shield", value: 2, reference: SHIELD },
      ],
    });
  });

  it("falls back to the unarmored base rather than throwing when nothing resolves", () => {
    const unarmored = deriveCharacter(definition, { ...catalog, armor: new Map() });
    expect(unarmored.armorClass.computed).toBe(13);
  });

  it("omits the reference when the equipped armor is homebrew", () => {
    const homebrewArmor = { homebrewId: "hb_leather" };
    const withHomebrew: CharacterDefinition = {
      ...definition,
      inventory: [
        ...definition.inventory,
        { ref: homebrewArmor, quantity: 1, carried: true, equipped: true, attuned: false },
      ],
    };
    const homebrewCatalog = {
      ...catalog,
      armor: new Map([[entryKey(homebrewArmor), { category: "light" as const, armorClass: 11 }]]),
      weights: new Map([...catalog.weights, [entryKey(homebrewArmor), 10]]),
    };

    const result = deriveCharacter(withHomebrew, homebrewCatalog);

    expect(result.armorClass.terms).toContainEqual({ label: "Armor", value: 11 });
  });

  it("sets every ability's modifier off its score", () => {
    expect(derived.abilityModifiers.str).toEqual({
      computed: -1,
      manual: null,
      terms: [{ label: "Score 8", value: -1 }],
    });
    expect(derived.abilityModifiers.cha.computed).toBe(3);
  });

  it("pools hit dice by die size, so two d8 classes share one pool", () => {
    expect(derived.hitDice).toEqual([{ die: 8, total: { computed: 5, manual: null, terms: [] } }]);
  });

  it("keeps a pool per die size, in the order each was first taken", () => {
    const fighter = { name: "Fighter", source: "XPHB" };
    const multiclass = deriveCharacter(
      { ...equipped, levels: [...equipped.levels, { class: fighter }] },
      { ...catalog, hitDice: new Map([...hitDice, [entryKey(fighter), 10 as const]]) },
    );
    expect(multiclass.hitDice.map((pool) => [pool.die, pool.total.computed])).toEqual([
      [8, 5],
      [10, 1],
    ]);
  });

  it("rejects a class with no hit die rather than guessing one", () => {
    expect(() => deriveCharacter(equipped, { ...catalog, hitDice: new Map() })).toThrow(RangeError);
  });

  it("weighs the load, coins included, against what Strength 8 carries", () => {
    expect(derived.carryingCapacity).toEqual({ computed: 120, manual: null, terms: [] });
    expect(derived.carriedWeight).toBe(carriedWeight(equipped, catalog.weights));
    expect(derived.carriedWeight).toBe(2 + 13 + 6 + 1);
  });

  it("names the encumbrance tier where the table plays the variant, and none where it does not", () => {
    expect(derived.encumbrance).toBe("unencumbered");
    const laden = deriveCharacter(equipped, {
      ...catalog,
      weights: new Map([...catalog.weights, [entryKey(SHIELD), 90]]),
    });
    expect(laden.encumbrance).toBe("heavilyEncumbered");
    expect(deriveCharacter({ ...equipped, houseRules: {} }, catalog).encumbrance).toBeNull();
  });

  it("gives three attunement slots, and more to a high-level Artificer", () => {
    expect(derived.attunementSlots).toEqual({ computed: 3, manual: null, terms: [] });
    const artificer = { name: "Artificer", source: "TCE" };
    const tinkerer = deriveCharacter(
      { ...equipped, levels: Array.from({ length: 14 }, () => ({ class: artificer })) },
      { ...catalog, hitDice: new Map([[entryKey(artificer), 8 as const]]) },
    );
    expect(tinkerer.attunementSlots.computed).toBe(5);
  });

  describe("attacks", () => {
    const longsword = (entry: Partial<CharacterDefinition["inventory"][number]> = {}) => ({
      ref: LONGSWORD,
      quantity: 1,
      carried: true,
      equipped: false,
      attuned: false,
      ...entry,
    });
    const withSword = (
      entry: Partial<CharacterDefinition["inventory"][number]> = {},
      base: CharacterDefinition = definition,
    ): CharacterDefinition => ({ ...base, inventory: [...base.inventory, longsword(entry)] });
    const attackOf = (block: CharacterDerived, entry: number) =>
      block.attacks.find((attack) => attack.entry === entry);

    it("attacks with a finesse dagger's better Dexterity, terms and all", () => {
      expect(attackOf(derived, 0)).toEqual({
        entry: 0,
        ability: "dex",
        attackBonus: {
          computed: 6,
          manual: null,
          terms: [
            { label: "Dexterity", value: 3 },
            { label: "Proficiency", value: 3, reference: undefined },
          ],
        },
        damage: {
          dice: "1d4",
          type: "piercing",
          modifier: { computed: 3, manual: null, terms: [{ label: "Dexterity", value: 3 }] },
        },
        grip: null,
      });
    });

    it("lists only weapons, skipping the armor and the homebrew trinket", () => {
      expect(derived.attacks.map((attack) => attack.entry)).toEqual([0]);
    });

    it("leaves out a weapon the character is not carrying", () => {
      const left = deriveCharacter(withSword({ carried: false }), catalog);
      expect(attackOf(left, 2)).toBeUndefined();
    });

    it("adds proficiency by category or by the weapon's own name, and not otherwise", () => {
      const named = (weapons: string[]) =>
        attackOf(
          deriveCharacter(
            withSword(
              {},
              { ...definition, proficiencies: { ...definition.proficiencies, weapons } },
            ),
            catalog,
          ),
          2,
        )?.attackBonus.computed;
      expect(named(["Simple"])).toBe(-1);
      expect(named(["martial"])).toBe(2);
      expect(named(["longsword"])).toBe(2);
    });

    it("reads a proficiency spelled the way the book prints it", () => {
      const named = (weapons: string[]) =>
        attackOf(
          deriveCharacter(
            withSword(
              {},
              { ...definition, proficiencies: { ...definition.proficiencies, weapons } },
            ),
            catalog,
          ),
          2,
        )?.attackBonus.computed;
      expect(named(["Martial weapons"])).toBe(2);
      expect(named(["Longswords"])).toBe(2);
      expect(named(["Simple weapons"])).toBe(-1);
    });

    it("rolls a versatile weapon's stored grip, one-handed where none is stored", () => {
      const damage = (grip?: "two-handed") =>
        attackOf(deriveCharacter(withSword(grip ? { grip } : {}), catalog), 2);
      expect(damage()?.damage?.dice).toBe("1d8");
      expect(damage()?.grip).toEqual({ held: "one-handed", twoHandedBlocked: false });
      expect(damage("two-handed")?.damage?.dice).toBe("1d10");
    });

    it("holds a versatile weapon one-handed while it and a shield are both equipped", () => {
      const both = deriveCharacter(
        withSword({ equipped: true, grip: "two-handed" }, equipped),
        catalog,
      );
      const sword = attackOf(both, 4);
      expect(sword?.damage?.dice).toBe("1d8");
      expect(sword?.grip).toEqual({ held: "one-handed", twoHandedBlocked: true });

      const stowed = deriveCharacter(withSword({ grip: "two-handed" }, equipped), catalog);
      expect(attackOf(stowed, 4)?.grip).toEqual({ held: "two-handed", twoHandedBlocked: false });
    });

    it("adds a magic weapon's bonus to each roll, referencing the row that granted it", () => {
      const magic = deriveCharacter(withSword({ variant: PLUS_ONE }), {
        ...catalog,
        weights: new Map([...catalog.weights, [itemKey({ ref: LONGSWORD, variant: PLUS_ONE }), 3]]),
        weapons: new Map([
          ...catalog.weapons,
          [
            itemKey({ ref: LONGSWORD, variant: PLUS_ONE }),
            { ...LONGSWORD_TRAIT, bonus: { attack: 1, damage: 1, reference: PLUS_ONE } },
          ],
        ]),
      });
      const sword = attackOf(magic, 2);
      expect(sword?.attackBonus.terms).toContainEqual({
        label: "Magic",
        value: 1,
        reference: PLUS_ONE,
      });
      expect(sword?.attackBonus.computed).toBe(0);
      expect(sword?.damage?.modifier.computed).toBe(0);
    });

    it("parses as the derived block's attacks", () => {
      const block = deriveCharacter(withSword({}, equipped), catalog);
      expect(characterDerivedSchema.parse(block).attacks).toHaveLength(2);
    });
  });

  describe("defenses", () => {
    const DWARF = { name: "Dwarf", source: "PHB" };
    const HILL = { name: "Hill", source: "PHB" };
    const RING = { name: "Ring of Poison Resistance", source: "DMG" };
    const PERIAPT = { name: "Periapt of Proof against Poison", source: "DMG" };
    const hillDwarf = (inventory: CharacterDefinition["inventory"]): CharacterDefinition => ({
      ...definition,
      race: DWARF,
      subrace: HILL,
      inventory,
    });
    const worn = (ref: EntryRef, flags: { equipped?: boolean; attuned?: boolean }) => ({
      ref,
      quantity: 1,
      carried: true,
      equipped: flags.equipped ?? false,
      attuned: flags.attuned ?? false,
    });
    const defended = {
      ...catalog,
      weights: new Map([...catalog.weights, [entryKey(RING), 0], [entryKey(PERIAPT), 0]]),
      raceDefenses: { ...noDefenses, resist: ["poison"] },
      itemDefenses: new Map<string, ItemDefenseTrait>([
        [
          entryKey(RING),
          {
            resist: ["poison"],
            immune: [],
            conditionImmune: [],
            name: RING.name,
            requiresAttunement: true,
          },
        ],
        [
          entryKey(PERIAPT),
          {
            resist: [],
            immune: ["poison"],
            conditionImmune: ["poisoned"],
            name: PERIAPT.name,
            requiresAttunement: false,
          },
        ],
      ]),
    };
    const defensesOf = (inventory: CharacterDefinition["inventory"]) =>
      deriveCharacter(hillDwarf(inventory), defended).defenses.computed;

    it("names the race and subrace that grant a resistance", () => {
      expect(defensesOf([])).toEqual({
        resistances: [{ name: "poison", from: ["Dwarf (Hill)"] }],
        damageImmunities: [],
        conditionImmunities: [],
        resistanceChoice: null,
      });
    });

    it("grants a race's choice of resistance once the definition picks one it offers", () => {
      const choosing = {
        ...defended,
        raceDefenses: { ...noDefenses, resist: ["poison"], resistChoice: ["acid", "fire"] },
      };
      const picking = (raceResistance?: string) =>
        deriveCharacter({ ...hillDwarf([]), raceResistance }, choosing).defenses.computed;

      expect(picking("fire")).toMatchObject({
        resistances: [
          { name: "poison", from: ["Dwarf (Hill)"] },
          { name: "fire", from: ["Dwarf (Hill)"] },
        ],
        resistanceChoice: null,
      });
      const waiting = { from: "Dwarf (Hill)", options: ["acid", "fire"] };
      expect(picking()).toMatchObject({
        resistances: [{ name: "poison" }],
        resistanceChoice: waiting,
      });
      expect(picking("cold")).toMatchObject({
        resistances: [{ name: "poison" }],
        resistanceChoice: waiting,
      });
    });

    it("lists a type granted twice once, naming both sources", () => {
      expect(defensesOf([worn(RING, { equipped: true, attuned: true })]).resistances).toEqual([
        { name: "poison", from: ["Dwarf (Hill)", RING.name] },
      ]);
    });

    it("grants an attunement item's defenses only while equipped and attuned", () => {
      const raceOnly = [{ name: "poison", from: ["Dwarf (Hill)"] }];
      expect(defensesOf([worn(RING, { equipped: true })]).resistances).toEqual(raceOnly);
      expect(defensesOf([worn(RING, { attuned: true })]).resistances).toEqual(raceOnly);
    });

    it("grants any other item's defenses only while equipped", () => {
      expect(defensesOf([worn(PERIAPT, { attuned: true })]).damageImmunities).toEqual([]);
      expect(defensesOf([worn(PERIAPT, { equipped: true })])).toMatchObject({
        damageImmunities: [{ name: "poison", from: [PERIAPT.name] }],
        conditionImmunities: [{ name: "poisoned", from: [PERIAPT.name] }],
      });
    });

    it("parses as the derived block's defenses", () => {
      const block = deriveCharacter(hillDwarf([worn(PERIAPT, { equipped: true })]), defended);
      expect(characterDerivedSchema.parse(block).defenses.manual).toBeNull();
    });
  });

  it("reads initiative off Dexterity alone", () => {
    expect(derived.initiative.computed).toBe(3);
  });

  it("carries terms that sum to each value it derives from a score or a level", () => {
    for (const field of [
      derived.initiative,
      derived.proficiencyBonus,
      derived.hitPointMaximum,
      ...Object.values(derived.abilityModifiers),
    ]) {
      expect(field.terms.length).toBeGreaterThan(0);
      expect(field.terms.reduce((sum, term) => sum + term.value, 0)).toBe(field.computed);
    }
  });

  it("sets a save DC and attack bonus per caster class, and skips a class that does not cast", () => {
    expect(derived.spellcasting).toEqual([
      {
        class: WARLOCK,
        ability: "cha",
        saveDc: {
          computed: 14,
          manual: null,
          terms: [
            { label: "Base", value: 8 },
            { label: "Charisma", value: 3 },
            { label: "Proficiency", value: 3 },
          ],
        },
        attackBonus: {
          computed: 6,
          manual: null,
          terms: [
            { label: "Charisma", value: 3 },
            { label: "Proficiency", value: 3 },
          ],
        },
        preparedSpells: { computed: 4, manual: null, terms: [] },
      },
    ]);
  });

  describe("spell slots", () => {
    const WIZARD = { name: "Wizard", source: "PHB" };
    const SORCERER = { name: "Sorcerer", source: "PHB" };
    const CLERIC = { name: "Cleric", source: "PHB" };
    const PALADIN = { name: "Paladin", source: "PHB" };
    const FIGHTER = { name: "Fighter", source: "PHB" };

    const caster = (...levels: { name: string; source: string }[]): CharacterDefinition => ({
      ...definition,
      levels: levels.map((ref) => ({ class: ref })),
    });
    const of = (count: number, ref: { name: string; source: string }) =>
      Array.from({ length: count }, () => ref);

    /** Each class's own table row at the level the test takes it to, as `content.db` holds it. */
    const tables = (entries: [EntryRef, CasterTable][]) => ({
      ...catalog,
      hitDice: new Map(entries.map(([ref]) => [entryKey(ref), 8 as const])),
      spellcastingAbilities: new Map(entries.map(([ref]) => [entryKey(ref), "int" as const])),
      casterTables: new Map(entries.map(([ref, table]) => [entryKey(ref), table])),
    });
    const totals = (block: CharacterDerived) =>
      block.spellSlots.map((slot) => [slot.level, slot.total.computed]);

    it("names a slot override by its slot level", () => {
      const block = deriveCharacter(
        { ...caster(WIZARD), overrides: { "spellSlots.1.total": 4 } },
        tables([[WIZARD, { progression: "full", slots: [{ level: 1, total: 2 }] }]]),
      );
      expect(block.spellSlots).toEqual([
        { level: 1, total: { computed: 2, manual: 4, terms: [] } },
      ]);
    });

    it("counts pact slots apart from the rest", () => {
      expect(derived.pactSlots).toEqual({
        level: 2,
        total: { computed: 2, manual: null, terms: [] },
      });
      expect(derived.spellSlots).toEqual([]);
    });

    it("reads a lone caster's own table, which the multiclass table would get wrong", () => {
      const paladin = tables([
        [
          PALADIN,
          {
            progression: "1/2",
            slots: [
              { level: 1, total: 4 },
              { level: 2, total: 2 },
            ],
          },
        ],
      ]);
      expect(totals(deriveCharacter(caster(...of(5, PALADIN)), paladin))).toEqual([
        [1, 4],
        [2, 2],
      ]);
    });

    it("reads the multiclass table at the combined caster level for two casters", () => {
      const block = deriveCharacter(
        caster(...of(3, WIZARD), ...of(2, CLERIC), ...of(3, FIGHTER)),
        tables([
          [WIZARD, { progression: "full", slots: [{ level: 1, total: 4 }] }],
          [CLERIC, { progression: "full", slots: [{ level: 1, total: 3 }] }],
          [FIGHTER, { progression: "1/3", slots: [{ level: 1, total: 2 }] }],
        ]),
      );
      expect(totals(block)).toEqual([
        [1, 4],
        [2, 3],
        [3, 3],
      ]);
    });

    it("leaves out a class that has a table but does not cast yet", () => {
      const catalogWith = tables([
        [WIZARD, { progression: "full", slots: [{ level: 1, total: 2 }] }],
        [PALADIN, { progression: "1/2", slots: [] }],
      ]);
      catalogWith.spellcastingAbilities.delete(entryKey(PALADIN));
      expect(totals(deriveCharacter(caster(WIZARD, PALADIN), catalogWith))).toEqual([[1, 2]]);
    });

    it("gives a character with no casting class no slots at all", () => {
      const block = deriveCharacter(caster(FIGHTER), {
        ...tables([]),
        hitDice: new Map([[entryKey(FIGHTER), 10 as const]]),
      });
      expect(block.spellSlots).toEqual([]);
      expect(block.pactSlots).toBeNull();
      expect(block.spellcasting).toEqual([]);
    });

    it("counts a classic prepared list from the class's own level and modifier", () => {
      const block = deriveCharacter(
        caster(...of(5, PALADIN), ...of(3, CLERIC)),
        tables([
          [PALADIN, { progression: "1/2", slots: [], preparation: { rule: "half-level" } }],
          [CLERIC, { progression: "full", slots: [], preparation: { rule: "level" } }],
        ]),
      );
      // int 10 is a +0 modifier, the ability `tables` gives every class.
      expect(block.spellcasting.map((entry) => entry.preparedSpells?.computed)).toEqual([2, 3]);
    });

    it("gives a class that knows its spells no prepared count", () => {
      const block = deriveCharacter(
        caster(SORCERER),
        tables([[SORCERER, { progression: "full", slots: [{ level: 1, total: 2 }] }]]),
      );
      expect(block.spellcasting[0]).not.toHaveProperty("preparedSpells");
    });
  });

  describe("overrides", () => {
    const withOverrides = (overrides: CharacterDefinition["overrides"]) =>
      deriveCharacter({ ...equipped, overrides }, catalog);

    it("folds each override into the field its key names, leaving the computed side alone", () => {
      const block = withOverrides({
        armorClass: 20,
        "abilityModifiers.dex": 5,
        "skills.Stealth|XPHB.modifier": 12,
      });

      expect(block.armorClass).toEqual({ ...derived.armorClass, manual: 20 });
      expect(derivedValue(block.abilityModifiers.dex)).toBe(5);
      const stealth = block.skills.find((skill) => skill.ref.name === "Stealth");
      expect(stealth?.modifier).toEqual({
        computed: 9,
        manual: 12,
        terms: stealth?.modifier.terms,
      });
      expect(stealth?.passive.manual).toBeNull();
    });

    it("returns the computed value once the override is cleared", () => {
      const overridden = withOverrides({ armorClass: 20 });
      const cleared = withOverrides({});

      expect(derivedValue(overridden.armorClass)).toBe(20);
      expect(cleared.armorClass).toEqual(derived.armorClass);
      expect(derivedValue(cleared.armorClass)).toBe(17);
    });

    it("keeps an override through a level-up that moves the computed value", () => {
      const fighter = { name: "Fighter", source: "XPHB" };
      const leveled = deriveCharacter(
        {
          ...equipped,
          levels: [...equipped.levels, { class: fighter }],
          overrides: { hitPointMaximum: 99 },
        },
        { ...catalog, hitDice: new Map([...hitDice, [entryKey(fighter), 10 as const]]) },
      );

      expect(leveled.hitPointMaximum.computed).toBeGreaterThan(derived.hitPointMaximum.computed);
      expect(derivedValue(leveled.hitPointMaximum)).toBe(99);
    });

    it("leaves unapplied a key naming no field, rather than refusing the block", () => {
      expect(withOverrides({ "skills.Juggling|XPHB.modifier": 4 })).toEqual(derived);
    });

    it("leaves unapplied a value its field refuses, and applies the rest", () => {
      const block = withOverrides({ armorClass: "high", initiative: 6 });

      expect(block.armorClass).toEqual(derived.armorClass);
      expect(derivedValue(block.initiative)).toBe(6);
    });

    it("leaves unapplied a refused value inside a list element or a nested object", () => {
      const block = withOverrides({
        "skills.Stealth|XPHB.modifier": "x",
        speed: { walk: -5 },
        "skills.Deception|XPHB.modifier": 8,
      });

      expect(block.skills).toEqual(
        derived.skills.map((skill) =>
          skill.ref.name === "Deception"
            ? { ...skill, modifier: { ...skill.modifier, manual: 8 } }
            : skill,
        ),
      );
      expect(block.speed).toEqual(derived.speed);
    });

    it("names a hit die pool, a caster and a weapon by what they are", () => {
      const block = withOverrides({
        "hitDice.8.total": 7,
        "spellcasting.catalog|Warlock|XPHB.saveDc": 18,
        "attacks.catalog|Dagger|XPHB#0.attackBonus": 9,
      });

      expect(block.hitDice[0]?.total.manual).toBe(7);
      expect(block.spellcasting[0]?.saveDc.manual).toBe(18);
      expect(block.attacks.find((attack) => attack.entry === 0)?.attackBonus.manual).toBe(9);
    });

    it("keeps a weapon's override on it when an item lands ahead of it", () => {
      const block = deriveCharacter(
        {
          ...equipped,
          inventory: [
            { ref: STUDDED_LEATHER, quantity: 1, carried: true, equipped: false, attuned: false },
            ...equipped.inventory,
          ],
          overrides: { "attacks.catalog|Dagger|XPHB#0.attackBonus": 9 },
        },
        catalog,
      );

      expect(block.attacks.find((attack) => attack.entry === 1)?.attackBonus.manual).toBe(9);
    });
  });
});
