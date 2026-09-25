import {
  type CharacterDerived,
  type CharacterPageRecord,
  characterDefinitionSchema,
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

/** What `GET /characters/{id}/derived` returns for `characterRecord`'s Warlock, unarmored. */
export function derivedRecord(): CharacterDerived {
  const warlock = entryKey({ name: "Warlock", source: "XPHB" });
  return deriveCharacter(characterRecord("1", "Vex").definition, {
    hitDice: new Map([[warlock, 8]]),
    spellcastingAbilities: new Map([[warlock, "cha"]]),
    casterTables: new Map([
      [
        warlock,
        { progression: "pact", slots: [{ level: 1, total: 1 }], preparation: { printed: 2 } },
      ],
    ]),
    skills: [],
    size: "medium",
    speed: { walk: 30 },
    armor: new Map(),
  });
}
