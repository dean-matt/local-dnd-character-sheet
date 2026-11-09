import { tmpdir } from "node:os";
import { characterDefinitionSchema } from "@dnd/character";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ROLL_LOG_LIMIT, rollLog } from "../db/characters.ts";
import { openTestDatabases } from "../db/testDatabases.ts";
import { charactersRoutes } from "./characters.ts";
import { rollsRoutes } from "./rolls.ts";

const definition = characterDefinitionSchema.parse({
  name: "Vex",
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
});

const roll = (total: number, label = "Stealth") => ({
  label,
  notation: "1d20+3",
  total,
  dice: [
    { faces: 20, value: total - 3, kept: true, sign: 1 },
    { faces: 20, value: 2, kept: false, sign: 1 },
  ],
  modifier: 3,
  critical: false,
});

const send = (method: string, body?: unknown) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

describe("rollsRoutes", () => {
  let opened: ReturnType<typeof openTestDatabases>;
  let characters: ReturnType<typeof charactersRoutes>;
  let rolls: ReturnType<typeof rollsRoutes>;

  const create = async (): Promise<string> =>
    (await (await characters.request("/characters", send("POST", definition))).json()).id;
  const record = (id: string, body: unknown) =>
    rolls.request(`/characters/${id}/rolls`, send("POST", body));
  const list = async () => (await rolls.request("/rolls")).json();
  const listOf = async (id: string) =>
    (await list()).filter((entry: { characterId: string }) => entry.characterId === id);

  beforeEach(() => {
    opened = openTestDatabases();
    characters = charactersRoutes(opened.charactersDb, () => {}, opened.homebrewDb, tmpdir());
    rolls = rollsRoutes(opened.charactersDb);
  });

  afterEach(() => {
    opened.charactersDb.$client.close();
    opened.homebrewDb.$client.close();
  });

  it("stores a roll whole, discarded dice included, and reads it back", async () => {
    const id = await create();

    const res = await record(id, roll(15));
    expect(res.status).toBe(201);
    const stored = await res.json();
    expect(stored).toMatchObject(roll(15));
    expect(Number.isNaN(Date.parse(stored.rolledAt))).toBe(false);
    expect(await list()).toEqual([stored]);
  });

  it("round-trips the mode and the reason a d20 option gave the roll", async () => {
    const id = await create();
    const lucky = {
      ...roll(15),
      mode: "normal",
      reason: "lucky",
    };

    const stored = await (await record(id, lucky)).json();
    expect(stored).toMatchObject({ mode: "normal", reason: "lucky" });
    expect(await list()).toEqual([stored]);
  });

  it("loads a row written before a roll carried a mode or a reason", async () => {
    const id = await create();
    const { dice, modifier, critical, total, label, notation } = roll(11);
    opened.charactersDb
      .insert(rollLog)
      .values({
        characterId: id,
        label,
        notation,
        result: total,
        detail: { dice, modifier, critical },
        rolledAt: new Date(),
      })
      .run();

    const [legacy] = await list();
    expect(legacy).toMatchObject(roll(11));
    expect(legacy).not.toHaveProperty("reason");
    expect(legacy).not.toHaveProperty("mode");
  });

  it("rejects a reason that is not a d20 option", async () => {
    const id = await create();
    expect((await record(id, { ...roll(15), reason: "inspiration" })).status).toBe(400);
  });

  it("lists newest first", async () => {
    const id = await create();
    await record(id, roll(10, "First"));
    await record(id, roll(11, "Second"));

    expect((await list()).map((entry: { label: string }) => entry.label)).toEqual([
      "Second",
      "First",
    ]);
  });

  it("keeps the newest 200 and leaves another character's rolls alone", async () => {
    const id = await create();
    const other = await create();
    await record(other, roll(1, "Other"));
    for (let n = 0; n <= ROLL_LOG_LIMIT; n++) await record(id, roll(n + 3, `Roll ${n}`));

    const kept = await listOf(id);
    expect(kept).toHaveLength(ROLL_LOG_LIMIT);
    expect(kept[0].label).toBe(`Roll ${ROLL_LOG_LIMIT}`);
    expect(kept.at(-1).label).toBe("Roll 1");
    expect(await listOf(other)).toHaveLength(1);
    expect(await list()).toHaveLength(ROLL_LOG_LIMIT + 1);
  });

  it("tags each roll with its character and lists every character's, newest first", async () => {
    const vex = await create();
    const other = await create();
    await record(vex, roll(10, "First"));
    await record(other, roll(11, "Second"));

    expect(await list()).toMatchObject([
      { label: "Second", characterId: other, characterName: "Vex" },
      { label: "First", characterId: vex, characterName: "Vex" },
    ]);
  });

  it("drops a deleted character's rolls from the list", async () => {
    const id = await create();
    await record(id, roll(10));
    expect(await list()).toHaveLength(1);
    await characters.request(`/characters/${id}`, { method: "DELETE" });
    expect(await list()).toEqual([]);
  });

  it("404s recording a roll for an unknown character", async () => {
    const res = await record("missing", roll(12));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "No character with that id" });
  });

  it("rejects a roll with a missing field", async () => {
    const id = await create();
    for (const field of Object.keys(roll(12))) {
      const { [field as keyof ReturnType<typeof roll>]: _gone, ...rest } = roll(12);
      expect((await record(id, rest)).status).toBe(400);
    }
    expect(await list()).toEqual([]);
  });
});
