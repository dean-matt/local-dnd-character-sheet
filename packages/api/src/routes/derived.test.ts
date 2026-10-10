import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type CharacterDefinition,
  type CharacterDerived,
  characterDefinitionSchema,
} from "@dnd/character";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { z } from "zod";
import { insertCharacter, updateCharacterDefinition } from "../db/queries/characters.ts";
import { publishDerivedFixture } from "../db/queries/contentFixture.ts";
import {
  insertHomebrewClass,
  insertHomebrewItem,
  insertHomebrewRace,
} from "../db/queries/homebrew.ts";
import { openTestDatabases } from "../db/testDatabases.ts";
import { derivedRoutes } from "./derived.ts";

const FIGHTER = { name: "Fighter", source: "PHB" };
const BARBARIAN = { name: "Barbarian", source: "PHB" };
const PALADIN = { name: "Paladin", source: "PHB" };
const WARLOCK = { name: "Warlock", source: "XPHB" };
const ELDRITCH_KNIGHT = { name: "Eldritch Knight", source: "PHB" };
const FIGHTER_ONE = { name: "Fighter", source: "XPHB" };
const ELDRITCH_KNIGHT_ONE = { name: "Eldritch Knight", source: "XPHB" };
const ELF = { name: "Elf", source: "PHB" };
const PLATE = { name: "Plate Armor", source: "PHB" };
const SHIELD = { name: "Shield", source: "PHB" };
const PLUS_ONE = { name: "+1 Armor", source: "DMG" };
const BAG = { name: "Bag of Holding", source: "DMG" };
const BACKPACK = { name: "Backpack", source: "PHB" };
const BARDING = { name: "Barding", source: "PHB" };
const LONGSWORD = { name: "Longsword", source: "PHB" };
const PLUS_ONE_WEAPON = { name: "+1 Weapon", source: "DMG" };
const DAGGER_OF_VENOM = { name: "Dagger of Venom", source: "DMG" };
const DWARF = { name: "Dwarf", source: "PHB" };
const DRAGONBORN = { name: "Dragonborn", source: "PHB" };
const FIRE_RESISTANCE = { name: "Armor of Fire Resistance", source: "DMG" };
const HILL_BELT = { name: "Belt of Hill Giant Strength", source: "DMG" };
const RING_OF_PROTECTION = { name: "Ring of Protection", source: "DMG" };
const WAR_MAGE = { name: "Wand of the War Mage +1", source: "DMG" };
const BOOTS_OF_SPEED = { name: "Boots of Speed", source: "DMG" };
const PERIAPT = { name: "Periapt of Proof against Poison", source: "DMG" };
const MANTLE = { name: "Mantle of Spell Resistance", source: "DMG" };
const HOLY_AVENGER = { name: "Holy Avenger", source: "DMG" };
const MACE = { name: "Mace", source: "XPHB" };
const WAND_OF_ORCUS = { name: "Wand of Orcus", source: "XDMG" };

const item = (ref: { name: string; source: string }, kind: string, json: object) => ({
  ...ref,
  edition: "classic",
  kind,
  type: null,
  rarity: null,
  requires_attunement: 0 as const,
  json: JSON.stringify({ ...ref, ...json }),
});

const skill = (name: string, source: string, edition: string, ability: string) => ({
  kind: "skill",
  name,
  source,
  edition,
  json: JSON.stringify({ name, source, ability }),
});

const definitionWith = (
  overrides: Partial<z.input<typeof characterDefinitionSchema>> = {},
): CharacterDefinition =>
  characterDefinitionSchema.parse({
    name: "Vex",
    edition: "classic",
    levels: [{ class: FIGHTER }, { class: FIGHTER }, { class: FIGHTER, subclass: ELDRITCH_KNIGHT }],
    race: ELF,
    subrace: { name: "Wood", source: "PHB" },
    background: { name: "Soldier", source: "PHB" },
    abilityScores: { str: 16, dex: 14, con: 14, int: 12, wis: 10, cha: 8 },
    proficiencies: {
      savingThrows: ["str", "con"],
      skills: [],
      armor: [],
      weapons: [],
      tools: [],
      languages: [],
    },
    inventory: [
      { ref: PLATE, equipped: true },
      { ref: SHIELD, equipped: true },
    ],
    spells: [],
    ...overrides,
  });

describe("derivedRoutes", () => {
  let dataDir: string;
  let opened: ReturnType<typeof openTestDatabases>;
  let routes: ReturnType<typeof derivedRoutes>;

  const store = (definition: CharacterDefinition) =>
    insertCharacter(opened.charactersDb, { id: "1", definition });

  const derived = async (): Promise<CharacterDerived> => {
    const res = await routes.request("/characters/1/derived");
    expect(res.status).toBe(200);
    return res.json();
  };

  beforeAll(() => {
    dataDir = mkdtempSync(join(tmpdir(), "derived-routes-"));
    publishDerivedFixture(dataDir, {
      classes: [
        { ...FIGHTER, edition: "classic", hit_die: 10, json: JSON.stringify(FIGHTER) },
        { ...FIGHTER_ONE, edition: "one", hit_die: 10, json: JSON.stringify(FIGHTER_ONE) },
        { ...BARBARIAN, edition: "classic", hit_die: 12, json: JSON.stringify(BARBARIAN) },
        {
          ...PALADIN,
          edition: "classic",
          hit_die: 10,
          json: JSON.stringify({
            ...PALADIN,
            spellcastingAbility: "cha",
            casterProgression: "1/2",
            preparedSpells: "<$level$> / 2 + <$cha_mod$>",
          }),
        },
        {
          ...WARLOCK,
          edition: "one",
          hit_die: 8,
          json: JSON.stringify({
            ...WARLOCK,
            spellcastingAbility: "cha",
            casterProgression: "pact",
          }),
        },
      ],
      classResources: [
        {
          class_name: "Warlock",
          class_source: "XPHB",
          level: 1,
          resource_key: "prepared_spells",
          value: "2",
        },
        {
          class_name: "Fighter",
          class_source: "XPHB",
          level: 3,
          resource_key: "weapon_mastery",
          value: "3",
        },
      ],
      spellSlots: [
        { class_name: "Paladin", class_source: "PHB", level: 2, slot_level: 1, slots: 2 },
        { class_name: "Warlock", class_source: "XPHB", level: 1, slot_level: 1, slots: 1 },
      ],
      subclassResources: [
        {
          class_name: "Fighter",
          class_source: "XPHB",
          subclass_name: "Eldritch Knight",
          subclass_source: "XPHB",
          level: 3,
          resource_key: "prepared_spells",
          value: "3",
        },
      ],
      subclassSpellSlots: [
        {
          class_name: "Fighter",
          class_source: "PHB",
          subclass_name: "Eldritch Knight",
          subclass_source: "PHB",
          level: 3,
          slot_level: 1,
          slots: 2,
        },
      ],
      subclasses: [
        {
          name: "Eldritch Knight",
          source: "PHB",
          short_name: "Eldritch Knight",
          class_name: "Fighter",
          class_source: "PHB",
          edition: "classic",
          json: JSON.stringify({
            name: "Eldritch Knight",
            spellcastingAbility: "int",
            casterProgression: "1/3",
          }),
        },
        {
          ...ELDRITCH_KNIGHT_ONE,
          short_name: "Eldritch Knight",
          class_name: "Fighter",
          class_source: "XPHB",
          edition: "one",
          json: JSON.stringify({
            ...ELDRITCH_KNIGHT_ONE,
            spellcastingAbility: "int",
            casterProgression: "1/3",
          }),
        },
        {
          name: "Path of the Ancestral Guardian",
          source: "XGE",
          short_name: "Ancestral Guardian",
          class_name: "Barbarian",
          class_source: "PHB",
          edition: "classic",
          json: JSON.stringify({
            name: "Path of the Ancestral Guardian",
            spellcastingAbility: "wis",
            additionalSpells: [{ innate: { "10": ["augury", "clairvoyance"] } }],
          }),
        },
      ],
      races: [
        { ...ELF, edition: "classic", json: JSON.stringify({ size: ["M"], speed: 30 }) },
        { ...DWARF, edition: "classic", json: JSON.stringify({ size: ["M"], speed: 25 }) },
        {
          ...DRAGONBORN,
          edition: "classic",
          json: JSON.stringify({
            size: ["M"],
            speed: 30,
            resist: [{ choose: { from: ["acid", "cold", "fire", "lightning", "poison"] } }],
          }),
        },
      ],
      subraces: [
        {
          name: "Wood",
          source: "PHB",
          race_name: "Elf",
          race_source: "PHB",
          edition: "classic",
          json: JSON.stringify({ size: ["M"], speed: 35 }),
        },
        {
          name: "Hill",
          source: "PHB",
          race_name: "Dwarf",
          race_source: "PHB",
          edition: "classic",
          json: JSON.stringify({ size: ["M"], speed: 25, resist: ["poison"] }),
        },
      ],
      items: [
        item(PLATE, "baseitem", {
          type: "HA",
          ac: 18,
          armor: true,
          weight: 65,
          stealth: true,
          strength: "15",
        }),
        item(SHIELD, "baseitem", { type: "S", ac: 2, weight: 6 }),
        item(BAG, "item", { weight: 15, containerCapacity: { weight: [500], weightless: true } }),
        item(BACKPACK, "baseitem", { weight: 5, containerCapacity: { weight: [30] } }),
        item(PLUS_ONE, "magicvariant", {
          type: "GV",
          requires: [{ armor: true }],
          inherits: { namePrefix: "+1 ", source: "DMG", bonusAc: "+1" },
        }),
        item(LONGSWORD, "baseitem", {
          type: "M",
          weaponCategory: "martial",
          weapon: true,
          property: ["V"],
          dmg1: "1d8",
          dmg2: "1d10",
          dmgType: "S",
          weight: 3,
        }),
        item(MACE, "baseitem", {
          type: "M|XPHB",
          weaponCategory: "simple",
          weapon: true,
          dmg1: "1d6",
          dmgType: "B",
          mastery: ["Sap|XPHB"],
        }),
        item(WAND_OF_ORCUS, "item", {
          type: "M|XPHB",
          weaponCategory: "simple",
          baseItem: "mace|xphb",
          dmg1: "1d6",
          dmgType: "B",
        }),
        item(DAGGER_OF_VENOM, "item", {
          type: "M",
          weaponCategory: "simple",
          baseItem: "dagger|phb",
          property: ["F", "L", "T"],
          dmg1: "1d4",
          dmgType: "P",
          bonusWeapon: "+1",
        }),
        item(PLUS_ONE_WEAPON, "magicvariant", {
          type: "GV",
          requires: [{ weapon: true }],
          inherits: { namePrefix: "+1 ", source: "DMG", bonusWeapon: "+1" },
        }),
        item(FIRE_RESISTANCE, "magicvariant", {
          type: "GV",
          requires: [{ armor: true }],
          inherits: {
            nameSuffix: " of Fire Resistance",
            source: "DMG",
            reqAttune: true,
            resist: ["fire"],
          },
        }),
        item(HILL_BELT, "item", { ability: { static: { str: 21 } } }),
        item(RING_OF_PROTECTION, "item", {
          bonusAc: "+1",
          bonusSavingThrow: "+1",
        }),
        item(WAR_MAGE, "item", {
          reqAttune: true,
          bonusSpellAttack: "+1",
          bonusSpellSaveDc: "+1",
        }),
        item(BOOTS_OF_SPEED, "item", {
          reqAttune: true,
          modifySpeed: { multiply: { walk: 2 } },
          vulnerable: ["fire"],
          grantsLanguage: true,
          critThreshold: 19,
        }),
        item(PERIAPT, "item", { immune: ["poison"], conditionImmune: ["poisoned"] }),
        item(MANTLE, "item", { reqAttune: true }),
        item(HOLY_AVENGER, "magicvariant", {
          type: "GV",
          requires: [{ weapon: true }],
          inherits: { namePrefix: "Holy Avenger ", source: "DMG", reqAttune: true },
        }),
        item(BARDING, "magicvariant", {
          type: "GV",
          requires: [{ armor: true }],
          inherits: {
            nameSuffix: " Barding",
            source: "PHB",
            weightExpression: "[[baseItem.weight]] * 2",
          },
        }),
      ],
      lookups: [
        skill("Athletics", "PHB", "classic", "str"),
        skill("Athletics", "XPHB", "one", "str"),
        skill("Stealth", "PHB", "classic", "dex"),
      ],
    });
  });

  afterAll(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    opened = openTestDatabases();
    routes = derivedRoutes(opened.charactersDb, dataDir, opened.homebrewDb);
  });

  afterEach(() => {
    opened.charactersDb.$client.close();
    opened.homebrewDb.$client.close();
  });

  it("404s an id that names no character", async () => {
    const res = await routes.request("/characters/nobody/derived");
    expect(res.status).toBe(404);
  });

  it("derives the block from the catalog rows the character names", async () => {
    store(definitionWith());
    const block = await derived();

    expect(block.hitPointMaximum.computed).toBe(10 + 6 + 6 + 3 * 2);
    expect(block.armorClass.computed).toBe(20);
    expect(block.size.computed).toBe("medium");
    expect(block.speed.computed).toEqual({ walk: 35 });
    expect(block.spellcasting).toEqual([
      expect.objectContaining({ class: FIGHTER, ability: "int" }),
    ]);
    expect(block.skills.map((entry) => entry.ref)).toEqual([
      { name: "Athletics", source: "PHB" },
      { name: "Stealth", source: "PHB" },
    ]);
  });

  it("gives a class its casting ability from its first spell slot", async () => {
    store(definitionWith({ levels: [{ class: PALADIN }] }));
    expect((await derived()).spellcasting).toEqual([]);

    updateCharacterDefinition(
      opened.charactersDb,
      "1",
      definitionWith({ levels: [{ class: PALADIN }, { class: PALADIN }] }),
    );
    expect((await derived()).spellcasting).toEqual([
      expect.objectContaining({ class: PALADIN, ability: "cha" }),
    ]);
  });

  it("gives a subclass its casting ability from the level its first spell arrives", async () => {
    const barbarian = (level: number) =>
      definitionWith({
        levels: Array.from({ length: level }, (_, i) => ({
          class: BARBARIAN,
          ...(i === 2 && { subclass: { name: "Path of the Ancestral Guardian", source: "XGE" } }),
        })),
      });
    store(barbarian(9));
    expect((await derived()).spellcasting).toEqual([]);

    updateCharacterDefinition(opened.charactersDb, "1", barbarian(10));
    expect((await derived()).spellcasting).toEqual([
      expect.objectContaining({ class: BARBARIAN, ability: "wis" }),
    ]);
  });

  it("reads a third caster's slots off its subclass's table", async () => {
    store(definitionWith());
    const block = await derived();
    expect(block.spellSlots).toEqual([
      { level: 1, total: { computed: 2, manual: null, terms: [] } },
    ]);
    expect(block.spellcasting[0]).not.toHaveProperty("preparedSpells");
  });

  it("reads a third caster's printed prepared count off its subclass's table", async () => {
    store(
      definitionWith({
        edition: "one",
        levels: [
          { class: FIGHTER_ONE },
          { class: FIGHTER_ONE },
          { class: FIGHTER_ONE, subclass: ELDRITCH_KNIGHT_ONE },
        ],
      }),
    );
    expect((await derived()).spellcasting[0]?.preparedSpells?.computed).toBe(3);
  });

  it("counts a classic prepared list from the formula the class row prints", async () => {
    store(definitionWith({ levels: [{ class: PALADIN }, { class: PALADIN }] }));
    const [paladin] = (await derived()).spellcasting;
    // Half of level 2, and Charisma 8's -1, floored at one.
    expect(paladin?.preparedSpells?.computed).toBe(1);
  });

  it("reads a printed prepared count and pact slots off the class table", async () => {
    store(definitionWith({ levels: [{ class: WARLOCK }] }));
    const block = await derived();
    expect(block.spellcasting[0]?.preparedSpells?.computed).toBe(2);
    expect(block.pactSlots).toEqual({ level: 1, total: { computed: 1, manual: null, terms: [] } });
    expect(block.spellSlots).toEqual([]);
  });

  it("reads the multiclass table once two classes cast", async () => {
    store(
      definitionWith({
        levels: [
          { class: FIGHTER },
          { class: FIGHTER },
          { class: FIGHTER, subclass: ELDRITCH_KNIGHT },
          { class: PALADIN },
          { class: PALADIN },
        ],
      }),
    );
    // Caster level 1 + 1 = 2, where the two tables summed would give four slots.
    expect((await derived()).spellSlots.map((slot) => slot.total.computed)).toEqual([3]);
  });

  it("adds an equipped magic variant's bonus to its base item's armor class", async () => {
    store(definitionWith({ inventory: [{ ref: PLATE, variant: PLUS_ONE, equipped: true }] }));
    expect((await derived()).armorClass.computed).toBe(19);
  });

  it("weighs the load, a variant's own weight and an item that resolves to nothing included", async () => {
    store(
      definitionWith({
        inventory: [
          { ref: PLATE, equipped: true },
          { ref: PLATE, variant: BARDING, carried: true },
          { ref: SHIELD, quantity: 2 },
          { ref: { name: "Lost", source: "PHB" } },
        ],
        money: { gold: 50 },
        houseRules: { encumbrance: true },
      }),
    );
    const block = await derived();

    expect(block.carriedWeight).toBe(65 + 130 + 12 + 1);
    expect(block.carryingCapacity.computed).toBe(16 * 15);
    expect(block.encumbrance).toBe("heavilyEncumbered");
    expect(block.attunementSlots.computed).toBe(3);
  });

  it("weighs a pack's contents but not a Bag of Holding's, and warns of an overfull pack", async () => {
    store(
      definitionWith({
        inventory: [
          { ref: BAG, id: "bag" },
          { ref: PLATE, inside: "bag" },
          { ref: BACKPACK, id: "pack" },
          { ref: SHIELD, quantity: 6, inside: "pack" },
        ],
      }),
    );
    const block = await derived();

    expect(block.carriedWeight).toBe(15 + 5 + 36);
    expect(block.containers).toEqual([
      { entry: 0, name: "Bag of Holding", overflow: [] },
      { entry: 2, name: "Backpack", overflow: [{ excess: 6, unit: "lb" }] },
    ]);
  });

  it("attacks with a magic variant's bonus, tracing it to the variant", async () => {
    store(
      definitionWith({
        proficiencies: { ...definitionWith().proficiencies, weapons: ["Martial"] },
        inventory: [{ ref: LONGSWORD, variant: PLUS_ONE_WEAPON, grip: "two-handed" }],
      }),
    );
    const [attack] = (await derived()).attacks;

    expect(attack?.attackBonus.computed).toBe(3 + 2 + 1);
    expect(attack?.attackBonus.terms).toContainEqual({
      label: "Magic",
      value: 1,
      reference: PLUS_ONE_WEAPON,
    });
    expect(attack?.damage).toMatchObject({
      dice: "1d10",
      type: "slashing",
      modifier: { computed: 3 + 1 },
    });
  });

  it("grants a named weapon's proficiency to a magic item built on it", async () => {
    store(
      definitionWith({
        proficiencies: { ...definitionWith().proficiencies, weapons: ["Dagger"] },
        inventory: [{ ref: DAGGER_OF_VENOM }],
      }),
    );
    const [attack] = (await derived()).attacks;

    expect(attack?.attackBonus.terms).toContainEqual({ label: "Proficiency", value: 2 });
    expect(attack?.attackBonus.computed).toBe(3 + 2 + 1);
  });

  it("lets a Fighter master three kinds and shows a chosen one's mastery, magic items included", async () => {
    store(
      definitionWith({
        edition: "one",
        levels: [{ class: FIGHTER_ONE }, { class: FIGHTER_ONE }, { class: FIGHTER_ONE }],
        weaponMasteries: [MACE],
        inventory: [{ ref: MACE }, { ref: WAND_OF_ORCUS }, { ref: LONGSWORD }],
      }),
    );
    const block = await derived();

    expect(block.weaponMasteryLimit.computed).toBe(3);
    expect(block.weaponMasteryLimit.terms).toEqual([
      { label: "Fighter", value: 3, reference: FIGHTER_ONE },
    ]);
    expect(block.attacks.map((attack) => attack.mastery)).toEqual([
      [{ name: "Sap", source: "XPHB" }],
      [{ name: "Sap", source: "XPHB" }],
      [],
    ]);
  });

  it("holds a versatile weapon one-handed while it and a shield are both equipped", async () => {
    store(
      definitionWith({
        inventory: [
          { ref: SHIELD, equipped: true },
          { ref: LONGSWORD, equipped: true, grip: "two-handed" },
        ],
      }),
    );
    const [attack] = (await derived()).attacks;

    expect(attack?.entry).toBe(1);
    expect(attack?.damage?.dice).toBe("1d8");
    expect(attack?.grip).toEqual({ held: "one-handed", twoHandedBlocked: true });
  });

  it("gathers the subrace's defenses and those of an attuned variant and an equipped item", async () => {
    store(
      definitionWith({
        race: DWARF,
        subrace: { name: "Hill", source: "PHB" },
        inventory: [
          { ref: PLATE, variant: FIRE_RESISTANCE, equipped: true, attuned: true },
          { ref: PERIAPT, equipped: true },
        ],
      }),
    );

    expect((await derived()).defenses.computed).toEqual({
      resistances: [
        { name: "poison", from: ["Dwarf (Hill)"] },
        { name: "fire", from: ["Plate Armor of Fire Resistance"] },
      ],
      damageImmunities: [{ name: "poison", from: [PERIAPT.name] }],
      conditionImmunities: [{ name: "poisoned", from: [PERIAPT.name] }],
      vulnerabilities: [],
      resistanceChoice: null,
    });
  });

  it("raises a score to an equipped item's, catalog or homebrew", async () => {
    insertHomebrewItem(opened.homebrewDb, "gloves", {
      name: "Gloves of Dexterity",
      edition: "classic",
      ability: { dex: 2 },
    });
    store(
      definitionWith({
        inventory: [
          { ref: HILL_BELT, equipped: true },
          { ref: { homebrewId: "gloves" }, equipped: true },
        ],
      }),
    );
    const worn = await derived();
    expect(worn.abilityScores.str.computed).toBe(21);
    expect(worn.abilityScores.str.terms.at(-1)).toEqual({ label: HILL_BELT.name, value: 5 });
    expect(worn.abilityScores.dex.terms.at(-1)).toEqual({ label: "Gloves of Dexterity", value: 2 });
  });

  it("adds an item's armor class and save bonus, catalog or homebrew, while worn", async () => {
    insertHomebrewItem(opened.homebrewDb, "orb", {
      name: "Warding Orb",
      edition: "classic",
      bonusSavingThrowConcentration: "+2",
    });
    store(definitionWith({ inventory: [{ ref: RING_OF_PROTECTION }] }));
    const bare = await derived();
    updateCharacterDefinition(
      opened.charactersDb,
      "1",
      definitionWith({
        inventory: [
          { ref: RING_OF_PROTECTION, equipped: true },
          { ref: { homebrewId: "orb" }, equipped: true },
        ],
      }),
    );
    const worn = await derived();
    expect(worn.armorClass.computed).toBe(bare.armorClass.computed + 1);
    expect(worn.armorClass.terms.at(-1)).toEqual({ label: RING_OF_PROTECTION.name, value: 1 });
    expect(worn.savingThrows.str.computed).toBe(bare.savingThrows.str.computed + 1);
    expect(worn.concentrationSave?.terms.at(-1)).toEqual({ label: "Warding Orb", value: 2 });
  });

  it("adds an item's spellcasting bonuses, catalog or homebrew, while worn", async () => {
    insertHomebrewItem(opened.homebrewDb, "staff", {
      name: "Staff of Force",
      edition: "classic",
      bonusSpellDamage: "+1",
    });
    store(definitionWith({ inventory: [{ ref: WAR_MAGE }] }));
    const bare = await derived();
    updateCharacterDefinition(
      opened.charactersDb,
      "1",
      definitionWith({
        inventory: [
          { ref: WAR_MAGE, equipped: true, attuned: true },
          { ref: { homebrewId: "staff" }, equipped: true },
        ],
      }),
    );
    const worn = await derived();
    const [before] = bare.spellcasting;
    const [after] = worn.spellcasting;
    expect(after?.attackBonus.computed).toBe((before?.attackBonus.computed ?? 0) + 1);
    expect(after?.saveDc.terms.at(-1)).toEqual({ label: WAR_MAGE.name, value: 1 });
    expect(worn.spellDamageBonus?.terms).toEqual([{ label: "Staff of Force", value: 1 }]);
    expect(bare.spellDamageBonus).toBeNull();
  });

  it("applies an item's speed, vulnerability, grants and critical threshold, catalog or homebrew, while worn", async () => {
    insertHomebrewItem(opened.homebrewDb, "stone", {
      name: "Luckstone",
      edition: "classic",
      bonusAbilityCheck: "+1",
      bonusProficiencyBonus: "+1",
    });
    store(
      definitionWith({ inventory: [{ ref: BOOTS_OF_SPEED }, { ref: { homebrewId: "stone" } }] }),
    );
    const bare = await derived();
    updateCharacterDefinition(
      opened.charactersDb,
      "1",
      definitionWith({
        inventory: [
          { ref: BOOTS_OF_SPEED, equipped: true, attuned: true },
          { ref: { homebrewId: "stone" }, equipped: true },
        ],
      }),
    );
    const worn = await derived();
    expect(worn.speed.computed.walk).toBe(bare.speed.computed.walk * 2);
    expect(worn.defenses.computed.vulnerabilities).toEqual([
      { name: "fire", from: [BOOTS_OF_SPEED.name] },
    ]);
    expect(worn.itemGrants.computed.languages).toEqual([BOOTS_OF_SPEED.name]);
    expect(worn.proficiencyBonus.computed).toBe(bare.proficiencyBonus.computed + 1);
    expect(worn.initiative.terms.at(-1)).toEqual({ label: "Luckstone", value: 1 });
    expect(bare.speed.terms).toEqual([]);
  });

  it("marks the rolls an item grants advantage on, from the mapping or a homebrew item, while worn", async () => {
    insertHomebrewItem(opened.homebrewDb, "cloak", {
      name: "Cloak of Shadows",
      edition: "classic",
      advantage: [{ mode: "advantage", roll: "skill", target: "Stealth" }],
    });
    store(definitionWith({ inventory: [{ ref: MANTLE }, { ref: { homebrewId: "cloak" } }] }));
    expect((await derived()).rollEffects.computed).toEqual([]);

    updateCharacterDefinition(
      opened.charactersDb,
      "1",
      definitionWith({
        inventory: [
          { ref: MANTLE, equipped: true, attuned: true },
          { ref: { homebrewId: "cloak" }, equipped: true },
        ],
      }),
    );
    expect((await derived()).rollEffects.computed).toEqual([
      { item: MANTLE.name, mode: "advantage", roll: "save", condition: "against spells" },
      { item: "Cloak of Shadows", mode: "advantage", roll: "skill", target: "Stealth" },
    ]);
  });

  it("marks Stealth and slows a wearer below the armor's Strength, counting a belt toward it, catalog or homebrew", async () => {
    insertHomebrewItem(opened.homebrewDb, "scale", {
      name: "Rattling Scale",
      edition: "classic",
      type: "MA",
      ac: 14,
      stealth: true,
      strength: 17,
    });
    const weak = { str: 12, dex: 14, con: 14, int: 12, wis: 10, cha: 8 };
    store(definitionWith({ abilityScores: weak, inventory: [{ ref: PLATE, equipped: true }] }));
    const plate = await derived();
    expect(plate.speed.computed.walk).toBe(25);
    expect(plate.speed.terms).toEqual([{ label: "Plate Armor: Strength 15 required", value: -10 }]);
    expect(plate.rollEffects.computed).toEqual([
      { item: PLATE.name, mode: "disadvantage", roll: "skill", target: "Stealth" },
    ]);

    updateCharacterDefinition(
      opened.charactersDb,
      "1",
      definitionWith({
        abilityScores: weak,
        inventory: [
          { ref: PLATE, equipped: true },
          { ref: HILL_BELT, equipped: true },
          { ref: { homebrewId: "scale" }, equipped: true },
        ],
      }),
    );
    const belted = await derived();
    expect(belted.speed.terms).toEqual([]);
    expect(belted.rollEffects.computed.map((effect) => effect.item)).toEqual([
      PLATE.name,
      "Rattling Scale",
    ]);
  });

  it("reads a magic variant's effects through the mapping, not its base item's", async () => {
    store(
      definitionWith({
        inventory: [{ ref: LONGSWORD, variant: HOLY_AVENGER, equipped: true, attuned: true }],
      }),
    );
    expect((await derived()).rollEffects.computed).toEqual([
      {
        item: "Holy Avenger Longsword",
        mode: "advantage",
        roll: "save",
        condition: "against spells and other magical effects",
      },
    ]);
  });

  it("leaves a score alone while the item granting it is not equipped", async () => {
    store(definitionWith({ inventory: [{ ref: HILL_BELT }] }));
    expect((await derived()).abilityScores.str.computed).toBe(16);
  });

  it("grants the resistance a Dragonborn picks, and offers the choice until one is picked", async () => {
    const dragonborn = (raceResistance?: string) =>
      definitionWith({
        race: { name: "Dragonborn", source: "PHB" },
        subrace: undefined,
        raceResistance,
      });

    store(dragonborn());
    expect((await derived()).defenses.computed).toMatchObject({
      resistances: [],
      resistanceChoice: {
        from: "Dragonborn",
        options: ["acid", "cold", "fire", "lightning", "poison"],
      },
    });

    updateCharacterDefinition(opened.charactersDb, "1", dragonborn("fire"));
    expect((await derived()).defenses.computed).toMatchObject({
      resistances: [{ name: "fire", from: ["Dragonborn"] }],
      resistanceChoice: null,
    });
  });

  it("reads an equipped item that resolves to nothing as unarmored", async () => {
    store(
      definitionWith({ inventory: [{ ref: { name: "Lost", source: "PHB" }, equipped: true }] }),
    );
    expect((await derived()).armorClass.computed).toBe(10 + 2);
  });

  it("422s a class that resolves to nothing, naming it", async () => {
    store(definitionWith({ levels: [{ class: { name: "Wizard", source: "PHB" } }] }));
    const res = await routes.request("/characters/1/derived");

    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "No class Wizard (PHB)" });
  });

  it("422s a race that resolves to nothing", async () => {
    store(definitionWith({ subrace: { name: "Drow", source: "PHB" } }));
    const res = await routes.request("/characters/1/derived");

    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "No race Drow (PHB)" });
  });

  it("reads a race taken with no subrace from the race row", async () => {
    store(definitionWith({ subrace: undefined }));
    expect((await derived()).speed.computed).toEqual({ walk: 30 });
  });

  it("422s a class whose hit die no rule recognizes", async () => {
    insertHomebrewClass(opened.homebrewDb, "c", {
      name: "Titan",
      edition: "classic",
      hd: { number: 1, faces: 20 },
    });
    store(definitionWith({ levels: [{ class: { homebrewId: "c" } }] }));
    const res = await routes.request("/characters/1/derived");

    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "Class homebrew c has a d20 hit die" });
  });

  it("422s a stored race row that states no size or speed, naming that row", async () => {
    opened.homebrewDb.$client
      .prepare("INSERT INTO homebrew_races (id, edition, name, json) VALUES (?, ?, ?, ?)")
      .run("r", "classic", "Wisp", JSON.stringify({ name: "Wisp", source: "HB" }));
    store(definitionWith({ race: { homebrewId: "r" }, subrace: undefined }));
    const res = await routes.request("/characters/1/derived");

    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "Race homebrew r states no size or speed" });
  });

  it("takes the size a character picks from those its race offers", async () => {
    insertHomebrewRace(opened.homebrewDb, "r", {
      name: "Harengon",
      edition: "classic",
      size: ["S", "M"],
      speed: 30,
    });
    const harengon = { race: { homebrewId: "r" }, subrace: undefined } as const;
    store(definitionWith(harengon));
    expect((await derived()).size.computed).toBe("medium");
    updateCharacterDefinition(
      opened.charactersDb,
      "1",
      definitionWith({ ...harengon, size: "small" }),
    );
    expect((await derived()).size.computed).toBe("small");
  });

  it("resolves a homebrew class, race and item", async () => {
    insertHomebrewClass(opened.homebrewDb, "c", {
      name: "Hexblade",
      edition: "classic",
      hd: { number: 1, faces: 8 },
      spellcastingAbility: "cha",
    });
    insertHomebrewRace(opened.homebrewDb, "r", {
      name: "Sprite",
      edition: "classic",
      size: ["T"],
      speed: { walk: 10, fly: 40 },
    });
    insertHomebrewItem(opened.homebrewDb, "i", {
      name: "Bark Mail",
      edition: "classic",
      type: "MA",
      ac: 14,
    });
    store(
      definitionWith({
        levels: [{ class: { homebrewId: "c" } }],
        race: { homebrewId: "r" },
        subrace: undefined,
        inventory: [{ ref: { homebrewId: "i" }, equipped: true }],
      }),
    );
    const block = await derived();

    expect(block.hitPointMaximum.computed).toBe(8 + 2);
    expect(block.size.computed).toBe("tiny");
    expect(block.speed.computed).toEqual({ walk: 10, fly: 40 });
    expect(block.armorClass.computed).toBe(14 + 2);
    expect(block.spellcasting).toEqual([
      expect.objectContaining({ class: { homebrewId: "c" }, ability: "cha" }),
    ]);
  });
});
