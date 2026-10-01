/** Request bodies and a character to reference them, shared by the homebrew route tests. */
import { type CharacterDefinition, characterDefinitionSchema } from "@dnd/character";

export const sunblade = (overrides: Record<string, unknown> = {}) => ({
  name: "Sunblade",
  edition: "one",
  type: "M",
  rarity: "rare",
  ...overrides,
});

export const acidSplash = (overrides: Record<string, unknown> = {}) => ({
  name: "Acid Splash",
  edition: "one",
  level: 0,
  school: "C",
  duration: [{ type: "instant" }],
  ...overrides,
});

export const wanderer = (overrides: Record<string, unknown> = {}) => ({
  name: "Wanderer",
  edition: "one",
  ...overrides,
});

export const ironbound = (overrides: Record<string, unknown> = {}) => ({
  name: "Ironbound",
  edition: "one",
  ...overrides,
});

export const duskling = (overrides: Record<string, unknown> = {}) => ({
  name: "Duskling",
  edition: "one",
  size: ["M"],
  speed: 30,
  ...overrides,
});

export const warden = (overrides: Record<string, unknown> = {}) => ({
  name: "Warden",
  edition: "one",
  hd: { number: 1, faces: 10 },
  ...overrides,
});

const WARLOCK = { name: "Warlock", source: "XPHB" };

export const baseDefinition = (overrides: Partial<CharacterDefinition> = {}): CharacterDefinition =>
  characterDefinitionSchema.parse({
    name: "Vex",
    edition: "one",
    levels: [{ class: WARLOCK }],
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
    ...overrides,
  });

export const json = (body: unknown) => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
