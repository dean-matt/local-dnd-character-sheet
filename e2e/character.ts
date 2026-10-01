import { type APIRequestContext, expect } from "@playwright/test";

/** Posts a level 1 Warlock named `name` and returns its id. */
export async function createCharacter(request: APIRequestContext, name: string) {
  const response = await request.post("/api/characters", {
    data: {
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
    },
  });
  expect(response.ok()).toBe(true);
  return (await response.json()).id as string;
}
