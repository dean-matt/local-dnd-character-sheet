import {
  type CharacterDefinition,
  type CharacterDerived,
  type CharacterPageRecord,
  type CharacterRecord,
  type CharacterStateRecord,
  characterDefinitionSchema,
  defaultCharacterState,
  deriveCharacter,
  entryKey,
  PRESET_PAGES,
} from "@dnd/character";

/** What `GET /characters/{id}/pages` returns for a character nobody has edited. */
export const presetPageRecords = (): CharacterPageRecord[] =>
  PRESET_PAGES.map((page) => ({ ...page, preset: true }));

export function characterRecord(id: string, name: string) {
  return {
    id,
    name,
    edition: "one" as const,
    level: 1,
    raceSummary: "Half-Elf",
    classSummary: "Warlock",
    definition: characterDefinitionSchema.parse({
      name,
      edition: "one",
      levels: [{ class: { name: "Warlock", source: "XPHB" } }],
      race: { name: "Half-Elf", source: "XPHB" },
      background: { name: "Charlatan", source: "XPHB" },
      abilityScores: { str: 8, dex: 16, con: 14, int: 10, wis: 12, cha: 17 },
      proficiencies: {
        savingThrows: [],
        skills: [],
        armor: [],
        weapons: [],
        tools: [],
        languages: [],
      },
      inventory: [],
      spells: [],
    }),
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };
}

/** `characterRecord`'s Vex at Warlock 3, a Fiend Patron from the third level. */
export function warlockRecord(): CharacterRecord {
  const warlock = { name: "Warlock", source: "XPHB" };
  const record = characterRecord("1", "Vex");
  return {
    ...record,
    level: 3,
    definition: {
      ...record.definition,
      levels: [
        { class: warlock },
        { class: warlock },
        { class: warlock, subclass: { name: "Fiend Patron", source: "XPHB" } },
      ],
    },
  };
}

/**
 * `characterRecord`'s Vex as a Warlock 2 / Fighter 1 High Elf, with something in every
 * proficiency list, an alignment and notes.
 */
export function identityRecord(): CharacterRecord {
  const base = characterRecord("1", "Vex");
  const warlock = { class: { name: "Warlock", source: "XPHB" } };
  return {
    ...base,
    definition: characterDefinitionSchema.parse({
      ...base.definition,
      levels: [
        warlock,
        { class: { name: "Fighter", source: "XPHB" } },
        { ...warlock, subclass: { name: "Fiend Patron", source: "XPHB" } },
      ],
      race: { name: "Elf", source: "XPHB" },
      subrace: { name: "High", source: "XPHB" },
      proficiencies: {
        ...base.definition.proficiencies,
        armor: ["Light", "Shield"],
        weapons: ["Simple", "Light"],
        tools: [
          { name: "Thieves' Tools", level: "expertise" },
          { name: "Herbalism Kit", level: "proficient" },
          { name: "Dice Set", level: "none" },
        ],
        languages: [
          { name: "Common", source: "XPHB" },
          { name: "Elvish", source: "XPHB" },
        ],
      },
      alignment: "Chaotic Good",
      notes: "Owes Sarth 10 gp.\nDo not trust the ferryman.",
    }),
  };
}

/**
 * What `GET /characters/{id}/derived` returns for `characterRecord`'s Warlock, unarmored,
 * or for `definition` read in that Warlock's catalog.
 */
export function derivedRecord(
  definition: CharacterDefinition = characterRecord("1", "Vex").definition,
): CharacterDerived {
  const warlock = entryKey({ name: "Warlock", source: "XPHB" });
  return deriveCharacter(definition, {
    hitDice: new Map([[warlock, 8]]),
    spellcastingAbilities: new Map([[warlock, "cha"]]),
    casterTables: new Map([
      [
        warlock,
        { progression: "pact", slots: [{ level: 1, total: 1 }], preparation: { printed: 2 } },
      ],
    ]),
    skills: [],
    sizes: ["medium"],
    speed: { walk: 30 },
    armor: new Map(),
    weights: new Map(),
    weapons: new Map(),
    raceDefenses: { resist: [], resistChoice: [], immune: [], conditionImmune: [], vulnerable: [] },
    itemDefenses: new Map(),
    itemAbilities: new Map(),
    itemBonuses: new Map(),
    itemAdvantages: new Map(),
    armorBurdens: new Map(),
    weaponMasteryKinds: new Map(),
  });
}

/** What `GET /characters/{id}/state` returns for a character nobody has played yet. */
export function stateRecord(): CharacterStateRecord {
  return {
    characterId: "1",
    state: defaultCharacterState(),
    updatedAt: "2024-01-01T00:00:00.000Z",
  };
}
