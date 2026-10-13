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

const FIGHTER = { name: "Fighter", source: "XPHB" };
const ROGUE = XPHB("Rogue");
const PALADIN = XPHB("Paladin");

/** A class row a character multiclasses into, with what its `multiclassing` grants. */
const entryRow = (ref: { name: string; source: string }, hitDie: number, json: object) => ({
  ...ref,
  edition: "one",
  hitDie,
  json: { ...ref, ...json },
});

const SEARCH: Record<string, object[]> = {
  class: [ROGUE, PALADIN, WARLOCK].map((ref) => ({ type: "class", ...ref, edition: "one" })),
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
  "/api/classes/Warlock/XPHB/at/1": grants(1, 1, [feature("Pact Magic", 1)]),
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
  "/api/classes/Paladin/XPHB/at/1": grants(1, 0, [feature("Lay On Hands", 1)]),
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

/** Stands for a write from another tab, which this tab's cache has not seen. */
function editElsewhere(edit: Partial<CharacterDefinition>) {
  server = {
    ...server,
    definition: { ...server.definition, ...edit },
    updatedAt: "2024-01-01T00:05:00.000Z",
  };
}

function renderSeeded(character: CharacterRecord) {
  server = character;
  readable = true;
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
    if (path === "/api/characters/1")
      return readable
        ? new Response(JSON.stringify(server))
        : new Response(JSON.stringify({ error: "offline" }), { status: 500 });
    if (path in ROWS) return new Response(JSON.stringify(ROWS[path]));
    if (path.startsWith("/api/search?")) {
      const items = SEARCH[new URL(path, "http://local").searchParams.get("type") ?? ""] ?? [];
      return new Response(JSON.stringify({ ...page(items), limit: 200, offset: 0 }));
    }
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
  fireEvent.change(
    within(dialog()).getByRole("combobox", { name: "Multiclass into a new class" }),
    {
      target: { value: name.slice(0, 3) },
    },
  );
  fireEvent.click(await within(dialog()).findByRole("option", { name: new RegExp(name) }));
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
    expect(within(dialog()).getByText("Eldritch Invocation options known")).toBeVisible();
    expect(within(dialog()).getByText("1 → 3")).toBeVisible();
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
  });
});
