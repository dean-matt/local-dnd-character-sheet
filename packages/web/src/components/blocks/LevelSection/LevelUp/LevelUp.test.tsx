import type { CharacterDefinition, CharacterRecord } from "@dnd/character";
import { QueryClient, QueryClientProvider, skipToken, useQuery } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { characterKey } from "../../../../hooks/characterKeys.ts";
import { characterRecord, derivedRecord } from "../../../../test/records.ts";
import { LevelUp } from "./LevelUp.tsx";

vi.mock("@dnd/dice", () => ({ rollDice: () => ({ total: 5 }) }));

const WARLOCK = { name: "Warlock", source: "XPHB" };
const XPHB = (name: string) => ({ name, source: "XPHB" });
const feature = (name: string, level: number, extra: object = {}) => ({
  ...XPHB(name),
  level,
  json: XPHB(name),
  ...extra,
});
const grants = (level: number, invocations: number, features: object[]) => ({
  level,
  resources: [],
  spellSlots: [],
  optionalFeatures: invocations > 0 ? [{ featureType: "EI", known: invocations }] : [],
  features,
});
const page = (items: object[]) => ({ items, total: items.length });

/** A class's table at `level`: its resources and the slots it holds at each spell level. */
const casterGrants = (level: number, resources: Record<string, string>, slots: number[]) => ({
  level,
  resources: Object.entries(resources).map(([resourceKey, value]) => ({ resourceKey, value })),
  spellSlots: slots.map((count, index) => ({ slotLevel: index + 1, slots: count })),
  optionalFeatures: [],
  features: [],
});

const FIGHTER = { name: "Fighter", source: "XPHB" };
const SORCERER = { name: "Sorcerer", source: "PHB" };
const CLERIC = XPHB("Cleric");
const KNIGHT_FIGHTER = { name: "Fighter", source: "PHB" };
const fighterSubclass = (name: string, shortName: string) => ({
  name,
  source: "PHB",
  shortName,
  className: "Fighter",
  classSource: "PHB",
  edition: "classic",
  json: { name, source: "PHB", shortName },
});

/** Each spell's level and the classes whose list holds it. */
const SPELLS: Record<string, { level: number; lists: string[] }> = {
  "Fire Bolt": { level: 0, lists: ["Sorcerer"] },
  Shield: { level: 1, lists: ["Sorcerer"] },
  "Misty Step": { level: 2, lists: ["Sorcerer"] },
  Fireball: { level: 3, lists: ["Sorcerer", "Wizard"] },
  "Magic Missile": { level: 1, lists: ["Wizard"] },
  "Mage Armor": { level: 1, lists: ["Wizard"] },
};
const WIZARD = { name: "Wizard", source: "PHB" };
const ROGUE = XPHB("Rogue");
const PALADIN = XPHB("Paladin");
const BARD = XPHB("Bard");

/** A class row a character multiclasses into, with what its `multiclassing` grants. */
const entryRow = (ref: { name: string; source: string }, hitDie: number, json: object) => ({
  ...ref,
  edition: "one",
  hitDie,
  json: { ...ref, ...json },
});

const SEARCH: Record<string, object[]> = {
  class: [ROGUE, PALADIN, BARD, WARLOCK].map((ref) => ({ type: "class", ...ref, edition: "one" })),
  item: ["Lute", "Flute"].map((name) => ({
    type: "item",
    ...XPHB(name),
    edition: "one",
    item: { kinds: ["tool"], rarity: null, category: null, tool: "instrument" },
  })),
  optfeature: ["Feint", "Parry", "Rally", "Riposte"].map((name) => ({
    type: "optfeature",
    name,
    source: "PHB",
    edition: "classic",
    optionalFeature: { prerequisites: [] },
  })),
  "skill,language": ["Acrobatics", "Stealth"].map((name) => ({
    type: "skill",
    ...XPHB(name),
    edition: "one",
  })),
};

const ROWS: Record<string, unknown> = {
  "/api/classes/Fighter/XPHB": { ...FIGHTER, edition: "one", hitDie: 10, json: FIGHTER },
  "/api/classes/Fighter/XPHB/subclasses?edition=one&limit=200": page([]),
  "/api/classes/Fighter/XPHB/at/1": grants(1, 0, [feature("Second Wind", 1)]),
  "/api/classes/Fighter/XPHB/at/2": grants(2, 0, [feature("Action Surge", 2)]),
  "/api/classes/Warlock/XPHB": {
    ...WARLOCK,
    edition: "one",
    hitDie: 8,
    json: {
      ...WARLOCK,
      classFeatures: [
        { classFeature: "Warlock Subclass|Warlock|XPHB|3", gainSubclassFeature: true },
      ],
    },
  },
  "/api/classes/Warlock/XPHB/subclasses?edition=one&limit=200": page([
    {
      name: "Fiend Patron",
      source: "XPHB",
      shortName: "Fiend",
      className: "Warlock",
      classSource: "XPHB",
      edition: "one",
      json: { name: "Fiend Patron", source: "XPHB", shortName: "Fiend" },
    },
  ]),
  // Three from the first level, where the 2024 table has one, so leveling to 2 asks for none.
  "/api/classes/Warlock/XPHB/at/1": grants(1, 3, [feature("Pact Magic", 1)]),
  "/api/classes/Warlock/XPHB/at/2": grants(2, 3, [feature("Magical Cunning", 2)]),
  "/api/classes/Warlock/XPHB/at/3": grants(3, 3, [feature("Warlock Subclass", 3)]),
  "/api/classes/Warlock/XPHB/at/4": grants(4, 3, [
    feature("Ability Score Improvement", 4),
    feature("Pact Choice", 4, { choose: 1 }),
    feature("Pact of the Blade", 4, { offeredBy: XPHB("Pact Choice") }),
    feature("Pact of the Tome", 4, { offeredBy: XPHB("Pact Choice") }),
  ]),
  "/api/classes/Warlock/XPHB/subclasses/Fiend%20Patron/XPHB/at/3": grants(3, 0, [
    feature("Dark One's Blessing", 3),
  ]),
  "/api/classes/Warlock/XPHB/subclasses/Fiend%20Patron/XPHB/at/4": grants(4, 0, [
    feature("Dark One's Blessing", 3),
    feature("Fiend Gift", 3, { choose: 1 }),
    feature("Hellfire", 3, { offeredBy: XPHB("Fiend Gift") }),
  ]),
  "/api/classes/Rogue/XPHB": entryRow(ROGUE, 8, {
    primaryAbility: [{ dex: true }],
    multiclassing: {
      proficienciesGained: {
        skills: [{ choose: { from: ["acrobatics", "stealth"], count: 1 } }],
        toolProficiencies: [{ "thieves' tools": true }],
        armorProficiencies: [{ light: true }],
      },
    },
  }),
  "/api/classes/Rogue/XPHB/subclasses?edition=one&limit=200": page([]),
  "/api/classes/Rogue/XPHB/at/1": grants(1, 0, [feature("Sneak Attack", 1)]),
  "/api/classes/Paladin/XPHB": entryRow(PALADIN, 10, {
    primaryAbility: [{ str: true, cha: true }],
    multiclassing: {
      proficienciesGained: {
        weapons: ["martial"],
        armorProficiencies: [{ light: true, medium: true, shield: true }],
      },
    },
  }),
  "/api/classes/Paladin/XPHB/subclasses?edition=one&limit=200": page([]),
  "/api/classes/Bard/XPHB": entryRow(BARD, 8, {
    primaryAbility: [{ cha: true }],
    multiclassing: {
      proficienciesGained: {
        skills: [{ choose: { from: ["acrobatics", "stealth"], count: 1 } }],
        toolProficiencies: [{ anyMusicalInstrument: 1 }],
        armorProficiencies: [{ light: true }],
      },
    },
  }),
  "/api/classes/Bard/XPHB/subclasses?edition=one&limit=200": page([]),
  "/api/classes/Bard/XPHB/at/1": grants(1, 0, [feature("Bardic Inspiration", 1)]),
  "/api/classes/Paladin/XPHB/at/1": grants(1, 0, [feature("Lay On Hands", 1)]),
  "/api/classes/Sorcerer/PHB": { ...SORCERER, edition: "classic", hitDie: 6, json: SORCERER },
  "/api/classes/Sorcerer/PHB/subclasses?edition=classic&limit=200": page([]),
  "/api/classes/Sorcerer/PHB/at/3": casterGrants(
    3,
    { cantrips_known: "4", spells_known: "4" },
    [4, 2],
  ),
  "/api/classes/Sorcerer/PHB/at/4": casterGrants(
    4,
    { cantrips_known: "5", spells_known: "5" },
    [4, 3],
  ),
  "/api/classes/Fighter/PHB": {
    ...KNIGHT_FIGHTER,
    edition: "classic",
    hitDie: 10,
    json: {
      ...KNIGHT_FIGHTER,
      classFeatures: [
        { classFeature: "Martial Archetype|Fighter|PHB|3", gainSubclassFeature: true },
      ],
    },
  },
  "/api/classes/Fighter/PHB/subclasses?edition=classic&limit=200": page([
    fighterSubclass("Eldritch Knight", "Eldritch Knight"),
    fighterSubclass("Champion", "Champion"),
    fighterSubclass("Battle Master", "Battle Master"),
  ]),
  "/api/classes/Fighter/PHB/at/2": casterGrants(2, {}, []),
  "/api/classes/Fighter/PHB/at/3": casterGrants(3, {}, []),
  "/api/classes/Fighter/PHB/subclasses/Eldritch%20Knight/PHB/at/3": casterGrants(
    3,
    { cantrips_known: "2", spells_known: "3" },
    [2],
  ),
  "/api/classes/Fighter/PHB/subclasses/Champion/PHB/at/3": casterGrants(3, {}, []),
  "/api/classes/Fighter/PHB/subclasses/Battle%20Master/PHB/at/3": {
    ...casterGrants(3, {}, []),
    optionalFeatures: [{ featureType: "MV:B", known: 3 }],
  },
  "/api/classes/Cleric/XPHB": { ...CLERIC, edition: "one", hitDie: 8, json: CLERIC },
  "/api/classes/Cleric/XPHB/subclasses?edition=one&limit=200": page([]),
  "/api/classes/Cleric/XPHB/at/1": casterGrants(
    1,
    { cantrips_known: "3", prepared_spells: "4" },
    [2],
  ),
  "/api/classes/Cleric/XPHB/at/2": casterGrants(
    2,
    { cantrips_known: "3", prepared_spells: "5" },
    [3],
  ),
  "/api/classes/Wizard/PHB": { ...WIZARD, edition: "classic", hitDie: 6, json: WIZARD },
  "/api/classes/Wizard/PHB/subclasses?edition=classic&limit=200": page([]),
  "/api/classes/Wizard/PHB/at/3": casterGrants(3, { cantrips_known: "3" }, [4, 2]),
  "/api/classes/Wizard/PHB/at/4": casterGrants(4, { cantrips_known: "3" }, [4, 3]),
  "/api/classes/Wizard/XPHB": {
    ...XPHB("Wizard"),
    edition: "one",
    hitDie: 6,
    json: XPHB("Wizard"),
  },
  "/api/classes/Wizard/XPHB/subclasses?edition=one&limit=200": page([]),
  "/api/classes/Wizard/XPHB/at/3": casterGrants(
    3,
    { cantrips_known: "3", prepared_spells: "6" },
    [4, 2],
  ),
  "/api/classes/Wizard/XPHB/at/4": casterGrants(
    4,
    { cantrips_known: "3", prepared_spells: "7" },
    [4, 3],
  ),
  "/api/feats?edition=one&limit=200": page([
    { ...XPHB("Alert"), edition: "one", json: { ...XPHB("Alert"), category: "G" } },
  ]),
};

/** Vex as a milestone Warlock of `count` levels, with an Armor Class override standing. */
function warlock(count: number, edit: Partial<CharacterDefinition> = {}): CharacterRecord {
  const record = characterRecord("1", "Vex");
  return {
    ...record,
    level: count,
    definition: {
      ...record.definition,
      levels: Array.from({ length: count }, () => ({ class: WARLOCK })),
      leveling: "milestone",
      overrides: { armorClass: 17 },
      ...edit,
    },
  };
}

function Seeded({ id }: { id: string }) {
  const { data } = useQuery<CharacterRecord>({ queryKey: characterKey(id), queryFn: skipToken });
  return data ? <LevelUp character={data} /> : null;
}

let writes: Mock;
let server: CharacterRecord;
let readable: boolean;
let searchable: boolean;
let spellSearches: URLSearchParams[];

/** Stands for a write from another tab, which this tab's cache has not seen. */
function editElsewhere(edit: Partial<CharacterDefinition>) {
  server = {
    ...server,
    definition: { ...server.definition, ...edit },
    updatedAt: "2024-01-01T00:05:00.000Z",
  };
}

/** Each spell's name and level, and whether the list the request names holds it. */
function lookupResponse(init: RequestInit) {
  const request = JSON.parse(String(init.body)) as {
    spells: { name: string }[];
    list?: { class: { name: string } };
  };
  const spells = request.spells.map(({ name }) => {
    const spell = SPELLS[name];
    if (!spell) return null;
    const listed = request.list && spell.lists.includes(request.list.class.name);
    return { name, level: spell.level, ...(request.list && { listed }) };
  });
  return new Response(JSON.stringify({ spells }));
}

/** A search answers every type but a class with a client error, which nothing retries, while `searchable` is off. */
function searchResponse(path: string) {
  const params = new URL(path, "http://local").searchParams;
  const type = params.get("type") ?? "";
  if (!searchable && type !== "class")
    return new Response(JSON.stringify({ error: "refused" }), { status: 400 });
  if (type === "spell") spellSearches.push(params);
  const items =
    type === "spell"
      ? Object.entries(SPELLS)
          .filter(([, { level }]) => level >= Number(params.get("minLevel")))
          .filter(([, { level }]) => level <= Number(params.get("maxLevel")))
          .map(([name]) => ({ type: "spell", name, source: "PHB", edition: "classic" }))
      : (SEARCH[type] ?? []);
  return new Response(JSON.stringify({ ...page(items), limit: 200, offset: 0 }));
}

function renderSeeded(character: CharacterRecord) {
  server = character;
  readable = true;
  searchable = true;
  spellSearches = [];
  writes = vi.fn(async (_url: string, init: RequestInit) => {
    const since = new Headers(init.headers).get("If-Unmodified-Since");
    if (since !== null && Date.parse(server.updatedAt) > Date.parse(since))
      return new Response(JSON.stringify({ error: "The character changed" }), { status: 412 });
    server = { ...server, definition: JSON.parse(String(init.body)) };
    return new Response(JSON.stringify(server));
  });
  vi.stubGlobal("fetch", async (url: RequestInfo | URL, init?: RequestInit) => {
    const path = String(url);
    if (path === "/api/characters/1/derived")
      return new Response(JSON.stringify(derivedRecord(server.definition)));
    if (init?.method === "PUT") return writes(path, init);
    if (init?.method === "POST") return lookupResponse(init);
    if (path === "/api/characters/1")
      return readable
        ? new Response(JSON.stringify(server))
        : new Response(JSON.stringify({ error: "offline" }), { status: 500 });
    if (path in ROWS) return new Response(JSON.stringify(ROWS[path]));
    if (path.startsWith("/api/search?")) return searchResponse(path);
    return new Response(JSON.stringify({ error: `unstubbed ${path}` }), { status: 404 });
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(characterKey(character.id), character);
  render(
    <QueryClientProvider client={client}>
      <Seeded id={character.id} />
    </QueryClientProvider>,
  );
  return client;
}

const sent = (): CharacterDefinition => JSON.parse(String(writes.mock.calls.at(-1)?.[1]?.body));
const dialog = () => screen.getByRole("dialog");
const applyButton = () => within(dialog()).getByRole("button", { name: "Apply level up" });

async function open() {
  fireEvent.click(screen.getByRole("button", { name: "Level up" }));
  await within(dialog()).findByText(/Choose how this level's hit points are found/);
}

async function multiclassInto(name: string) {
  fireEvent.click(within(dialog()).getByRole("combobox", { name: "Class" }));
  fireEvent.click(await within(dialog()).findByRole("option", { name: `${name} (new) → 1` }));
}

async function pickSpell(label: string, option: string) {
  fireEvent.focus(within(dialog()).getByRole("combobox", { name: label }));
  fireEvent.click(await within(dialog()).findByRole("option", { name: new RegExp(option) }));
}

function choose(name: string, option: string) {
  fireEvent.click(within(dialog()).getByRole("combobox", { name }));
  fireEvent.click(within(dialog()).getByRole("option", { name: option }));
}

beforeEach(() => localStorage.clear());

afterEach(() => vi.unstubAllGlobals());

describe("LevelUp", () => {
  it("writes the level at the average as one edit, keeps an override, and lists what moved", async () => {
    renderSeeded(warlock(1));
    await open();
    expect(applyButton()).toHaveAttribute("aria-disabled", "true");
    expect(within(dialog()).getByText(/Magical Cunning/)).toBeVisible();

    fireEvent.click(within(dialog()).getByRole("button", { name: "Average (5)" }));
    expect(within(dialog()).getByText("Average 5 +2 Constitution = +7 hit points")).toBeVisible();
    fireEvent.click(applyButton());

    await waitFor(() => expect(writes).toHaveBeenCalledTimes(1));
    await within(dialog()).findByText("Hit point maximum");
    expect(writes).toHaveBeenCalledTimes(1);
    expect(sent().levels).toEqual([{ class: WARLOCK }, { class: WARLOCK }]);
    expect(sent().overrides).toEqual({ armorClass: 17 });
    expect(within(dialog()).getByText("10 → 17")).toBeVisible();
    expect(within(dialog()).getByText("New features:").parentElement).toHaveTextContent(
      "New features: Magical Cunning",
    );
  });

  it("shows a roll as it lands and stores the face rolled", async () => {
    renderSeeded(warlock(1));
    await open();
    fireEvent.click(within(dialog()).getByRole("button", { name: "Roll (d8)" }));
    expect(within(dialog()).getByText(/Rolled 5 on the d8/)).toBeVisible();
    fireEvent.click(applyButton());
    await waitFor(() => expect(writes).toHaveBeenCalledTimes(1));
    expect(sent().levels.at(-1)).toEqual({ class: WARLOCK, rolled: 5 });
  });

  it("writes nothing when abandoned part way", async () => {
    renderSeeded(warlock(1));
    await open();
    fireEvent.click(within(dialog()).getByRole("button", { name: "Average (5)" }));
    fireEvent.click(within(dialog()).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(writes).not.toHaveBeenCalled();
  });

  it("asks for the subclass at the class's subclass level and stores it on that level", async () => {
    renderSeeded(warlock(2));
    await open();
    fireEvent.click(within(dialog()).getByRole("button", { name: "Average (5)" }));
    expect(applyButton()).toHaveAttribute("aria-disabled", "true");

    choose("Warlock subclass", "Fiend Patron");
    expect(await within(dialog()).findByText(/Dark One's Blessing/)).toBeVisible();
    fireEvent.click(applyButton());
    await waitFor(() => expect(writes).toHaveBeenCalledTimes(1));
    expect(sent().levels.at(-1)).toEqual({ class: WARLOCK, subclass: XPHB("Fiend Patron") });
  });

  it("asks for the improvement and each feature's option the level brings", async () => {
    const fiend = warlock(3);
    renderSeeded({
      ...fiend,
      definition: {
        ...fiend.definition,
        levels: [
          { class: WARLOCK },
          { class: WARLOCK },
          { class: WARLOCK, subclass: XPHB("Fiend Patron") },
        ],
      },
    });
    await open();
    fireEvent.click(within(dialog()).getByRole("button", { name: "Average (5)" }));
    await within(dialog()).findByRole("combobox", { name: "Level 4 choice" });
    choose("Level 4 choice", "Alert");
    expect(applyButton()).toHaveAttribute("aria-disabled", "true");

    choose("Pact Choice", "Pact of the Tome");
    fireEvent.click(applyButton());
    await waitFor(() => expect(writes).toHaveBeenCalledTimes(1));
    expect(sent().feats).toContainEqual({
      ref: XPHB("Alert"),
      grantedBy: { kind: "class", ref: WARLOCK },
      level: 4,
    });
    expect(sent().featureChoices).toEqual([
      {
        feature: { className: "Warlock", classSource: "XPHB", ...XPHB("Pact Choice"), level: 4 },
        options: [XPHB("Pact of the Tome")],
      },
    ]);
  });

  it("takes back the choices made for one class when the level goes to another", async () => {
    const base = warlock(3);
    renderSeeded({
      ...base,
      definition: { ...base.definition, levels: [{ class: FIGHTER }, ...base.definition.levels] },
    });
    await open();
    fireEvent.click(within(dialog()).getByRole("button", { name: "Roll (d8)" }));
    await within(dialog()).findByRole("combobox", { name: "Level 5 choice" });
    choose("Level 5 choice", "Alert");
    choose("Pact Choice", "Pact of the Tome");

    choose("Class", "Fighter 1 → 2");
    expect(await within(dialog()).findByText(/Action Surge/)).toBeVisible();
    expect(within(dialog()).queryByRole("combobox", { name: "Pact Choice" })).toBeNull();
    expect(within(dialog()).getByRole("button", { name: "Roll (d10)" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    fireEvent.click(within(dialog()).getByRole("button", { name: "Average (6)" }));
    fireEvent.click(applyButton());
    await waitFor(() => expect(writes).toHaveBeenCalledTimes(1));
    expect(sent().levels.at(-1)).toEqual({ class: FIGHTER });
    expect(sent().feats).toEqual([]);
    expect(sent().featureChoices).toEqual([]);
  });

  it("resumes a draft saved before a reload, its stored face read as Custom", async () => {
    const character = warlock(1);
    const draft = {
      ...character.definition,
      levels: [{ class: WARLOCK }, { class: WARLOCK, rolled: 6 }],
    };
    localStorage.setItem(`draft:level-up:1:${character.updatedAt}`, JSON.stringify(draft));
    renderSeeded(character);
    fireEvent.click(screen.getByRole("button", { name: "Level up" }));

    expect(await within(dialog()).findByRole("button", { name: "Custom" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(dialog()).getByRole("spinbutton", { name: "Rolled value, 1 to 8" })).toHaveValue(
      6,
    );
    await waitFor(() => expect(applyButton()).toHaveAttribute("aria-disabled", "false"));
  });

  it("never resumes a draft saved before a later edit to the character", async () => {
    const character = warlock(1);
    const draft = {
      ...character.definition,
      levels: [{ class: WARLOCK }, { class: WARLOCK, rolled: 6 }],
    };
    localStorage.setItem("draft:level-up:1:2023-12-31T00:00:00.000Z", JSON.stringify(draft));
    renderSeeded(character);
    await open();

    expect(within(dialog()).getByRole("button", { name: "Custom" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(applyButton()).toHaveAttribute("aria-disabled", "true");
  });

  it("writes a typed face, and holds Apply on one the die cannot show", async () => {
    renderSeeded(warlock(1));
    await open();
    fireEvent.click(within(dialog()).getByRole("button", { name: "Custom" }));
    const face = within(dialog()).getByRole("spinbutton", { name: "Rolled value, 1 to 8" });

    fireEvent.change(face, { target: { value: "9" } });
    expect(face).toHaveAccessibleDescription("Type a whole number from 1 to 8.");
    expect(applyButton()).toHaveAttribute("aria-disabled", "true");

    fireEvent.change(face, { target: { value: "7" } });
    fireEvent.click(applyButton());
    await waitFor(() => expect(writes).toHaveBeenCalledTimes(1));
    expect(sent().levels.at(-1)).toEqual({ class: WARLOCK, rolled: 7 });
  });

  it("asks for a subclass a class passed its subclass level without", async () => {
    renderSeeded(warlock(3));
    await open();
    choose("Warlock subclass", "Fiend Patron");
    fireEvent.click(await within(dialog()).findByRole("button", { name: "Average (5)" }));
    await within(dialog()).findByRole("combobox", { name: "Fiend Gift" });
    const features = within(dialog()).getByText("New features:").parentElement;
    expect(features).toHaveTextContent("Fiend Gift");
    expect(features).toHaveTextContent("Dark One's Blessing");
    choose("Level 4 choice", "Alert");
    choose("Pact Choice", "Pact of the Tome");
    expect(applyButton()).toHaveAttribute("aria-disabled", "true");

    choose("Fiend Gift", "Hellfire");
    fireEvent.click(applyButton());
    await waitFor(() => expect(writes).toHaveBeenCalledTimes(1));
    expect(sent().levels.at(-1)).toEqual({ class: WARLOCK, subclass: XPHB("Fiend Patron") });
    expect(sent().featureChoices).toContainEqual({
      feature: {
        className: "Warlock",
        classSource: "XPHB",
        subclass: { shortName: "Fiend", source: "XPHB" },
        ...XPHB("Fiend Gift"),
        level: 3,
      },
      options: [XPHB("Hellfire")],
    });
  });

  it("refuses to write over an edit the server holds since the dialog opened, then reloads", async () => {
    const character = warlock(1);
    renderSeeded(character);
    await open();
    fireEvent.click(within(dialog()).getByRole("button", { name: "Average (5)" }));
    editElsewhere({ feats: [{ ref: XPHB("Alert") }] });
    fireEvent.click(applyButton());

    await waitFor(() =>
      expect(within(dialog()).getByRole("alert")).toHaveTextContent("The character changed"),
    );
    expect(new Headers(writes.mock.calls[0]?.[1]?.headers).get("If-Unmodified-Since")).toBe(
      new Date(character.updatedAt).toUTCString(),
    );
    expect(server.definition.levels).toHaveLength(1);

    fireEvent.click(within(dialog()).getByRole("button", { name: "Reload" }));
    await waitFor(() =>
      expect(within(dialog()).getByRole("button", { name: "Average (5)" })).toHaveAttribute(
        "aria-pressed",
        "false",
      ),
    );
    expect(within(dialog()).queryByRole("button", { name: "Reload" })).toBeNull();
    fireEvent.click(within(dialog()).getByRole("button", { name: "Average (5)" }));
    await waitFor(() => expect(applyButton()).toHaveAttribute("aria-disabled", "false"));
    fireEvent.click(applyButton());
    await waitFor(() => expect(writes).toHaveBeenCalledTimes(2));
    await within(dialog()).findByText("Level up applied");
    expect(sent().levels).toHaveLength(2);
    expect(sent().feats).toEqual([{ ref: XPHB("Alert") }]);
  });

  it("says so in the alert line where Reload cannot read the character", async () => {
    renderSeeded(warlock(1));
    await open();
    fireEvent.click(within(dialog()).getByRole("button", { name: "Average (5)" }));
    editElsewhere({ feats: [{ ref: XPHB("Alert") }] });
    fireEvent.click(applyButton());
    readable = false;

    fireEvent.click(await within(dialog()).findByRole("button", { name: "Reload" }));
    await waitFor(() =>
      expect(within(dialog()).getByRole("alert")).toHaveTextContent("Reload failed: offline"),
    );
    expect(within(dialog()).getByRole("button", { name: "Reload" })).toBeVisible();
  });

  describe("a level in a class the character does not hold yet", () => {
    it("offers each class in the one Class list, a held class only as its next level", async () => {
      renderSeeded(warlock(1));
      await open();
      fireEvent.click(within(dialog()).getByRole("combobox", { name: "Class" }));
      await within(dialog()).findByRole("option", { name: "Rogue (new) → 1" });
      expect(
        within(dialog())
          .getAllByRole("option")
          .map((option) => option.textContent),
      ).toEqual(["Warlock 1 → 2", "Rogue (new) → 1", "Paladin (new) → 1", "Bard (new) → 1"]);
    });

    it("lands the class's multiclass gains and the skill picked, and reports each prerequisite met", async () => {
      const held = { ref: XPHB("Stealth"), level: "proficient" as const };
      const vex = warlock(1);
      renderSeeded(
        warlock(1, {
          proficiencies: { ...vex.definition.proficiencies, skills: [held] },
        }),
      );
      await open();
      await multiclassInto("Rogue");

      expect(await within(dialog()).findByText(/Rogue needs Dexterity 13/)).toHaveTextContent(
        "Rogue needs Dexterity 13: met",
      );
      expect(
        within(dialog()).getByText("Multiclassing into Rogue grants: Light, Thieves' Tools"),
      ).toBeVisible();
      const skills = await within(dialog()).findByRole("group", { name: "Skill from Rogue" });
      expect(
        within(skills)
          .getAllByRole("checkbox")
          .map((box) => box.parentElement?.textContent),
      ).toEqual(["Acrobatics"]);
      expect(within(dialog()).getByText(/Sneak Attack/)).toBeVisible();

      fireEvent.click(within(dialog()).getByRole("button", { name: "Average (5)" }));
      expect(applyButton()).toHaveAttribute("aria-disabled", "true");
      fireEvent.click(within(skills).getByRole("checkbox", { name: "Acrobatics" }));
      fireEvent.click(applyButton());

      await waitFor(() => expect(writes).toHaveBeenCalledTimes(1));
      expect(sent().levels).toEqual([{ class: WARLOCK }, { class: ROGUE }]);
      expect(sent().proficiencies).toMatchObject({
        skills: [held, { ref: XPHB("Acrobatics"), level: "proficient" }],
        armor: ["Light"],
        tools: [{ name: "Thieves' Tools", level: "proficient" }],
        savingThrows: [],
      });
      expect(sent().departures).toEqual([]);
    });

    it("reports a prerequisite the scores leave unmet without refusing the level, and notes it", async () => {
      renderSeeded(warlock(1));
      await open();
      await multiclassInto("Paladin");

      expect(
        await within(dialog()).findByText(/Paladin needs Strength 13 and Charisma 13/),
      ).toHaveTextContent("not met");
      fireEvent.click(within(dialog()).getByRole("button", { name: "Average (6)" }));
      expect(applyButton()).toHaveAttribute("aria-disabled", "false");
      fireEvent.click(applyButton());

      await waitFor(() => expect(writes).toHaveBeenCalledTimes(1));
      expect(sent().proficiencies).toMatchObject({
        armor: ["Light", "Medium", "Shield"],
        weapons: ["Martial"],
      });
      expect(sent().departures).toEqual([
        {
          field: "levels.1.class",
          note: "Multiclassing in or out of Paladin needs Strength 13 and Charisma 13.",
        },
      ]);
    });

    it("takes back the class's gains and picks when the level goes back to a held class", async () => {
      renderSeeded(warlock(1));
      await open();
      await multiclassInto("Rogue");
      const skills = await within(dialog()).findByRole("group", { name: "Skill from Rogue" });
      fireEvent.click(within(skills).getByRole("checkbox", { name: "Stealth" }));

      choose("Class", "Warlock 1 → 2");
      fireEvent.click(within(dialog()).getByRole("button", { name: "Average (5)" }));
      fireEvent.click(applyButton());

      await waitFor(() => expect(writes).toHaveBeenCalledTimes(1));
      expect(sent().levels).toEqual([{ class: WARLOCK }, { class: WARLOCK }]);
      expect(sent().proficiencies.skills).toEqual([]);
      expect(sent().proficiencies.armor).toEqual([]);
    });

    it("waits on the instrument a class's tool pick asks for, and lands the one checked", async () => {
      renderSeeded(warlock(1));
      await open();
      await multiclassInto("Bard");
      const instruments = await within(dialog()).findByRole("group", { name: "Tool from Bard" });
      await within(instruments).findByRole("checkbox", { name: "Lute" });
      fireEvent.click(within(dialog()).getByRole("checkbox", { name: "Acrobatics" }));
      fireEvent.click(within(dialog()).getByRole("button", { name: "Average (5)" }));
      expect(applyButton()).toHaveAttribute("aria-disabled", "true");

      fireEvent.click(within(instruments).getByRole("checkbox", { name: "Flute" }));
      fireEvent.click(applyButton());

      await waitFor(() => expect(writes).toHaveBeenCalledTimes(1));
      expect(sent().proficiencies.tools).toEqual([{ name: "Flute", level: "proficient" }]);
    });

    it("says so where what the class offers fails to load, and holds Apply", async () => {
      renderSeeded(warlock(1));
      searchable = false;
      await open();
      await multiclassInto("Rogue");
      expect(
        await within(dialog()).findByText(/Couldn't load what multiclassing into Rogue offers/),
      ).toBeVisible();
      fireEvent.click(within(dialog()).getByRole("button", { name: "Average (5)" }));
      expect(applyButton()).toHaveAttribute("aria-disabled", "true");
    });
  });

  describe("spells", () => {
    /** Vex as a 2014 Sorcerer of `count` levels, who knows Shield. */
    function sorcerer(count: number): CharacterRecord {
      const base = warlock(count);
      return {
        ...base,
        edition: "classic",
        definition: {
          ...base.definition,
          edition: "classic",
          levels: Array.from({ length: count }, () => ({ class: SORCERER })),
          spells: [{ ref: { name: "Shield", source: "PHB" }, prepared: false }],
        },
      };
    }

    it("asks for the cantrips and spells a level adds from the class's list, and writes them with the level", async () => {
      renderSeeded(sorcerer(3));
      await open();
      fireEvent.click(within(dialog()).getByRole("button", { name: "Average (4)" }));
      const cantrips = await within(dialog()).findByRole("region", { name: "New cantrips" });
      expect(cantrips).toHaveTextContent("Choose 1 — 0 selected");
      expect(within(dialog()).getByRole("region", { name: "New spells" })).toHaveTextContent(
        "Choose 1 — 0 selected",
      );

      await pickSpell("Add a cantrip", "Fire Bolt");
      await waitFor(() => expect(cantrips).toHaveTextContent("Choose 1 — 1 selected"));
      expect(applyButton()).toHaveAttribute("aria-disabled", "true");

      fireEvent.focus(within(dialog()).getByRole("combobox", { name: "Add a spell" }));
      const list = await within(dialog()).findByRole("listbox", { name: "Add a spell" });
      await waitFor(() =>
        expect(within(list).getByRole("option", { name: /Shield/ })).toHaveTextContent(
          "Known already",
        ),
      );
      expect(within(list).queryByRole("option", { name: /Fireball/ })).toBeNull();
      expect(Object.fromEntries(spellSearches.at(-1) ?? [])).toMatchObject({
        class: "Sorcerer|PHB",
        classLevel: "4",
        minLevel: "1",
        maxLevel: "2",
      });
      fireEvent.click(within(list).getByRole("option", { name: /Misty Step/ }));
      await waitFor(() => expect(applyButton()).toHaveAttribute("aria-disabled", "false"));

      fireEvent.click(applyButton());
      await waitFor(() => expect(writes).toHaveBeenCalledTimes(1));
      expect(writes).toHaveBeenCalledTimes(1);
      expect(sent().levels).toHaveLength(4);
      expect(sent().spells).toEqual([
        { ref: { name: "Shield", source: "PHB" }, prepared: false },
        { ref: { name: "Fire Bolt", source: "PHB" }, prepared: false, origin: SORCERER },
        { ref: { name: "Misty Step", source: "PHB" }, prepared: false, origin: SORCERER },
      ]);
    });

    it("offers spells off the class's list and of any level past the escape", async () => {
      renderSeeded(sorcerer(3));
      await open();
      await within(dialog()).findByRole("region", { name: "New spells" });
      fireEvent.click(
        within(dialog()).getByRole("checkbox", {
          name: "Offer spells off the Sorcerer list, and of any level",
        }),
      );
      await pickSpell("Add a spell", "Fireball");
      await within(dialog()).findByRole("button", { name: "Remove Fireball" });
      const search = Object.fromEntries(spellSearches.at(-1) ?? []);
      expect(search).toMatchObject({ minLevel: "1", maxLevel: "9" });
      expect(search).not.toHaveProperty("class");
    });

    it("takes back the spells picked when the subclass changes", async () => {
      const base = sorcerer(2);
      renderSeeded({
        ...base,
        definition: {
          ...base.definition,
          levels: [{ class: KNIGHT_FIGHTER }, { class: KNIGHT_FIGHTER }],
        },
      });
      await open();
      choose("Fighter subclass", "Eldritch Knight");
      const cantrips = await within(dialog()).findByRole("region", { name: "New cantrips" });
      expect(cantrips).toHaveTextContent("Choose 2 — 0 selected");
      expect(within(dialog()).getByRole("region", { name: "New spells" })).toHaveTextContent(
        "Choose 3 — 0 selected",
      );
      await pickSpell("Add a cantrip", "Fire Bolt");
      await within(dialog()).findByRole("button", { name: "Remove Fire Bolt" });

      choose("Fighter subclass", "Champion");
      await waitFor(() =>
        expect(within(dialog()).queryByRole("region", { name: "New cantrips" })).toBeNull(),
      );
      fireEvent.click(within(dialog()).getByRole("button", { name: "Average (6)" }));
      fireEvent.click(applyButton());
      await waitFor(() => expect(writes).toHaveBeenCalledTimes(1));
      expect(sent().spells).toEqual([{ ref: { name: "Shield", source: "PHB" }, prepared: false }]);
    });

    it("asks for each optional feature the level entitles the character to, and writes them under the subclass", async () => {
      const base = sorcerer(2);
      renderSeeded({
        ...base,
        definition: {
          ...base.definition,
          levels: [{ class: KNIGHT_FIGHTER }, { class: KNIGHT_FIGHTER }],
        },
      });
      await open();
      choose("Fighter subclass", "Battle Master");
      const maneuvers = await within(dialog()).findByRole("region", {
        name: "New Maneuver (Battle Master)",
      });
      expect(maneuvers).toHaveTextContent("Choose 3 — 0 selected");
      fireEvent.click(within(dialog()).getByRole("button", { name: "Average (6)" }));
      for (const name of ["Parry", "Riposte"]) {
        await pickSpell("Add a maneuver", name);
        await within(dialog()).findByRole("button", { name: `Remove ${name}` });
      }
      expect(applyButton()).toHaveAttribute("aria-disabled", "true");

      await pickSpell("Add a maneuver", "Feint");
      await waitFor(() => expect(applyButton()).toHaveAttribute("aria-disabled", "false"));
      fireEvent.click(applyButton());
      await waitFor(() => expect(writes).toHaveBeenCalledTimes(1));
      const grantedBy = {
        kind: "subclass",
        ref: { name: "Battle Master", source: "PHB" },
        class: KNIGHT_FIGHTER,
      };
      expect(sent().optionalFeatures).toEqual(
        ["Parry", "Riposte", "Feint"].map((name) => ({
          ref: { name, source: "PHB" },
          featureType: "MV:B",
          grantedBy,
        })),
      );
      expect(
        await within(dialog()).findByText("Maneuver (Battle Master) options known"),
      ).toBeVisible();
    });

    it("takes back the optional features picked when the subclass changes", async () => {
      const base = sorcerer(2);
      renderSeeded({
        ...base,
        definition: {
          ...base.definition,
          levels: [{ class: KNIGHT_FIGHTER }, { class: KNIGHT_FIGHTER }],
        },
      });
      await open();
      choose("Fighter subclass", "Battle Master");
      await within(dialog()).findByRole("region", { name: "New Maneuver (Battle Master)" });
      await pickSpell("Add a maneuver", "Parry");
      await within(dialog()).findByRole("button", { name: "Remove Parry" });

      choose("Fighter subclass", "Champion");
      await waitFor(() =>
        expect(
          within(dialog()).queryByRole("region", { name: "New Maneuver (Battle Master)" }),
        ).toBeNull(),
      );
      fireEvent.click(within(dialog()).getByRole("button", { name: "Average (6)" }));
      fireEvent.click(applyButton());
      await waitFor(() => expect(writes).toHaveBeenCalledTimes(1));
      expect(sent().optionalFeatures).toEqual([]);
    });

    it("takes back the spells picked when the level goes to another class", async () => {
      const base = sorcerer(3);
      renderSeeded({
        ...base,
        definition: { ...base.definition, levels: [{ class: FIGHTER }, ...base.definition.levels] },
      });
      await open();
      await within(dialog()).findByRole("region", { name: "New cantrips" });
      await pickSpell("Add a cantrip", "Fire Bolt");
      await within(dialog()).findByRole("button", { name: "Remove Fire Bolt" });

      choose("Class", "Fighter 1 → 2");
      fireEvent.click(await within(dialog()).findByRole("button", { name: "Average (6)" }));
      expect(within(dialog()).queryByRole("region", { name: "New cantrips" })).toBeNull();
      fireEvent.click(applyButton());
      await waitFor(() => expect(writes).toHaveBeenCalledTimes(1));
      expect(sent().spells).toEqual([{ ref: { name: "Shield", source: "PHB" }, prepared: false }]);
    });

    it.each([
      ["a 2014 Wizard", WIZARD, "classic"],
      ["a 2024 Wizard", XPHB("Wizard"), "one"],
    ] as const)(
      "asks %s for two spells for its spellbook and writes them with the level",
      async (_label, wizard, edition) => {
        const base = warlock(3);
        renderSeeded({
          ...base,
          edition,
          definition: {
            ...base.definition,
            edition,
            levels: Array.from({ length: 3 }, () => ({ class: wizard })),
          },
        });
        await open();
        fireEvent.click(within(dialog()).getByRole("button", { name: "Average (4)" }));
        const region = await within(dialog()).findByRole("region", {
          name: "Spells for your spellbook",
        });
        expect(region).toHaveTextContent("Choose 2 — 0 selected");
        expect(applyButton()).toHaveAttribute("aria-disabled", "true");

        await pickSpell("Add a spell", "Magic Missile");
        await within(dialog()).findByRole("button", { name: "Remove Magic Missile" });
        expect(applyButton()).toHaveAttribute("aria-disabled", "true");
        await pickSpell("Add a spell", "Mage Armor");
        await waitFor(() => expect(applyButton()).toHaveAttribute("aria-disabled", "false"));
        expect(Object.fromEntries(spellSearches.at(-1) ?? [])).toMatchObject({
          class: `Wizard|${wizard.source}`,
          classLevel: "4",
          maxLevel: "2",
        });

        fireEvent.click(applyButton());
        await waitFor(() => expect(writes).toHaveBeenCalledTimes(1));
        expect(sent().levels).toHaveLength(4);
        expect(sent().spells).toEqual([
          { ref: { name: "Magic Missile", source: "PHB" }, prepared: false, origin: wizard },
          { ref: { name: "Mage Armor", source: "PHB" }, prepared: false, origin: wizard },
        ]);
      },
    );

    it("asks a multiclass Wizard for its spellbook spells when the Wizard levels", async () => {
      const base = warlock(4);
      renderSeeded({
        ...base,
        edition: "classic",
        definition: {
          ...base.definition,
          edition: "classic",
          levels: [{ class: FIGHTER }, ...Array.from({ length: 3 }, () => ({ class: WIZARD }))],
        },
      });
      await open();
      choose("Class", "Wizard 3 → 4");
      fireEvent.click(await within(dialog()).findByRole("button", { name: "Average (4)" }));
      await within(dialog()).findByRole("region", { name: "Spells for your spellbook" });
      await pickSpell("Add a spell", "Magic Missile");
      await within(dialog()).findByRole("button", { name: "Remove Magic Missile" });
      await pickSpell("Add a spell", "Mage Armor");
      await waitFor(() => expect(applyButton()).toHaveAttribute("aria-disabled", "false"));

      choose("Class", "Fighter 1 → 2");
      fireEvent.click(await within(dialog()).findByRole("button", { name: "Average (6)" }));
      expect(
        within(dialog()).queryByRole("region", { name: "Spells for your spellbook" }),
      ).toBeNull();
    });

    it("asks a class that prepares its spells for none", async () => {
      const base = warlock(1);
      renderSeeded({ ...base, definition: { ...base.definition, levels: [{ class: CLERIC }] } });
      await open();
      fireEvent.click(within(dialog()).getByRole("button", { name: "Average (5)" }));
      await waitFor(() => expect(applyButton()).toHaveAttribute("aria-disabled", "false"));
      expect(within(dialog()).queryByRole("region", { name: "New spells" })).toBeNull();
      expect(within(dialog()).queryByRole("region", { name: "New cantrips" })).toBeNull();
    });
  });
});
