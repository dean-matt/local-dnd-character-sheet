import { type CharacterDefinition, entryKey } from "@dnd/character";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Addable } from "../lib/addable.ts";
import { characterRecord } from "../test/records.ts";
import { type AddOutcome, useAddToCharacter } from "./useAddToCharacter.ts";

const WARLOCK = { name: "Warlock", source: "XPHB" };
const WIZARD = { name: "Wizard", source: "XPHB" };
const blast = { name: "Eldritch Blast", source: "XPHB" };
const fireball = { name: "Fireball", source: "XPHB" };
const spellHit = (ref: { name: string; source: string }) => ({
  type: "spell",
  ...ref,
  edition: "one",
});

const grappler = {
  name: "Grappler",
  source: "XPHB",
  edition: "one",
  json: { name: "Grappler", source: "XPHB", prerequisite: [{ level: 4 }] },
};
const plusOne = {
  name: "+1 Weapon",
  source: "DMG",
  edition: "classic",
  kind: "magicvariant",
  type: null,
  rarity: "uncommon",
  requiresAttunement: false,
  json: { name: "+1 Weapon", source: "DMG" },
};

/**
 * Answers Fira's reads, `LISTS`, `classAnswer`, and a PUT with the record it was sent;
 * `writes` collects each definition written.
 */
const missile = { name: "Magic Missile", source: "XPHB" };
const counterspell = { name: "Counterspell", source: "XPHB" };

/** Each class's list, with each spell's level. */
const LISTS: Record<string, [{ name: string; source: string }, number][]> = {
  "Warlock|XPHB": [
    [blast, 0],
    [counterspell, 3],
  ],
  "Wizard|XPHB": [
    [missile, 1],
    [counterspell, 3],
    [fireball, 3],
  ],
};

const spellList = (url: string) => {
  const params = new URL(url, "http://x").searchParams;
  const minLevel = Number(params.get("minLevel") ?? 0);
  const items = (LISTS[params.get("class") ?? ""] ?? [])
    .filter(([, level]) => level >= minLevel)
    .map(([ref]) => spellHit(ref));
  return { items, total: items.length, limit: 200, offset: 0 };
};

/** A class's row, or its table at a level, casting slots up to half that level rounded up. */
const classAnswer = (url: string) => {
  const [name = "", source = "", at, level] = url.split("/").slice(3, 7);
  if (at === "at") {
    const top = Math.ceil(Number(level) / 2);
    const spellSlots = Array.from({ length: top }, (_, i) => ({ slotLevel: i + 1, slots: 2 }));
    return { level: Number(level), resources: [], spellSlots, optionalFeatures: [], features: [] };
  }
  const casterProgression = name === "Warlock" ? "pact" : "full";
  return { name, source, edition: "one", hitDie: 8, json: { name, source, casterProgression } };
};

function stubApi(definition: Partial<CharacterDefinition> = {}, failWrite = false) {
  const base = characterRecord("7", "Fira");
  const record = { ...base, definition: { ...base.definition, ...definition } };
  const writes: CharacterDefinition[] = [];
  const json = (body: unknown, status = 200) =>
    Promise.resolve(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (init?.method === "PUT") {
      if (failWrite) return json({ error: "Disk full" }, 500);
      const written = JSON.parse(String(init.body)) as CharacterDefinition;
      writes.push(written);
      return json({ ...record, definition: written });
    }
    if (url === "/api/characters/7") return json(record);
    if (url.startsWith("/api/search?")) return json(spellList(url));
    if (url.startsWith("/api/classes/")) return json(classAnswer(url));
    if (url === "/api/feats/Grappler/XPHB") return json(grappler);
    if (url === "/api/items/%2B1%20Weapon/DMG") return json(plusOne);
    return json({ error: `nothing at ${url}` }, 404);
  });
  return writes;
}

async function add(row: Addable): Promise<AddOutcome> {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useAddToCharacter("7"), { wrapper });
  let outcome: AddOutcome | undefined;
  await act(async () => {
    outcome = await result.current(row);
  });
  if (!outcome) throw new Error("the add never settled");
  return outcome;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useAddToCharacter", () => {
  it("learns a spell for the class whose list holds it, noting nothing", async () => {
    const writes = stubApi();
    const outcome = await add({ kind: "spell", ref: blast, label: "Eldritch Blast (XPHB)" });
    expect(outcome).toEqual({ text: "Added Eldritch Blast (XPHB) to Fira." });
    expect(writes[0]?.spells).toEqual([{ ref: blast, prepared: false, origin: WARLOCK }]);
    expect(writes[0]?.departures).toEqual([]);
  });

  it("learns a spell no class lists with no class, and notes it on the sheet", async () => {
    const writes = stubApi();
    const outcome = await add({ kind: "spell", ref: fireball, label: "Fireball (XPHB)" });
    const note = "Fireball (XPHB) is not on the Warlock spell list.";
    expect(outcome).toEqual({ text: "Added Fireball (XPHB) to Fira.", note: `Noted: ${note}` });
    expect(writes[0]?.spells).toEqual([{ ref: fireball, prepared: false }]);
    expect(writes[0]?.departures).toEqual([{ field: `spells.${entryKey(fireball)}`, note }]);
  });

  it("learns a spell for the first of several classes whose list holds it", async () => {
    const writes = stubApi({ levels: [{ class: WARLOCK }, { class: WIZARD }] });
    const outcome = await add({ kind: "spell", ref: missile, label: "Magic Missile (XPHB)" });
    expect(outcome).toEqual({ text: "Added Magic Missile (XPHB) to Fira." });
    expect(writes[0]?.spells).toEqual([{ ref: missile, prepared: false, origin: WIZARD }]);
  });

  it("learns a spell above the level its class's slots cast, and notes it", async () => {
    const writes = stubApi({ levels: [{ class: WIZARD }] });
    const outcome = await add({ kind: "spell", ref: fireball, label: "Fireball (XPHB)" });
    const note = "Fireball (XPHB) is above the highest level a Wizard slot casts.";
    expect(outcome.note).toBe(`Noted: ${note}`);
    expect(writes[0]?.spells).toEqual([{ ref: fireball, prepared: false, origin: WIZARD }]);
    expect(writes[0]?.departures).toEqual([{ field: `spells.${entryKey(fireball)}`, note }]);
  });

  it("learns a spell for a later class whose slots cast it, where the first's do not", async () => {
    const wizardFive = Array.from({ length: 5 }, () => ({ class: WIZARD }));
    const writes = stubApi({ levels: [{ class: WARLOCK }, ...wizardFive] });
    const outcome = await add({ kind: "spell", ref: counterspell, label: "Counterspell (XPHB)" });
    expect(outcome).toEqual({ text: "Added Counterspell (XPHB) to Fira." });
    expect(writes[0]?.spells).toEqual([{ ref: counterspell, prepared: false, origin: WIZARD }]);
  });

  it("notes a spell every class holding it casts below, learned for the first", async () => {
    const writes = stubApi({ levels: [{ class: WARLOCK }, { class: WIZARD }] });
    const outcome = await add({ kind: "spell", ref: counterspell, label: "Counterspell (XPHB)" });
    expect(outcome.note).toBe(
      "Noted: Counterspell (XPHB) is above the highest level a Warlock or Wizard slot casts.",
    );
    expect(writes[0]?.spells).toEqual([{ ref: counterspell, prepared: false, origin: WARLOCK }]);
  });

  it("names every class's list in the note for a spell none of them holds", async () => {
    const ember = { name: "Ember", source: "XPHB" };
    stubApi({ levels: [{ class: WARLOCK }, { class: WIZARD }] });
    const outcome = await add({ kind: "spell", ref: ember, label: "Ember (XPHB)" });
    expect(outcome.note).toBe("Noted: Ember (XPHB) is not on the Warlock or Wizard spell list.");
  });

  it("does not learn a spell known already", async () => {
    const writes = stubApi({ spells: [{ ref: blast, prepared: false }] });
    const outcome = await add({ kind: "spell", ref: blast, label: "Eldritch Blast (XPHB)" });
    expect(outcome).toEqual({ text: "Fira knows Eldritch Blast (XPHB) already." });
    expect(writes).toEqual([]);
  });

  it("adds a feat whose prerequisite the character misses, and notes why", async () => {
    const ref = { name: "Grappler", source: "XPHB" };
    const writes = stubApi();
    const outcome = await add({ kind: "feat", ref, label: "Grappler (XPHB)" });
    expect(outcome.note).toBe("Noted: Fira does not meet a prerequisite of Grappler (XPHB).");
    expect(writes[0]?.feats).toEqual([{ ref }]);
  });

  it("adds a magic variant named alone as its own row, noting it wants a base item", async () => {
    const ref = { name: "+1 Weapon", source: "DMG" };
    const writes = stubApi();
    const outcome = await add({ kind: "item", ref, label: "+1 Weapon (DMG)" });
    expect(outcome.note).toBe(
      "Noted: +1 Weapon (DMG) is a magic variant, held only beside a base item.",
    );
    expect(writes[0]?.inventory).toEqual([
      { ref, quantity: 1, carried: true, equipped: false, attuned: false },
    ]);
  });

  it("says why an add failed, naming the character", async () => {
    stubApi({}, true);
    const outcome = await add({
      kind: "item",
      ref: { homebrewId: "3" },
      label: "Ember (Homebrew)",
    });
    expect(outcome).toEqual({
      text: "Couldn't add Ember (Homebrew) to Fira: Disk full",
      failed: true,
    });
  });
});
