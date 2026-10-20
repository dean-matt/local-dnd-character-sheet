import type { HitDie } from "@dnd/rules";
import { describe, expect, it } from "vitest";
import {
  ABILITIES,
  type AmmunitionTrait,
  type ArmorBurdenTrait,
  type ArmorTrait,
  type CasterTable,
  type CharacterDefinition,
  type CharacterDerived,
  type ContainerTrait,
  carriedWeight,
  characterDefinitionSchema,
  characterDerivedSchema,
  deriveCharacter,
  derivedValue,
  type EntryRef,
  entryKey,
  type FeatGrantTrait,
  hitPointMaximum,
  type ItemAbilityTrait,
  type ItemAdvantageTrait,
  type ItemBonusTrait,
  type ItemDefenseTrait,
  type ItemSenseTrait,
  type ItemSkillTrait,
  itemKey,
  overrideKey,
  passiveSkill,
  type SenseGrant,
  type WeaponTrait,
} from "./index.ts";
import type { Ability } from "./refs.ts";
import { raceSummary } from "./summaries.ts";
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

const noEffects = {
  abilityCheck: 0,
  proficiencyBonus: 0,
  grantsProficiency: false,
  grantsLanguage: false,
};

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
  const noDefenses = {
    resist: [],
    resistChoice: [],
    immune: [],
    conditionImmune: [],
    vulnerable: [],
  };
  const noFeatGrants = {
    savingThrows: [],
    skills: [],
    expertise: [],
    tools: [],
    languages: [],
    armor: [],
    weapons: [],
    resist: [],
    immune: [],
    conditionImmune: [],
    senses: [] as SenseGrant[],
    offers: [],
  };
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

  /** The Warlock/Rogue fixture, with armor and a shield equipped and proficiency in both. */
  const equipped: CharacterDefinition = {
    ...definition,
    proficiencies: { ...definition.proficiencies, armor: ["Light", "Shields"] },
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
      [
        entryKey(STUDDED_LEATHER),
        { name: STUDDED_LEATHER.name, category: "light" as const, armorClass: 12 },
      ],
      [entryKey(SHIELD), { name: SHIELD.name, category: "shield" as const, armorClass: 2 }],
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
    raceSenses: [] as SenseGrant[],
    itemSenses: new Map<string, ItemSenseTrait>(),
    itemSkills: new Map<string, ItemSkillTrait>(),
    itemDefenses: new Map<string, ItemDefenseTrait>(),
    itemAbilities: new Map<string, ItemAbilityTrait>(),
    itemBonuses: new Map<string, ItemBonusTrait>(),
    itemAdvantages: new Map<string, ItemAdvantageTrait>(),
    armorBurdens: new Map<string, ArmorBurdenTrait>(),
    ammunition: new Map<string, AmmunitionTrait>(),
    containers: new Map<string, ContainerTrait>(),
    featGrants: new Map(),
    weaponMasteryKinds: new Map<string, number>(),
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

  it("adds a Monk's Wisdom to the unarmored base, and a manual armor class still wins", () => {
    const MONK = { name: "Monk", source: "XPHB" };
    const monk: CharacterDefinition = {
      ...definition,
      levels: [{ class: MONK }],
      inventory: [],
    };
    const withMonk = {
      ...catalog,
      hitDice: new Map([...hitDice, [entryKey(MONK), 8 as const]]),
    };
    const result = deriveCharacter(monk, withMonk);
    expect(result.armorClass).toEqual({
      computed: 14,
      manual: null,
      terms: [
        { label: "Armor", value: 10 },
        { label: "Dexterity", value: 3 },
        { label: "Unarmored Defense (Wisdom)", value: 1 },
      ],
    });
    const overridden = deriveCharacter({ ...monk, overrides: { armorClass: 20 } }, withMonk);
    expect(overridden.armorClass.manual).toBe(20);
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
      armor: new Map([
        [
          entryKey(homebrewArmor),
          { name: "Homebrew armor", category: "light" as const, armorClass: 11 },
        ],
      ]),
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

  it("reads every score through its increases, so a racial +2 moves the modifier and the save", () => {
    const raised = deriveCharacter(
      {
        ...equipped,
        abilityIncreases: [
          { ability: "str", amount: 2, grantedBy: "race" },
          { ability: "str", amount: 1, grantedBy: "background" },
        ],
      },
      catalog,
    );
    expect(raised.abilityModifiers.str.terms).toEqual([{ label: "Score 11", value: 0 }]);
    expect(raised.savingThrows.str.computed).toBe(0);
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
    expect(derived.carriedWeight).toBe(carriedWeight(equipped, catalog.weights, new Map()));
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

  describe("heavy encumbrance's disadvantage", () => {
    const carrying = (pounds: number) => ({
      ...catalog,
      weights: new Map([...catalog.weights, [entryKey(SHIELD), pounds]]),
    });
    const fromLoad = (definition: CharacterDefinition, pounds: number) =>
      deriveCharacter(definition, carrying(pounds)).rollEffects.computed.filter(
        (effect) => effect.source === "Heavily encumbered",
      );

    it("marks every Strength, Dexterity and Constitution check, save and attack", () => {
      const marked = fromLoad(equipped, 90);
      expect(marked).toHaveLength(9);
      expect(marked.every((effect) => effect.mode === "disadvantage")).toBe(true);
      expect(new Set(marked.map(({ roll, target }) => `${roll} ${target}`))).toEqual(
        new Set(
          ["check", "save", "attack"].flatMap((roll) =>
            ["str", "dex", "con"].map((ability) => `${roll} ${ability}`),
          ),
        ),
      );
    });

    it("marks nothing while merely encumbered, or where the table plays without the variant", () => {
      expect(fromLoad(equipped, 30)).toEqual([]);
      expect(fromLoad({ ...equipped, houseRules: {} }, 90)).toEqual([]);
    });
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

  describe("gear the character lacks proficiency with", () => {
    const HIDE = { name: "Hide Armor", source: "XPHB" };
    const gear = (equippedHide: boolean): CharacterDefinition => ({
      ...equipped,
      inventory: [
        ...equipped.inventory,
        { ref: LONGSWORD, quantity: 1, carried: false, equipped: false, attuned: false },
        { ref: HIDE, quantity: 1, carried: true, equipped: equippedHide, attuned: false },
      ],
    });
    const withHide = {
      ...catalog,
      weights: new Map([...catalog.weights, [entryKey(HIDE), 12]]),
      armor: new Map<string, ArmorTrait>([
        ...catalog.armor,
        [entryKey(HIDE), { name: HIDE.name, category: "medium" as const, armorClass: 12 }],
      ]),
    };

    it("names the proficiency each entry needs, equipped, carried or neither", () => {
      expect(deriveCharacter(gear(false), withHide).unproficientItems).toEqual([
        { entry: 4, requires: "Martial weapons" },
        { entry: 5, requires: "Medium armor" },
      ]);
      const shieldless = { ...equipped, proficiencies: definition.proficiencies };
      expect(deriveCharacter(shieldless, catalog).unproficientItems).toEqual([
        { entry: 3, requires: "Shields" },
      ]);
    });

    it("puts Strength and Dexterity rolls at disadvantage and stops casting while the armor is worn", () => {
      const worn = deriveCharacter(gear(true), withHide);
      const fromHide = worn.rollEffects.computed.filter((effect) => effect.source === HIDE.name);
      expect(
        new Set(fromHide.map(({ mode, roll, target }) => `${mode} ${roll} ${target}`)),
      ).toEqual(
        new Set(
          ["check", "save", "attack"].flatMap((roll) =>
            ["str", "dex"].map((ability) => `disadvantage ${roll} ${ability}`),
          ),
        ),
      );
      expect(fromHide).toHaveLength(6);
      expect(worn.castingBlockedBy).toEqual([HIDE.name]);

      const stowed = deriveCharacter(gear(false), withHide);
      expect(stowed.rollEffects.computed.some((effect) => effect.source === HIDE.name)).toBe(false);
      expect(stowed.castingBlockedBy).toEqual([]);
    });

    it("counts an armor the character is proficient with by name", () => {
      const ELVEN_CHAIN = { name: "Elven Chain", source: "DMG" };
      const worn = (armor: string[]): CharacterDefinition => ({
        ...equipped,
        proficiencies: { ...equipped.proficiencies, armor },
        inventory: [
          ...equipped.inventory,
          { ref: ELVEN_CHAIN, quantity: 1, carried: true, equipped: true, attuned: false },
        ],
      });
      const chain = {
        ...catalog,
        weights: new Map([...catalog.weights, [entryKey(ELVEN_CHAIN), 20]]),
        armor: new Map<string, ArmorTrait>([
          ...catalog.armor,
          [entryKey(ELVEN_CHAIN), { name: ELVEN_CHAIN.name, category: "medium", armorClass: 14 }],
        ]),
      };

      expect(deriveCharacter(worn(["Light", "Shields"]), chain).castingBlockedBy).toEqual([
        ELVEN_CHAIN.name,
      ]);
      const named = deriveCharacter(worn(["Light", "Shields", "Elven Chain"]), chain);
      expect(named.castingBlockedBy).toEqual([]);
      expect(named.unproficientItems).toEqual([]);
    });

    it("charges a shield as armor in a 2014 game and not in a 2024 one", () => {
      const untrained = { ...equipped, proficiencies: definition.proficiencies };
      const fromShield = (block: CharacterDerived) =>
        block.rollEffects.computed.filter((effect) => effect.source === "Shield");
      const one = deriveCharacter(untrained, catalog);
      expect(one.castingBlockedBy).toEqual([]);
      expect(fromShield(one)).toEqual([]);
      const classic = deriveCharacter({ ...untrained, edition: "classic" }, catalog);
      expect(classic.castingBlockedBy).toEqual(["Shield"]);
      expect(fromShield(classic)).toHaveLength(6);
    });
  });

  describe("an untrained shield's armor class", () => {
    const untrained = { ...equipped, proficiencies: definition.proficiencies };
    const shieldTerms = (block: CharacterDerived) =>
      block.armorClass.terms.filter((term) => term.label.startsWith("Shield"));

    it("adds no bonus in a 2024 game and says why", () => {
      const trained = deriveCharacter(equipped, catalog).armorClass;
      const block = deriveCharacter(untrained, catalog).armorClass;
      expect(block.computed).toBe(trained.computed - 2);
      expect(shieldTerms(deriveCharacter(untrained, catalog))).toEqual([
        { label: "Shield (not proficient)", value: 0, reference: SHIELD },
      ]);
    });

    it("keeps the bonus in a 2014 game and for a proficient 2024 character", () => {
      const classic = deriveCharacter({ ...untrained, edition: "classic" }, catalog);
      expect(shieldTerms(classic)).toEqual([{ label: "Shield", value: 2, reference: SHIELD }]);
      expect(shieldTerms(deriveCharacter(equipped, catalog))).toEqual([
        { label: "Shield", value: 2, reference: SHIELD },
      ]);
    });
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
        critThreshold: { computed: 20, manual: null, terms: [{ label: "Base", value: 20 }] },
        damage: {
          dice: "1d4",
          type: "piercing",
          modifier: { computed: 3, manual: null, terms: [{ label: "Dexterity", value: 3 }] },
        },
        grip: null,
        mastery: [],
        range: null,
        ammunition: null,
        reload: null,
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

    it("says in the breakdown why a weapon the character lacks proficiency with adds none", () => {
      expect(attackOf(deriveCharacter(withSword(), catalog), 2)?.attackBonus).toEqual({
        computed: -1,
        manual: null,
        terms: [
          { label: "Strength", value: -1 },
          { label: "Not proficient", value: 0 },
        ],
      });
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

  describe("weapon mastery", () => {
    const TOPPLE = { name: "Topple", source: "XPHB" };
    const FIGHTER = { name: "Fighter", source: "XPHB" };
    const mastered = {
      ...catalog,
      weapons: new Map([
        ...catalog.weapons,
        [entryKey(LONGSWORD), { ...LONGSWORD_TRAIT, mastery: [TOPPLE] }],
        [
          entryKey({ name: "Dagger", source: "XPHB" }),
          { ...DAGGER_TRAIT, mastery: [{ name: "Nick", source: "XPHB" }] },
        ],
      ]),
    };
    const armed = (
      weaponMasteries: CharacterDefinition["weaponMasteries"],
      base: CharacterDefinition = equipped,
    ): CharacterDefinition => ({
      ...base,
      weaponMasteries,
      inventory: [
        ...base.inventory,
        { ref: LONGSWORD, quantity: 1, carried: true, equipped: true, attuned: false },
      ],
    });
    const masteryOf = (block: CharacterDerived, entry: number) =>
      block.attacks.find((attack) => attack.entry === entry)?.mastery;

    it("shows a chosen kind's mastery on its attack, whatever the casing of the name", () => {
      const block = deriveCharacter(armed([{ name: "longsword", source: "XPHB" }]), mastered);

      expect(masteryOf(block, 4)).toEqual([TOPPLE]);
      expect(masteryOf(block, 0)).toEqual([]);
    });

    it("shows none before a kind is chosen, or on a weapon with no mastery to show", () => {
      expect(masteryOf(deriveCharacter(armed([]), mastered), 4)).toEqual([]);
      expect(masteryOf(deriveCharacter(armed([LONGSWORD]), catalog), 4)).toEqual([]);
    });

    it("leaves a 2014 character with no mastery", () => {
      const classic = { ...armed([LONGSWORD]), edition: "classic" as const };
      const block = deriveCharacter(classic, {
        ...mastered,
        weaponMasteryKinds: new Map([[entryKey(FIGHTER), 3]]),
      });

      expect(masteryOf(block, 4)).toEqual([]);
      expect(block.weaponMasteryLimit.computed).toBe(0);
    });

    it("limits the kinds by what each class allows at its level, one term per class", () => {
      const multiclass: CharacterDefinition = {
        ...equipped,
        levels: [{ class: FIGHTER }, { class: ROGUE }, { class: FIGHTER }],
      };
      const block = deriveCharacter(multiclass, {
        ...catalog,
        hitDice: new Map([...hitDice, [entryKey(FIGHTER), 10 as const]]),
        weaponMasteryKinds: new Map([
          [entryKey(FIGHTER), 3],
          [entryKey(ROGUE), 2],
        ]),
      });

      expect(block.weaponMasteryLimit).toEqual({
        computed: 5,
        manual: null,
        terms: [
          { label: "Fighter", value: 3, reference: FIGHTER },
          { label: "Rogue", value: 2, reference: ROGUE },
        ],
      });
    });

    it("limits a character whose classes have no Weapon Mastery to none", () => {
      expect(deriveCharacter(equipped, catalog).weaponMasteryLimit.computed).toBe(0);
    });
  });

  describe("custom skills", () => {
    const withCustom = (
      customSkills: CharacterDefinition["customSkills"],
      overrides: CharacterDefinition["overrides"] = {},
    ) => deriveCharacter({ ...equipped, customSkills, overrides }, catalog);

    it("derives each from its ability and proficiency as a catalog skill is derived", () => {
      const block = withCustom([
        { name: "Juggling", ability: "dex", level: "expertise" },
        { name: "Cooking", ability: "wis", level: "none" },
      ]);

      expect(block.customSkills).toEqual([
        {
          name: "Juggling",
          ability: "dex",
          modifier: {
            computed: 9,
            manual: null,
            terms: [
              { label: "Dexterity", value: 3 },
              { label: "Proficiency", value: 6 },
            ],
          },
        },
        {
          name: "Cooking",
          ability: "wis",
          modifier: { computed: 1, manual: null, terms: [{ label: "Wisdom", value: 1 }] },
        },
      ]);
    });

    it("derives a flat skill from its value and proficiency, naming the value", () => {
      const block = withCustom([
        { name: "Cartography", flat: 3, level: "proficient" },
        { name: "Gambling", flat: -1, level: "none" },
      ]);

      expect(block.customSkills).toEqual([
        {
          name: "Cartography",
          ability: null,
          modifier: {
            computed: 6,
            manual: null,
            terms: [
              { label: "Flat bonus", value: 3 },
              { label: "Proficiency", value: 3 },
            ],
          },
        },
        {
          name: "Gambling",
          ability: null,
          modifier: { computed: -1, manual: null, terms: [{ label: "Flat bonus", value: -1 }] },
        },
      ]);
    });

    it("refuses a skill holding both an ability and a flat value", () => {
      const both = {
        ...definition,
        customSkills: [{ name: "Juggling", ability: "dex", flat: 2, level: "none" }],
      };

      expect(characterDefinitionSchema.safeParse(both).success).toBe(false);
    });

    it("reads a stored skill without a flat value as an ability skill", () => {
      const stored = {
        ...definition,
        customSkills: [{ name: "Juggling", ability: "dex", level: "none" }],
      };

      expect(characterDefinitionSchema.parse(stored).customSkills).toEqual(stored.customSkills);
    });

    it("folds an override keyed by the skill's name", () => {
      const block = withCustom([{ name: "Juggling", ability: "dex", level: "none" }], {
        "customSkills.Juggling.modifier": 7,
      });

      expect(block.customSkills[0]?.modifier).toMatchObject({ computed: 3, manual: 7 });
    });

    it("refuses two that differ only in case, since a name keys its override", () => {
      const twice = {
        ...definition,
        customSkills: [
          { name: "Juggling", ability: "dex", level: "none" },
          { name: "juggling", ability: "str", level: "none" },
        ],
      };

      expect(characterDefinitionSchema.safeParse(twice).success).toBe(false);
    });
  });

  describe("range and ammunition", () => {
    const ARROW = "arrow|phb";
    const SHORTBOW = { name: "Shortbow", source: "PHB" };
    const QUIVER = { name: "Arrows (20)", source: "PHB" };
    const LOOSE = { name: "Arrow", source: "PHB" };
    const bow = {
      ...LONGSWORD_TRAIT,
      range: { normal: 80, long: 320 },
      ammoType: ARROW,
      reload: 2,
    };
    const held = (ref: typeof SHORTBOW, quantity: number, carried = true) => ({
      ref,
      quantity,
      carried,
      equipped: false,
      attuned: false,
    });
    const archer = (...rest: ReturnType<typeof held>[]): CharacterDefinition => ({
      ...equipped,
      inventory: [{ ...held(SHORTBOW, 1), equipped: true }, ...rest],
    });
    const stocked = {
      ...catalog,
      weights: new Map<string, number | null>(
        [SHORTBOW, QUIVER, LOOSE, { name: "Energy Cell", source: "XDMG" }].map((ref) => [
          entryKey(ref),
          0,
        ]),
      ),
      weapons: new Map([[entryKey(SHORTBOW), bow]]),
      ammunition: new Map<string, AmmunitionTrait>([
        [entryKey(QUIVER), [{ uid: ARROW, count: 20 }]],
        [entryKey(LOOSE), [{ uid: ARROW, count: 1 }]],
      ]),
    };
    const shot = (definition: CharacterDefinition, catalogue = stocked) =>
      deriveCharacter(definition, catalogue).attacks[0];

    it("carries the range, the ammunition type and the reload from the weapon", () => {
      expect(shot(archer())).toMatchObject({
        range: { normal: 80, long: 320 },
        ammunition: { type: ARROW, carried: 0 },
        reload: 2,
      });
    });

    it("counts loose ammunition and a pack by its contents, times the quantity held", () => {
      expect(shot(archer(held(QUIVER, 2), held(LOOSE, 3)))?.ammunition?.carried).toBe(43);
    });

    it("skips ammunition that is not carried", () => {
      expect(shot(archer(held(QUIVER, 2, false), held(LOOSE, 3)))?.ammunition?.carried).toBe(3);
    });

    it("matches a type that names no source against any source", () => {
      const cell = { name: "Energy Cell", source: "XDMG" };
      const laser = { ...bow, ammoType: "energy cell" };
      const block = shot(archer(held(cell, 4)), {
        ...stocked,
        weapons: new Map([[entryKey(SHORTBOW), laser]]),
        ammunition: new Map([[entryKey(cell), [{ uid: "energy cell|xdmg", count: 1 }]]]),
      });

      expect(block?.ammunition?.carried).toBe(4);
    });

    it("leaves a weapon that states none with null for each", () => {
      expect(deriveCharacter(equipped, catalog).attacks[0]).toMatchObject({
        range: null,
        ammunition: null,
        reload: null,
      });
    });
  });

  describe("ability scores from items", () => {
    const BELT = { name: "Belt of Hill Giant Strength", source: "DMG" };
    const AMULET = { name: "Amulet of Health", source: "DMG" };
    const worn = (ref: EntryRef, flags: { equipped?: boolean; attuned?: boolean }) => ({
      ref,
      quantity: 1,
      carried: true,
      equipped: flags.equipped ?? false,
      attuned: flags.attuned ?? false,
    });
    const abilities = new Map<string, ItemAbilityTrait>([
      [
        entryKey(BELT),
        { name: BELT.name, requiresAttunement: false, static: { str: 21 }, bonus: {} },
      ],
      [
        entryKey(AMULET),
        { name: AMULET.name, requiresAttunement: true, static: { con: 19 }, bonus: {} },
      ],
    ]);
    const itemCatalog = {
      ...catalog,
      itemAbilities: abilities,
      weights: new Map([...catalog.weights, [entryKey(BELT), 0], [entryKey(AMULET), 0]]),
    };
    const withItems = (inventory: CharacterDefinition["inventory"]) =>
      deriveCharacter({ ...definition, inventory }, itemCatalog);

    it("raises a lower score to the item's, naming the item as the term", () => {
      const block = withItems([worn(BELT, { equipped: true })]);
      expect(block.abilityScores.str).toEqual({
        computed: 21,
        manual: null,
        terms: [
          { label: "Base", value: 8 },
          { label: BELT.name, value: 13 },
        ],
      });
      expect(block.abilityModifiers.str.computed).toBe(5);
      expect(block.carryingCapacity.computed).toBe(315);
    });

    it("leaves a higher score alone", () => {
      const strong = deriveCharacter(
        {
          ...definition,
          abilityScores: { ...definition.abilityScores, str: 22 },
          inventory: [worn(BELT, { equipped: true })],
        },
        itemCatalog,
      );
      expect(strong.abilityScores.str.terms).toEqual([{ label: "Base", value: 22 }]);
    });

    it("waits for equipping, and for attunement where the item requires it", () => {
      expect(withItems([worn(BELT, {})]).abilityScores.str.computed).toBe(8);
      expect(withItems([worn(AMULET, { equipped: true })]).abilityScores.con.computed).toBe(14);
      const attuned = withItems([worn(AMULET, { equipped: true, attuned: true })]);
      expect(attuned.abilityScores.con.computed).toBe(19);
      expect(attuned.savingThrows.con.computed).toBe(4);
      expect(attuned.hitPointMaximum.computed).toBeGreaterThan(
        withItems([]).hitPointMaximum.computed,
      );
    });

    describe("the per-level hit point house rule", () => {
      const PER_LEVEL = 2;
      const level = definition.levels.length;
      const attunedAmulet = [worn(AMULET, { equipped: true, attuned: true })];
      const houseRuled = (inventory: CharacterDefinition["inventory"], extra = {}) =>
        deriveCharacter(
          {
            ...definition,
            inventory,
            houseRules: { constitutionItemHitPointsPerLevel: PER_LEVEL },
            ...extra,
          },
          itemCatalog,
        );

      it("leaves the maximum as printed when the option is absent", () => {
        const printed = withItems(attunedAmulet).hitPointMaximum;
        expect(printed.terms.map((term) => term.label)).not.toContain(AMULET.name);
      });

      it("adds the amount for every level, as its own term named for the item", () => {
        const base = withItems(attunedAmulet).hitPointMaximum;
        const block = houseRuled(attunedAmulet).hitPointMaximum;
        expect(block.computed).toBe(base.computed + PER_LEVEL * level);
        expect(block.terms).toContainEqual({
          label: AMULET.name,
          value: PER_LEVEL * level,
          reference: { houseRuleOption: "constitutionItemHitPointsPerLevel" },
        });
      });

      it("adds nothing until the item is equipped, and attuned where it requires it", () => {
        const base = withItems([]).hitPointMaximum.computed;
        expect(houseRuled([]).hitPointMaximum.computed).toBe(base);
        expect(houseRuled([worn(AMULET, {})]).hitPointMaximum.computed).toBe(base);
        expect(houseRuled([worn(AMULET, { equipped: true })]).hitPointMaximum.computed).toBe(base);
      });

      it("adds nothing for an item that raises a score without setting Constitution", () => {
        const belt = [worn(BELT, { equipped: true })];
        expect(houseRuled(belt).hitPointMaximum.computed).toBe(
          withItems(belt).hitPointMaximum.computed,
        );
      });

      it("yields to a manual override", () => {
        const block = houseRuled(attunedAmulet, { overrides: { hitPointMaximum: 99 } });
        expect(derivedValue(block.hitPointMaximum)).toBe(99);
      });
    });

    it("keeps a manual override beside the computed score, which downstream numbers still read", () => {
      const overridden = deriveCharacter(
        {
          ...definition,
          inventory: [worn(BELT, { equipped: true })],
          overrides: { "abilityScores.str": 12 },
        },
        itemCatalog,
      );
      expect(overridden.abilityScores.str).toMatchObject({ computed: 21, manual: 12 });
      expect(overridden.abilityModifiers.str.computed).toBe(5);
    });
  });

  describe("an item whose ability score is a pick", () => {
    const DECK = { name: "Deck of Many Things", source: "DMG" };
    const choose = {
      from: ["str", "dex", "con", "int", "wis", "cha"] as const,
      count: 1,
      amount: 2,
    };
    const entry = (abilityPicks?: Ability[]) => ({
      ref: DECK,
      quantity: 1,
      carried: true,
      equipped: true,
      attuned: false,
      ...(abilityPicks && { abilityPicks }),
    });
    const pickCatalog = {
      ...catalog,
      weights: new Map([...catalog.weights, [entryKey(DECK), 0]]),
      itemAbilities: new Map<string, ItemAbilityTrait>([
        [
          entryKey(DECK),
          { name: DECK.name, requiresAttunement: false, static: {}, bonus: {}, choose },
        ],
      ]),
    };
    const withPicks = (abilityPicks?: Ability[]) =>
      deriveCharacter({ ...definition, inventory: [entry(abilityPicks)] }, pickCatalog);

    it("grants nothing until a pick is made, and says the entry waits on one", () => {
      const block = withPicks();
      expect(block.abilityScores.wis.computed).toBe(definition.abilityScores.wis);
      expect(block.pendingAbilityPicks).toEqual([{ entry: 0, from: choose.from, count: 1 }]);
    });

    it("raises the picked score as any item grant does, and a re-pick replaces it", () => {
      const first = withPicks(["wis"]);
      expect(first.abilityScores.wis.computed).toBe(definition.abilityScores.wis + 2);
      expect(first.abilityScores.wis.terms.at(-1)).toEqual({ label: DECK.name, value: 2 });
      expect(first.pendingAbilityPicks).toEqual([]);
      const again = withPicks(["str"]);
      expect(again.abilityScores.wis.computed).toBe(definition.abilityScores.wis);
      expect(again.abilityScores.str.computed).toBe(definition.abilityScores.str + 2);
    });

    it("counts only the picks the item offers, once each and no more than it allows", () => {
      const block = withPicks(["wis", "wis", "str"]);
      expect(block.abilityScores.wis.computed).toBe(definition.abilityScores.wis + 2);
      expect(block.abilityScores.str.computed).toBe(definition.abilityScores.str);
    });

    it("waits for equipping like any other grant", () => {
      const stowed = deriveCharacter(
        { ...definition, inventory: [{ ...entry(["wis"]), equipped: false }] },
        pickCatalog,
      );
      expect(stowed.abilityScores.wis.computed).toBe(definition.abilityScores.wis);
    });
  });

  describe("armor class and saves from items", () => {
    const noSpell = { spellAttack: 0, spellSaveDc: 0, spellDamage: 0, ...noEffects };
    const RING = { name: "Ring of Protection", source: "DMG" };
    const ORB = { name: "Orb of Skoraeus", source: "ToA" };
    const worn = (ref: EntryRef, flags: { equipped?: boolean; attuned?: boolean }) => ({
      ref,
      quantity: 1,
      carried: true,
      equipped: flags.equipped ?? false,
      attuned: flags.attuned ?? false,
    });
    const itemCatalog = {
      ...catalog,
      weights: new Map([...catalog.weights, [entryKey(RING), 0], [entryKey(ORB), 0]]),
      itemBonuses: new Map<string, ItemBonusTrait>([
        [
          entryKey(RING),
          {
            name: RING.name,
            requiresAttunement: true,
            ac: 1,
            save: 1,
            concentration: 0,
            ...noSpell,
          },
        ],
        [
          entryKey(ORB),
          {
            name: ORB.name,
            requiresAttunement: false,
            ac: 0,
            save: 0,
            concentration: 2,
            ...noSpell,
          },
        ],
      ]),
    };
    const withItems = (inventory: CharacterDefinition["inventory"]) =>
      deriveCharacter({ ...definition, inventory }, itemCatalog);
    const bare = withItems([]);

    it("adds a ring's bonus beside the armor, and to every save, as a term named for the item", () => {
      const block = withItems([worn(RING, { equipped: true, attuned: true })]);
      expect(block.armorClass.computed).toBe(bare.armorClass.computed + 1);
      expect(block.armorClass.terms.at(-1)).toEqual({ label: RING.name, value: 1 });
      for (const ability of ABILITIES) {
        expect(block.savingThrows[ability].computed).toBe(bare.savingThrows[ability].computed + 1);
        expect(block.savingThrows[ability].terms.at(-1)).toEqual({ label: RING.name, value: 1 });
      }
      expect(block.concentrationSave).toBeNull();
    });

    it("waits for equipping, and for attunement where the item requires it", () => {
      expect(withItems([worn(RING, { attuned: true })]).armorClass.computed).toBe(
        bare.armorClass.computed,
      );
      expect(withItems([worn(RING, { equipped: true })]).savingThrows.wis.computed).toBe(
        bare.savingThrows.wis.computed,
      );
    });

    it("adds a concentration bonus to the Constitution save and to no other save", () => {
      const block = withItems([worn(ORB, { equipped: true })]);
      expect(block.concentrationSave).toEqual({
        computed: bare.savingThrows.con.computed + 2,
        manual: null,
        terms: [...bare.savingThrows.con.terms, { label: ORB.name, value: 2 }],
      });
      expect(block.savingThrows.con.computed).toBe(bare.savingThrows.con.computed);
      expect(bare.concentrationSave).toBeNull();
    });

    it("keeps a manual override beside the computed value", () => {
      const block = deriveCharacter(
        {
          ...definition,
          inventory: [worn(RING, { equipped: true, attuned: true })],
          overrides: { armorClass: 20 },
        },
        itemCatalog,
      );
      expect(block.armorClass).toMatchObject({
        computed: bare.armorClass.computed + 1,
        manual: 20,
      });
    });
  });

  describe("spellcasting from items", () => {
    const WAND = { name: "Wand of the War Mage +2", source: "DMG" };
    const WOOD = { name: "Imbued Wood", source: "EFA" };
    const worn = (ref: EntryRef, flags: { equipped?: boolean; attuned?: boolean }) => ({
      ref,
      quantity: 1,
      carried: true,
      equipped: flags.equipped ?? false,
      attuned: flags.attuned ?? false,
    });
    const none = { ac: 0, save: 0, concentration: 0, ...noEffects };
    const itemCatalog = {
      ...catalog,
      weights: new Map([...catalog.weights, [entryKey(WAND), 0], [entryKey(WOOD), 0]]),
      itemBonuses: new Map<string, ItemBonusTrait>([
        [
          entryKey(WAND),
          {
            ...none,
            name: WAND.name,
            requiresAttunement: true,
            spellAttack: 2,
            spellSaveDc: 1,
            spellDamage: 0,
          },
        ],
        [
          entryKey(WOOD),
          {
            ...none,
            name: WOOD.name,
            requiresAttunement: false,
            spellAttack: 0,
            spellSaveDc: 0,
            spellDamage: 1,
          },
        ],
      ]),
    };
    const withItems = (inventory: CharacterDefinition["inventory"]) =>
      deriveCharacter({ ...definition, inventory }, itemCatalog);
    const bare = withItems([]);

    it("adds an attuned wand to each class's attack bonus and save DC as a term named for it", () => {
      const block = withItems([worn(WAND, { equipped: true, attuned: true })]);
      const [before] = bare.spellcasting;
      const [after] = block.spellcasting;
      expect(after?.attackBonus.computed).toBe((before?.attackBonus.computed ?? 0) + 2);
      expect(after?.attackBonus.terms.at(-1)).toEqual({ label: WAND.name, value: 2 });
      expect(after?.saveDc.computed).toBe((before?.saveDc.computed ?? 0) + 1);
      expect(after?.saveDc.terms.at(-1)).toEqual({ label: WAND.name, value: 1 });
      expect(block.spellDamageBonus).toBeNull();
    });

    it("waits for equipping, and for attunement where the item requires it", () => {
      expect(withItems([worn(WAND, { attuned: true })]).spellcasting).toEqual(bare.spellcasting);
      expect(withItems([worn(WAND, { equipped: true })]).spellcasting).toEqual(bare.spellcasting);
    });

    it("lists a damage bonus only while an item adds one", () => {
      expect(bare.spellDamageBonus).toBeNull();
      expect(withItems([worn(WOOD, { equipped: true })]).spellDamageBonus).toEqual({
        computed: 1,
        manual: null,
        terms: [{ label: WOOD.name, value: 1 }],
      });
    });

    it("keeps a manual override beside the computed bonus", () => {
      const block = deriveCharacter(
        {
          ...definition,
          inventory: [worn(WOOD, { equipped: true })],
          overrides: { spellDamageBonus: 3 },
        },
        itemCatalog,
      );
      expect(block.spellDamageBonus).toMatchObject({ computed: 1, manual: 3 });
    });
  });

  describe("traits from items", () => {
    const BOOTS = { name: "Boots of Speed", source: "DMG" };
    const CLOAK = { name: "Cloak of the Manta Ray", source: "DMG" };
    const PENNANT = { name: "Pennant of the Vind Rune", source: "FRHoF" };
    const MASTERY = { name: "Ioun Stone, Mastery", source: "DMG" };
    const LUCK = { name: "Stone of Good Luck", source: "DMG" };
    const BIB = { name: "Butcher's Bib", source: "EGW" };
    const BELT = { name: "Belt of Dwarvenkind", source: "DMG" };
    const BRACERS = { name: "Bracers of Archery", source: "DMG" };
    const KAS = { name: "Sword of Kas", source: "DMG" };
    const worn = (ref: EntryRef, attuned = true) => ({
      ref,
      quantity: 1,
      carried: true,
      equipped: true,
      attuned,
    });
    const trait = (
      ref: EntryRef & { name: string },
      effect: Partial<ItemBonusTrait>,
    ): [string, ItemBonusTrait] => [
      entryKey(ref),
      {
        name: ref.name,
        requiresAttunement: true,
        ac: 0,
        save: 0,
        concentration: 0,
        spellAttack: 0,
        spellSaveDc: 0,
        spellDamage: 0,
        ...noEffects,
        ...effect,
      },
    ];
    const items = [BOOTS, CLOAK, PENNANT, MASTERY, LUCK, BIB, BELT, BRACERS, KAS];
    const itemCatalog = {
      ...catalog,
      weights: new Map([...catalog.weights, ...items.map((ref) => [entryKey(ref), 0] as const)]),
      weapons: new Map<string, WeaponTrait>([
        ...catalog.weapons,
        [entryKey(KAS), { ...LONGSWORD_TRAIT, name: KAS.name }],
      ]),
      itemDefenses: new Map<string, ItemDefenseTrait>([
        [
          entryKey(BELT),
          { ...noDefenses, vulnerable: ["fire"], name: BELT.name, requiresAttunement: true },
        ],
      ]),
      itemBonuses: new Map<string, ItemBonusTrait>([
        trait(BOOTS, { speed: { multiply: { walk: 2 } } }),
        trait(CLOAK, { speed: { static: { swim: 60 }, equal: { fly: "walk" } } }),
        trait(PENNANT, { speed: { bonus: { "*": 5 } } }),
        trait(MASTERY, { proficiencyBonus: 1 }),
        trait(LUCK, { abilityCheck: 1, save: 1 }),
        trait(BIB, { critThreshold: 19 }),
        trait(KAS, { critThreshold: 19 }),
        trait(BELT, { grantsLanguage: true }),
        trait(BRACERS, { grantsProficiency: true }),
      ]),
    };
    const withItems = (inventory: CharacterDefinition["inventory"]) =>
      deriveCharacter(
        { ...equipped, inventory: [...equipped.inventory, ...inventory] },
        itemCatalog,
      );
    const bare = withItems([]);

    it("multiplies, sets and matches speeds, naming the item in each term", () => {
      const block = withItems([worn(BOOTS), worn(CLOAK)]);
      expect(block.speed.computed).toEqual({ walk: 60, swim: 60, fly: 60 });
      expect(block.speed.terms).toEqual([
        { label: "Boots of Speed: walk 30 to 60", value: 30 },
        { label: "Cloak of the Manta Ray: swim 0 to 60", value: 60 },
        { label: "Cloak of the Manta Ray: fly 0 to 60", value: 60 },
      ]);
    });

    it("adds a flat bonus to every speed the character has", () => {
      const block = withItems([worn(CLOAK), worn(PENNANT)]);
      expect(block.speed.computed).toEqual({ walk: 35, swim: 65, fly: 35 });
    });

    it("never lowers a speed a static or matching item sets", () => {
      const fast = { ...itemCatalog, speed: { walk: 40, swim: 80 } };
      const block = deriveCharacter({ ...equipped, inventory: [worn(CLOAK)] }, fast);
      expect(block.speed.computed).toEqual({ walk: 40, swim: 80, fly: 40 });
    });

    it("keeps the speed override beside the computed speeds", () => {
      const block = deriveCharacter(
        { ...equipped, inventory: [worn(BOOTS)], overrides: { speed: { walk: 10 } } },
        itemCatalog,
      );
      expect(block.speed).toMatchObject({ computed: { walk: 60 }, manual: { walk: 10 } });
    });

    it("lays a per-mode override over the computed speeds, so an untouched mode still moves", () => {
      const overrides = { "speed.fly": 20 };
      const bare = deriveCharacter({ ...equipped, overrides }, itemCatalog);
      const cloaked = deriveCharacter(
        { ...equipped, inventory: [worn(CLOAK)], overrides },
        itemCatalog,
      );
      expect(bare.speed.manual).toEqual({ ...bare.speed.computed, fly: 20 });
      expect(cloaked.speed.manual).toEqual({ ...cloaked.speed.computed, fly: 20 });
      expect(cloaked.speed.manual?.swim).toBe(60);
    });

    it("drops a refused or unknown mode alone, keeping the modes beside it", () => {
      const block = deriveCharacter(
        { ...equipped, overrides: { "speed.walk": 25, "speed.fly": -5, "speed.run": 40 } },
        itemCatalog,
      );
      expect(block.speed.manual).toEqual({ ...block.speed.computed, walk: 25 });
    });

    it("lays a per-mode override over a whole-speed one", () => {
      const block = deriveCharacter(
        { ...equipped, overrides: { speed: { walk: 10, swim: 5 }, "speed.walk": 25 } },
        itemCatalog,
      );
      expect(block.speed.manual).toEqual({ walk: 25, swim: 5 });
    });

    it("raises the proficiency bonus and everything it feeds, expertise doubling it", () => {
      const block = withItems([worn(MASTERY)]);
      expect(block.proficiencyBonus.computed).toBe(bare.proficiencyBonus.computed + 1);
      expect(block.proficiencyBonus.terms.at(-1)).toEqual({ label: MASTERY.name, value: 1 });
      const skill = (name: string) => block.skills.find((row) => row.ref.name === name);
      const before = (name: string) => bare.skills.find((row) => row.ref.name === name);
      expect(skill("Stealth")?.modifier.computed).toBe(
        (before("Stealth")?.modifier.computed ?? 0) + 2,
      );
      expect(skill("Stealth")?.modifier.terms.at(-1)).toEqual({ label: MASTERY.name, value: 2 });
      expect(skill("Stealth")?.passive.computed).toBe(
        (before("Stealth")?.passive.computed ?? 0) + 2,
      );
      expect(skill("Deception")?.modifier.computed).toBe(
        (before("Deception")?.modifier.computed ?? 0) + 1,
      );
      expect(skill("Perception")?.modifier).toEqual(before("Perception")?.modifier);
      const [after] = block.spellcasting;
      const [prior] = bare.spellcasting;
      expect(after?.saveDc.computed).toBe((prior?.saveDc.computed ?? 0) + 1);
      expect(after?.attackBonus.terms.at(-1)).toEqual({ label: MASTERY.name, value: 1 });
      expect(block.savingThrows.cha.computed).toBe(bare.savingThrows.cha.computed + 1);
      expect(block.savingThrows.str.computed).toBe(bare.savingThrows.str.computed);
    });

    it("adds an ability check bonus to every skill and to initiative, not to the modifiers", () => {
      const block = withItems([worn(LUCK)]);
      for (const [index, skill] of block.skills.entries()) {
        expect(skill.modifier.computed).toBe((bare.skills[index]?.modifier.computed ?? 0) + 1);
        expect(skill.modifier.terms.at(-1)).toEqual({ label: LUCK.name, value: 1 });
        expect(skill.passive.computed).toBe((bare.skills[index]?.passive.computed ?? 0) + 1);
      }
      expect(block.initiative.computed).toBe(bare.initiative.computed + 1);
      expect(block.abilityModifiers).toEqual(bare.abilityModifiers);
      const juggler = deriveCharacter(
        {
          ...equipped,
          inventory: [...equipped.inventory, worn(LUCK)],
          customSkills: [{ name: "Juggling", ability: "dex", level: "none" }],
        },
        itemCatalog,
      );
      expect(juggler.customSkills[0]?.modifier.terms.at(-1)).toEqual({
        label: LUCK.name,
        value: 1,
      });
    });

    it("lowers the critical threshold of every weapon attack and shows a plain 20 otherwise", () => {
      expect(bare.attacks.every((attack) => attack.critThreshold.computed === 20)).toBe(true);
      const block = withItems([worn(BIB)]);
      expect(block.attacks.length).toBeGreaterThan(0);
      for (const attack of block.attacks) {
        expect(attack.critThreshold.computed).toBe(19);
        expect(attack.critThreshold.terms).toEqual([
          { label: "Base", value: 20 },
          { label: BIB.name, value: -1 },
        ]);
      }
    });

    it("lowers a weapon item's threshold for its own attack alone", () => {
      const block = withItems([worn(KAS)]);
      const sword = block.attacks.find((attack) => attack.entry === equipped.inventory.length);
      expect(sword?.critThreshold.computed).toBe(19);
      const others = block.attacks.filter((attack) => attack !== sword);
      expect(others.length).toBeGreaterThan(0);
      expect(others.every((attack) => attack.critThreshold.computed === 20)).toBe(true);
    });

    it("lists an item's vulnerability", () => {
      const block = withItems([worn(BELT)]);
      expect(block.defenses.computed.vulnerabilities).toEqual([
        { name: "fire", from: [BELT.name] },
      ]);
    });

    describe("a proficiency or a language the item flags without naming", () => {
      const at = equipped.inventory.length;
      const DWARVISH = { name: "Dwarvish", source: "PHB" };

      it("grants nothing until the entry stores a pick, and says the grant waits on one", () => {
        const block = withItems([worn(BELT), worn(BRACERS)]);
        expect(block.itemGrants.computed).toEqual({
          skills: [],
          proficiencies: [],
          languages: [],
          pending: [
            { entry: at, item: BELT.name, kind: "language" },
            { entry: at + 1, item: BRACERS.name, kind: "proficiency" },
          ],
        });
      });

      it("lists the picked language and proficiency with the item as the source", () => {
        const block = withItems([
          { ...worn(BELT), languagePick: DWARVISH },
          { ...worn(BRACERS), proficiencyPick: "Longbow" },
        ]);
        expect(block.itemGrants.computed).toEqual({
          skills: [],
          proficiencies: [{ name: "Longbow", from: BRACERS.name }],
          languages: [{ name: "Dwarvish", from: BELT.name }],
          pending: [],
        });
      });

      it("drops the pick again when the item is unequipped", () => {
        const stowed = withItems([
          { ...worn(BELT), languagePick: DWARVISH, equipped: false },
          { ...worn(BRACERS), proficiencyPick: "Longbow", equipped: false },
        ]);
        expect(stowed.itemGrants).toEqual(bare.itemGrants);
      });

      it("drops the pick when an item that needs attunement is not attuned", () => {
        const unattuned = withItems([{ ...worn(BELT, false), languagePick: DWARVISH }]);
        expect(unattuned.itemGrants).toEqual(bare.itemGrants);
      });
    });

    it("waits for equipping, and for attunement where the item requires it", () => {
      const idle = [
        worn(BOOTS, false),
        worn(MASTERY, false),
        worn(LUCK, false),
        worn(BIB, false),
        worn(BELT, false),
        worn(BRACERS, false),
      ];
      expect(withItems(idle)).toEqual({ ...bare, attacks: bare.attacks });
      const carried = items.map((ref) => ({ ...worn(ref), equipped: false }));
      expect(withItems(carried).speed).toEqual(bare.speed);
      expect(withItems(carried).itemGrants).toEqual(bare.itemGrants);
    });

    describe("skills", () => {
      const CAP = { name: "Cap of Watching", source: "HOMEBREW" };
      const MASK = { name: "Mask of Shadows", source: "HOMEBREW" };
      const skillItem = (
        ref: EntryRef & { name: string },
        skills: string[],
        expertise: string[],
        requiresAttunement = true,
      ): [string, ItemSkillTrait] => [
        entryKey(ref),
        { name: ref.name, requiresAttunement, skills, expertise },
      ];
      const skilled = {
        ...itemCatalog,
        weights: new Map([...itemCatalog.weights, [entryKey(CAP), 0], [entryKey(MASK), 0]]),
        itemSkills: new Map<string, ItemSkillTrait>([
          skillItem(CAP, ["perception"], ["perception"]),
          skillItem(MASK, [], ["stealth"], false),
        ]),
      };
      const trained = (...names: (typeof PERCEPTION)[]): CharacterDefinition => ({
        ...equipped,
        proficiencies: {
          ...equipped.proficiencies,
          skills: names.map((ref) => ({ ref, level: "proficient" as const })),
        },
      });
      const modifier = (block: CharacterDerived, name: string) =>
        block.skills.find((skill) => skill.ref.name === name)?.modifier.computed;
      const wearing = (definition: CharacterDefinition, ...entries: ReturnType<typeof worn>[]) =>
        deriveCharacter(
          { ...definition, inventory: [...definition.inventory, ...entries] },
          skilled,
        );

      it("grants proficiency while the item is worn, naming the item and not a feat", () => {
        const bare = wearing(trained());
        const block = wearing(trained(), worn(CAP));
        expect(modifier(block, "Perception")).toBe((modifier(bare, "Perception") ?? 0) + 3);
        expect(block.itemGrants.computed.skills).toEqual([
          { ref: PERCEPTION, level: "proficient", from: [CAP.name] },
        ]);
        expect(block.featGrants.computed.skills).toEqual([]);
      });

      it("raises the proficiency to expertise only where the wearer is proficient another way", () => {
        const block = wearing(trained(PERCEPTION), worn(CAP));
        expect(block.itemGrants.computed.skills).toEqual([
          { ref: PERCEPTION, level: "expertise", from: [CAP.name] },
        ]);
        expect(modifier(block, "Perception")).toBe(
          (modifier(wearing(trained(PERCEPTION)), "Perception") ?? 0) + 3,
        );
      });

      it("grants no expertise in a skill the wearer is not proficient in", () => {
        const block = wearing(trained(), worn(MASK));
        expect(block.itemGrants.computed.skills).toEqual([]);
        expect(modifier(block, "Stealth")).toBe(modifier(wearing(trained()), "Stealth"));
        const proficient = wearing(trained(STEALTH), worn(MASK));
        expect(proficient.itemGrants.computed.skills).toEqual([
          { ref: STEALTH, level: "expertise", from: [MASK.name] },
        ]);
      });

      it("counts proficiency another worn item grants toward expertise", () => {
        const block = wearing(trained(), worn(CAP), worn(MASK));
        expect(block.itemGrants.computed.skills.map((skill) => skill.ref.name)).toEqual([
          "Perception",
        ]);
        const both = {
          ...skilled,
          itemSkills: new Map<string, ItemSkillTrait>([
            skillItem(CAP, ["stealth"], []),
            skillItem(MASK, [], ["stealth"], false),
          ]),
        };
        const stacked = deriveCharacter(
          { ...trained(), inventory: [...equipped.inventory, worn(CAP), worn(MASK)] },
          both,
        );
        expect(stacked.itemGrants.computed.skills).toEqual([
          { ref: STEALTH, level: "expertise", from: [CAP.name, MASK.name] },
        ]);
      });

      it("leaves with the item when it is unequipped, or unattuned where it requires attunement", () => {
        const bare = wearing(trained());
        expect(wearing(trained(), { ...worn(CAP), equipped: false })).toEqual(bare);
        expect(wearing(trained(), worn(CAP, false)).itemGrants).toEqual(bare.itemGrants);
        expect(
          wearing(trained(STEALTH), worn(MASK, false)).itemGrants.computed.skills,
        ).toHaveLength(1);
      });
    });

    it("keeps the proficiency bonus override beside the computed value", () => {
      const block = deriveCharacter(
        { ...equipped, inventory: [worn(MASTERY)], overrides: { proficiencyBonus: 9 } },
        itemCatalog,
      );
      expect(block.proficiencyBonus).toMatchObject({ computed: 4, manual: 9 });
    });
  });

  describe("armor's Stealth penalty and Strength requirement", () => {
    const PLATE = { name: "Plate Armor", source: "XPHB" };
    const MITHRAL = { name: "Mithral Armor", source: "DMG" };
    const burdens = new Map<string, ArmorBurdenTrait>([
      [
        entryKey(PLATE),
        { name: PLATE.name, requiresAttunement: false, stealth: true, strength: 15 },
      ],
      [
        entryKey(MITHRAL),
        { name: MITHRAL.name, requiresAttunement: true, stealth: true, strength: 13 },
      ],
    ]);
    const entry = (ref: EntryRef, flags: { equipped?: boolean; attuned?: boolean } = {}) => ({
      ref,
      quantity: 1,
      carried: true,
      equipped: flags.equipped ?? true,
      attuned: flags.attuned ?? false,
    });
    const withBurdens = {
      ...catalog,
      armorBurdens: burdens,
      armor: new Map<string, ArmorTrait>(),
      weights: new Map([...catalog.weights, [entryKey(PLATE), 65], [entryKey(MITHRAL), 20]]),
    };
    const derive = (inventory: CharacterDefinition["inventory"], abilityScores = {}) =>
      deriveCharacter(
        {
          ...definition,
          inventory,
          abilityScores: { ...definition.abilityScores, ...abilityScores },
        },
        withBurdens,
      );

    it("marks Stealth with disadvantage, naming the armor, while it is worn", () => {
      expect(derive([entry(PLATE)]).rollEffects.computed).toEqual([
        { source: PLATE.name, mode: "disadvantage", roll: "skill", target: "Stealth" },
      ]);
      expect(derive([entry(PLATE, { equipped: false })]).rollEffects.computed).toEqual([]);
    });

    it("cuts walking speed by 10 feet below the required Strength, as a term naming the armor", () => {
      const slowed = derive([entry(PLATE)], { str: 14 }).speed;
      expect(slowed.computed.walk).toBe(20);
      expect(slowed.terms).toEqual([{ label: "Plate Armor: Strength 15 required", value: -10 }]);
    });

    it("leaves speed alone at or above the required Strength", () => {
      expect(derive([entry(PLATE)], { str: 15 }).speed.terms).toEqual([]);
      expect(derive([entry(PLATE)], { str: 15 }).speed.computed.walk).toBe(30);
    });

    it("waits for attunement where the armor requires it", () => {
      const unattuned = derive([entry(MITHRAL)], { str: 8 });
      expect(unattuned.speed.computed.walk).toBe(30);
      expect(unattuned.rollEffects.computed).toEqual([]);
      const attuned = derive([entry(MITHRAL, { attuned: true })], { str: 8 });
      expect(attuned.speed.computed.walk).toBe(20);
      expect(attuned.rollEffects.computed).toHaveLength(1);
    });

    it("never takes walking speed below zero", () => {
      const slow = { ...withBurdens, speed: { walk: 5 } };
      const block = deriveCharacter({ ...definition, inventory: [entry(PLATE)] }, slow);
      expect(block.speed.computed.walk).toBe(0);
      expect(block.speed.terms).toEqual([
        { label: "Plate Armor: Strength 15 required", value: -5 },
      ]);
    });
  });

  describe("advantage and disadvantage from items", () => {
    const MANTLE = { name: "Mantle of Spell Resistance", source: "DMG" };
    const BOOTS_OF_ELVENKIND = { name: "Boots of Elvenkind", source: "DMG" };
    const advantages = new Map<string, ItemAdvantageTrait>([
      [
        entryKey(MANTLE),
        {
          name: MANTLE.name,
          requiresAttunement: true,
          effects: [{ mode: "advantage", roll: "save", condition: "against spells" }],
        },
      ],
      [
        entryKey(BOOTS_OF_ELVENKIND),
        {
          name: BOOTS_OF_ELVENKIND.name,
          requiresAttunement: false,
          effects: [{ mode: "advantage", roll: "skill", target: "Stealth" }],
        },
      ],
    ]);
    const entry = (ref: EntryRef, flags: { equipped?: boolean; attuned?: boolean }) => ({
      ref,
      quantity: 1,
      carried: true,
      equipped: flags.equipped ?? false,
      attuned: flags.attuned ?? false,
    });
    const effectsOf = (inventory: CharacterDefinition["inventory"], overrides = {}) =>
      deriveCharacter(
        { ...equipped, inventory, overrides },
        {
          ...catalog,
          weights: new Map([
            ...catalog.weights,
            ...[...advantages.keys()].map((key) => [key, 0] as const),
          ]),
          itemAdvantages: advantages,
        },
      ).rollEffects;

    it("lists each effect of an equipped, attuned item beside the item that grants it", () => {
      const worn = [
        entry(MANTLE, { equipped: true, attuned: true }),
        entry(BOOTS_OF_ELVENKIND, { equipped: true }),
      ];
      expect(effectsOf(worn).computed).toEqual([
        { source: MANTLE.name, mode: "advantage", roll: "save", condition: "against spells" },
        { source: BOOTS_OF_ELVENKIND.name, mode: "advantage", roll: "skill", target: "Stealth" },
      ]);
    });

    it("waits for equipping, and for attunement where the item requires it", () => {
      expect(effectsOf([entry(MANTLE, { attuned: true })]).computed).toEqual([]);
      expect(effectsOf([entry(MANTLE, { equipped: true })]).computed).toEqual([]);
      expect(effectsOf([entry(BOOTS_OF_ELVENKIND, { attuned: true })]).computed).toEqual([]);
      expect(effectsOf([entry(BOOTS_OF_ELVENKIND, { equipped: true })]).computed).toHaveLength(1);
    });

    it("lists nothing for an item the mapping does not name", () => {
      expect(effectsOf([entry(LONGSWORD, { equipped: true, attuned: true })]).computed).toEqual([]);
    });

    it("keeps an override beside the computed list", () => {
      const field = effectsOf([entry(BOOTS_OF_ELVENKIND, { equipped: true })], {
        rollEffects: [],
      });
      expect(field.computed).toHaveLength(1);
      expect(field.manual).toEqual([]);
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
            vulnerable: [],
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
            vulnerable: [],
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
        vulnerabilities: [],
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

  describe("senses", () => {
    const GOGGLES = { name: "Goggles of Night", source: "DMG" };
    const HELM = { name: "Helm of Devil's Sight", source: "HB" };
    const FIGHTING = { name: "Blind Fighting", source: "XPHB" };
    const worn = (ref: EntryRef, flags: { attuned?: boolean } = {}) => ({
      ref,
      quantity: 1,
      carried: true,
      equipped: true,
      attuned: flags.attuned ?? false,
    });
    const senseCatalog: typeof catalog = {
      ...catalog,
      weights: new Map([...catalog.weights, [entryKey(GOGGLES), 0], [entryKey(HELM), 0]]),
      raceSenses: [{ name: "darkvision", range: 60 }],
      itemSenses: new Map<string, ItemSenseTrait>([
        [
          entryKey(GOGGLES),
          {
            name: GOGGLES.name,
            requiresAttunement: false,
            senses: [{ name: "darkvision", range: 60 }],
          },
        ],
        [
          entryKey(HELM),
          {
            name: HELM.name,
            requiresAttunement: true,
            senses: [
              { name: "darkvision", range: 120 },
              { name: "truesight", range: 10 },
            ],
          },
        ],
      ]),
      featGrants: new Map([
        [
          entryKey(FIGHTING),
          {
            ...noFeatGrants,
            name: FIGHTING.name,
            senses: [{ name: "blindsight" as const, range: 10 }],
          },
        ],
      ]),
    };
    const sensesOf = (
      inventory: CharacterDefinition["inventory"],
      feats: CharacterDefinition["feats"] = [],
    ) => deriveCharacter({ ...equipped, inventory, feats }, senseCatalog).senses.computed;

    it("lists the race's sense, citing the race", () => {
      expect(sensesOf([])).toEqual([
        { name: "darkvision", range: 60, from: [raceSummary(equipped)] },
      ]);
    });

    it("lists a feat's sense, in the order senses are listed", () => {
      expect(sensesOf([], [{ ref: FIGHTING }])).toEqual([
        { name: "blindsight", range: 10, from: ["Blind Fighting"] },
        { name: "darkvision", range: 60, from: [raceSummary(equipped)] },
      ]);
    });

    it("keeps the longer range where two sources grant one sense, and names both", () => {
      expect(sensesOf([worn(GOGGLES), worn(HELM, { attuned: true })])).toEqual([
        {
          name: "darkvision",
          range: 120,
          from: [raceSummary(equipped), GOGGLES.name, HELM.name],
        },
        { name: "truesight", range: 10, from: [HELM.name] },
      ]);
    });

    it("waits on attunement and on being equipped", () => {
      expect(sensesOf([worn(HELM)]).map(({ name }) => name)).toEqual(["darkvision"]);
      expect(sensesOf([{ ...worn(GOGGLES), equipped: false }]).map(({ from }) => from)).toEqual([
        [raceSummary(equipped)],
      ]);
    });
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

    it("names a slot override by its slot level, the key overrideKey builds", () => {
      const key = `${overrideKey("spellSlots", { level: 1, total: { computed: 2, manual: null, terms: [] } }, caster(WIZARD))}.total`;
      expect(key).toBe("spellSlots.1.total");
      const block = deriveCharacter(
        { ...caster(WIZARD), overrides: { [key]: 4 } },
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

  describe("feat bonuses stated only in prose", () => {
    const withFeats = (...refs: EntryRef[]) =>
      deriveCharacter(
        { ...equipped, feats: [...equipped.feats, ...refs.map((ref) => ({ ref }))] },
        catalog,
      );
    const ALERT_2014 = { name: "Alert", source: "PHB" };
    const ALERT_2024 = { name: "Alert", source: "XPHB" };
    const TOUGH = { name: "Tough", source: "XPHB" };

    it("adds 5 initiative for the 2014 Alert and the proficiency bonus for the 2024 one", () => {
      expect(derived.initiative.computed).toBe(3);
      expect(withFeats(ALERT_2014).initiative.computed).toBe(8);
      expect(withFeats(ALERT_2024).initiative.terms).toContainEqual({
        label: "Alert",
        value: 3,
        reference: ALERT_2024,
      });
      expect(withFeats(ALERT_2024).initiative.computed).toBe(6);
    });

    it("adds 2 hit points per character level for Tough, and follows a level-up", () => {
      expect(withFeats(TOUGH).hitPointMaximum.computed).toBe(derived.hitPointMaximum.computed + 10);
      const fighter = { name: "Fighter", source: "XPHB" };
      const leveled = deriveCharacter(
        {
          ...equipped,
          levels: [...equipped.levels, { class: fighter }],
          feats: [...equipped.feats, { ref: TOUGH }],
        },
        { ...catalog, hitDice: new Map([...hitDice, [entryKey(fighter), 10 as const]]) },
      );
      expect(leveled.hitPointMaximum.terms).toContainEqual({
        label: "Tough",
        value: 12,
        reference: TOUGH,
      });
    });

    it("adds 10 feet of walking speed for Mobile and for Speedy", () => {
      expect(withFeats({ name: "Mobile", source: "PHB" }).speed.computed).toEqual({ walk: 40 });
      expect(withFeats({ name: "Speedy", source: "XPHB" }).speed.computed).toEqual({ walk: 40 });
    });

    it("counts a feat listed twice once, and ignores a homebrew feat", () => {
      expect(withFeats(ALERT_2014, ALERT_2014).initiative.computed).toBe(8);
      expect(withFeats({ homebrewId: "hb_alert" }).initiative.computed).toBe(3);
    });

    it("adds a Swashbuckler's Charisma modifier to initiative from level 3", () => {
      const swashbuckler = (count: number) =>
        deriveCharacter(
          {
            ...equipped,
            levels: Array.from({ length: count }, (_, index) => ({
              class: ROGUE,
              ...(index === 2 ? { subclass: { name: "Swashbuckler", source: "XGE" } } : {}),
            })),
          },
          catalog,
        );
      expect(swashbuckler(3).initiative.terms).toContainEqual({
        label: "Rakish Audacity (Charisma)",
        value: 3,
        reference: { name: "Rakish Audacity", source: "XGE" },
      });
      expect(swashbuckler(3).initiative.computed).toBe(6);
      expect(swashbuckler(2).initiative.computed).toBe(3);
    });

    it("yields to a manual override of each stat", () => {
      const block = deriveCharacter(
        {
          ...equipped,
          feats: [{ ref: ALERT_2014 }, { ref: TOUGH }, { ref: { name: "Mobile", source: "PHB" } }],
          overrides: { initiative: 1, hitPointMaximum: 20, speed: { walk: 25 } },
        },
        catalog,
      );
      expect(derivedValue(block.initiative)).toBe(1);
      expect(derivedValue(block.hitPointMaximum)).toBe(20);
      expect(derivedValue(block.speed)).toEqual({ walk: 25 });
    });
  });

  describe("what feats grant through their fields", () => {
    const none = noFeatGrants;
    const ARMORED = { name: "Moderately Armored", source: "PHB" };
    const RESILIENT = { name: "Resilient", source: "XPHB" };
    const EXPERT = { name: "Skill Expert", source: "XPHB" };
    const ANATOMY = { name: "Aberrant Anatomy", source: "RHW" };
    const INFERNAL = { name: "Infernal Constitution", source: "XPHB" };
    const BOON = { name: "Boon of Energy Resistance", source: "XPHB" };
    const traits: [EntryRef, FeatGrantTrait][] = [
      [ARMORED, { ...none, name: ARMORED.name, armor: ["medium", "shield"] }],
      [
        RESILIENT,
        {
          ...none,
          name: RESILIENT.name,
          offers: [{ fields: ["savingThrows"], count: 1, from: ["con", "dex"] }],
        },
      ],
      [
        EXPERT,
        {
          ...none,
          name: EXPERT.name,
          tools: ["cook's utensils"],
          languages: ["sylvan"],
          offers: [
            { fields: ["skills"], count: 1, from: null },
            { fields: ["expertise"], count: 1, from: null },
          ],
        },
      ],
      [ANATOMY, { ...none, name: ANATOMY.name, skills: ["perception"], expertise: ["perception"] }],
      [INFERNAL, { ...none, name: INFERNAL.name, resist: ["cold"], conditionImmune: ["poisoned"] }],
      [
        BOON,
        {
          ...none,
          name: BOON.name,
          offers: [{ fields: ["resist"], count: 2, from: ["acid", "cold", "fire"] }],
        },
      ],
    ];
    const featCatalog = {
      ...catalog,
      featGrants: new Map(traits.map(([ref, trait]) => [entryKey(ref), trait])),
    };
    type Feat = CharacterDefinition["feats"][number];
    const withFeats = (feats: Feat[], base: CharacterDefinition = equipped) =>
      deriveCharacter({ ...base, feats }, featCatalog);

    it("adds a feat's armor to what the gear is checked against, until the feat goes", () => {
      const HIDE = { name: "Hide Armor", source: "XPHB" };
      const hidebound = {
        ...featCatalog,
        weights: new Map([...catalog.weights, [entryKey(HIDE), 12]]),
        armor: new Map<string, ArmorTrait>([
          ...catalog.armor,
          [entryKey(HIDE), { name: HIDE.name, category: "medium" as const, armorClass: 12 }],
        ]),
      };
      const worn = {
        ...equipped,
        inventory: [
          ...equipped.inventory,
          { ref: HIDE, quantity: 1, carried: true, equipped: false, attuned: false },
        ],
      };
      const armored = deriveCharacter({ ...worn, feats: [{ ref: ARMORED }] }, hidebound);
      expect(armored.unproficientItems).toEqual([]);
      expect(armored.featGrants.computed.armor).toEqual([
        { name: "medium", from: [ARMORED.name] },
        { name: "shield", from: [ARMORED.name] },
      ]);
      expect(deriveCharacter(worn, hidebound).unproficientItems).toEqual([
        { entry: 4, requires: "Medium armor" },
      ]);
    });

    it("adds the saving throw picked from those the feat offers, and nothing else", () => {
      const picked = (savingThrows: ("con" | "str")[]) =>
        withFeats([{ ref: RESILIENT, picks: { savingThrows } }]);
      expect(picked(["con"]).savingThrows.con.computed).toBe(derived.savingThrows.con.computed + 3);
      expect(picked(["con"]).featGrants.computed.savingThrows).toEqual([
        { name: "con", from: [RESILIENT.name] },
      ]);
      expect(picked(["str"]).savingThrows.str.computed).toBe(derived.savingThrows.str.computed);
      expect(withFeats([{ ref: RESILIENT }]).featGrants.computed.savingThrows).toEqual([]);
    });

    it("grants a picked skill, and expertise only in a skill already proficient", () => {
      const perception = (block: CharacterDerived) =>
        block.skills.find((skill) => skill.ref.name === "Perception")?.modifier.computed;
      const expert = withFeats([
        { ref: EXPERT, picks: { skills: ["perception"], expertise: ["deception"] } },
      ]);
      expect(perception(expert)).toBe(4);
      expect(expert.featGrants.computed.skills).toEqual([
        { ref: PERCEPTION, level: "proficient", from: [EXPERT.name] },
        { ref: DECEPTION, level: "expertise", from: [EXPERT.name] },
      ]);
      expect(expert.featGrants.computed.tools).toEqual([
        { name: "cook's utensils", from: [EXPERT.name] },
      ]);
      expect(expert.featGrants.computed.languages).toEqual([
        { name: "sylvan", from: [EXPERT.name] },
      ]);
      const unproficient = withFeats([{ ref: EXPERT, picks: { expertise: ["perception"] } }]);
      expect(perception(unproficient)).toBe(1);
      expect(unproficient.featGrants.computed.skills).toEqual([]);
    });

    it("grants expertise in a skill the feat also grants only where something else gave it first", () => {
      const perception = (block: CharacterDerived) =>
        block.featGrants.computed.skills.find((skill) => skill.ref.name === "Perception")?.level;
      expect(perception(withFeats([{ ref: ANATOMY }]))).toBe("proficient");
      const trained: CharacterDefinition = {
        ...equipped,
        proficiencies: {
          ...equipped.proficiencies,
          skills: [{ ref: PERCEPTION, level: "proficient" }],
        },
      };
      expect(perception(withFeats([{ ref: ANATOMY }], trained))).toBe("expertise");
    });

    it("counts expertise stepped up from a feat's proficiency only while the feat grants it", () => {
      const perception = (block: CharacterDerived) =>
        block.skills.find((skill) => skill.ref.name === "Perception")?.modifier.computed;
      const holding = (skill: CharacterDefinition["proficiencies"]["skills"][number]) => ({
        ...equipped,
        proficiencies: { ...equipped.proficiencies, skills: [skill] },
      });
      const overGrant = holding({ ref: PERCEPTION, level: "expertise", onGrant: true });
      const feat = [{ ref: EXPERT, picks: { skills: ["perception"] } }];
      expect(perception(withFeats(feat, overGrant))).toBe(7);
      expect(perception(withFeats([], overGrant))).toBe(1);
      expect(perception(withFeats([], holding({ ref: PERCEPTION, level: "expertise" })))).toBe(7);
    });

    it("cites each feat for the defenses it grants and the resistances picked, up to its count", () => {
      const block = withFeats([
        { ref: INFERNAL },
        { ref: BOON, picks: { resist: ["cold", "lightning", "acid", "fire"] } },
      ]);
      expect(block.defenses.computed.resistances).toEqual([
        { name: "cold", from: [INFERNAL.name, BOON.name] },
        { name: "acid", from: [BOON.name] },
      ]);
      expect(block.defenses.computed.conditionImmunities).toEqual([
        { name: "poisoned", from: [INFERNAL.name] },
      ]);
    });

    it("raises scores by what a feat taken outside an improvement placed", () => {
      const block = withFeats([
        {
          ref: RESILIENT,
          picks: { savingThrows: ["con"], ability: [{ ability: "con", amount: 1 }] },
        },
      ]);
      expect(block.abilityScores.con.terms).toContainEqual({ label: RESILIENT.name, value: 1 });
      expect(block.abilityScores.con.computed).toBe(derived.abilityScores.con.computed + 1);
      expect(
        characterDefinitionSchema.safeParse({
          ...equipped,
          feats: [
            { ref: RESILIENT, level: 4, picks: { ability: [{ ability: "con", amount: 1 }] } },
          ],
        }).success,
      ).toBe(false);
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

    it("folds an override under the key overrideKey names for a list element", () => {
      const [attack] = derived.attacks;
      if (!attack) throw new Error("expected an attack");
      const block = withOverrides({
        [`${overrideKey("attacks", attack, equipped)}.attackBonus`]: 9,
      });

      expect(block.attacks[0]?.attackBonus.manual).toBe(9);
    });

    it("folds every key shape the sheet writes into the field it names", () => {
      const definition = {
        ...equipped,
        customSkills: [{ name: "Juggling", ability: "dex" as const, level: "none" as const }],
      };
      const base = deriveCharacter(definition, catalog);
      const [skill] = base.skills;
      const [custom] = base.customSkills;
      const [caster] = base.spellcasting;
      const [pool] = base.hitDice;
      const [attack] = base.attacks;
      if (!skill || !custom || !caster || !pool || !attack || !base.pactSlots) {
        throw new Error("expected every list the sheet overrides to hold an element");
      }
      const at = (list: Parameters<typeof overrideKey>[0], element: unknown, field: string) =>
        `${overrideKey(list, element as never, definition)}.${field}`;
      const cases: [string, (block: CharacterDerived) => unknown][] = [
        ["abilityScores.str", (block) => block.abilityScores.str?.manual],
        ["abilityModifiers.dex", (block) => block.abilityModifiers.dex?.manual],
        ["savingThrows.wis", (block) => block.savingThrows.wis?.manual],
        ["proficiencyBonus", (block) => block.proficiencyBonus.manual],
        ["hitPointMaximum", (block) => block.hitPointMaximum.manual],
        ["carryingCapacity", (block) => block.carryingCapacity.manual],
        ["attunementSlots", (block) => block.attunementSlots.manual],
        ["weaponMasteryLimit", (block) => block.weaponMasteryLimit.manual],
        ["pactSlots.total", (block) => block.pactSlots?.total.manual],
        [at("skills", skill, "passive"), (block) => block.skills[0]?.passive.manual],
        [at("customSkills", custom, "modifier"), (block) => block.customSkills[0]?.modifier.manual],
        [at("spellcasting", caster, "saveDc"), (block) => block.spellcasting[0]?.saveDc.manual],
        [at("hitDice", pool, "total"), (block) => block.hitDice[0]?.total.manual],
        [at("attacks", attack, "critThreshold"), (block) => block.attacks[0]?.critThreshold.manual],
        [
          at("attacks", attack, "damage.modifier"),
          (block) => block.attacks[0]?.damage?.modifier.manual,
        ],
      ];
      for (const [key, read] of cases) {
        const block = deriveCharacter({ ...definition, overrides: { [key]: 3 } }, catalog);
        expect(read(block), key).toBe(3);
      }
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
