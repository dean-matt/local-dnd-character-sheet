import type { CharacterDefinition } from "@dnd/character";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { useWatch } from "react-hook-form";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithClient } from "../../test/renderWithClient.tsx";
import { ClassStep } from "./ClassStep.tsx";
import { CreationGrants } from "./CreationGrants.tsx";
import { creationForm } from "./creationForm.ts";

const page = (items: unknown[]) => ({ items, total: items.length, limit: 200, offset: 0 });
const gains = (name: string, cls: string, source: string, level: number) => ({
  classFeature: `${name}|${cls}|${source}|${level}`,
  gainSubclassFeature: true,
});

const classRow = (name: string, source: string, hitDie: number, json: object) => ({
  name,
  source,
  edition: source === "PHB" ? "classic" : "one",
  hitDie,
  json: { name, source, ...json },
});

const CLERIC = classRow("Cleric", "PHB", 8, {
  proficiency: ["wis", "cha"],
  startingProficiencies: { weapons: ["simple"], armorProficiencies: [{ light: true }] },
  classFeatures: [gains("Divine Domain", "Cleric", "", 1)],
});
const CLERIC_2024 = classRow("Cleric", "XPHB", 8, {
  proficiency: ["wis", "cha"],
  classFeatures: [gains("Cleric Subclass", "Cleric", "XPHB", 3)],
});
const FIGHTER = classRow("Fighter", "PHB", 10, {
  proficiency: ["str", "con"],
  startingProficiencies: { weapons: ["simple", "martial"] },
  classFeatures: [gains("Martial Archetype", "Fighter", "", 3)],
});

const subclass = (name: string, cls: { name: string; source: string; edition: string }) => ({
  name,
  source: cls.source,
  shortName: name.split(" ")[0],
  className: cls.name,
  classSource: cls.source,
  edition: cls.edition,
  json: { name, source: cls.source },
});

const feature = (name: string, level: number) => ({
  name,
  source: "PHB",
  level,
  json: { name, source: "PHB" },
});
const atLevel = (level: number, features: unknown[]) => ({
  level,
  resources: [],
  spellSlots: [],
  optionalFeatures: [],
  features,
});

const BLOOD_HUNTER = {
  id: "hb-1",
  name: "Blood Hunter",
  edition: "classic",
  hitDie: 10,
  json: { name: "Blood Hunter", source: "Homebrew", hd: { number: 1, faces: 10 } },
  createdAt: "2026-10-06T00:00:00.000Z",
};

const ROWS: Record<string, unknown> = {
  "/api/classes/Cleric/PHB": CLERIC,
  "/api/classes/Cleric/XPHB": CLERIC_2024,
  "/api/classes/Fighter/PHB": FIGHTER,
  "/api/classes/Cleric/PHB/subclasses?edition=classic&limit=200": page([
    subclass("Life Domain", CLERIC),
    subclass("War Domain", CLERIC),
  ]),
  "/api/classes/Cleric/XPHB/subclasses?edition=one&limit=200": page([
    subclass("Light Domain", CLERIC_2024),
  ]),
  "/api/classes/Fighter/PHB/subclasses?edition=classic&limit=200": page([
    subclass("Champion", FIGHTER),
  ]),
  "/api/classes/Cleric/PHB/at/1": atLevel(1, [
    feature("Spellcasting", 1),
    feature("Divine Domain", 1),
  ]),
  "/api/backgrounds?edition=classic&limit=200": page([]),
  "/api/backgrounds?edition=one&limit=200": page([]),
  "/api/homebrew/classes": [],
  "/api/homebrew/classes/hb-1": BLOOD_HUNTER,
};

const hit = (name: string, source: string) => ({
  type: "class",
  name,
  source,
  edition: source === "PHB" ? "classic" : "one",
});

function stubCatalog() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (init?.method === "POST") return new Response(JSON.stringify(BLOOD_HUNTER), { status: 201 });
    const params = new URL(url, "http://local").searchParams;
    const search =
      params.get("type") === "class"
        ? [hit("Cleric", "PHB"), hit("Fighter", "PHB"), hit("Cleric", "XPHB")].filter(
            (each) => each.edition === params.get("edition"),
          )
        : [];
    const body = url.startsWith("/api/search?") ? page(search) : ROWS[url];
    return body === undefined
      ? new Response(JSON.stringify({ error: `nothing at ${url}` }), { status: 404 })
      : new Response(JSON.stringify(body), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

let values: Partial<CharacterDefinition> = {};

function Values() {
  values = useWatch<CharacterDefinition>() as Partial<CharacterDefinition>;
  return null;
}

function renderStep(edition: CharacterDefinition["edition"] = "classic") {
  localStorage.setItem("draft:creation", JSON.stringify({ edition }));
  renderWithClient(
    <creationForm.FormShell onSubmit={() => {}}>
      {() => (
        <>
          <CreationGrants />
          <ClassStep />
          <Values />
        </>
      )}
    </creationForm.FormShell>,
  );
}

async function pickClass(query: string, option: RegExp) {
  fireEvent.change(screen.getByRole("combobox", { name: "Class" }), { target: { value: query } });
  fireEvent.click(await screen.findByRole("option", { name: option }));
}

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));
const setLevel = (level: number) =>
  fireEvent.change(screen.getByRole("spinbutton", { name: "Level" }), {
    target: { value: String(level) },
  });

describe("ClassStep", () => {
  beforeEach(() => {
    localStorage.clear();
    stubCatalog();
  });
  afterEach(() => {
    ROWS["/api/homebrew/classes"] = [];
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("offers a 2014 cleric's domain at 1st level, and lands the class's saves and proficiencies", async () => {
    renderStep();

    await pickClass("cle", /^Cleric/);

    expect(screen.getByRole("button", { name: "Clear class, Cleric" })).toHaveFocus();
    expect(await screen.findByRole("group", { name: "Subclass — choose one" })).toBeVisible();
    expect(
      await screen.findByText("Features by level 1: Spellcasting, Divine Domain"),
    ).toBeVisible();
    expect(screen.getByText("Saving throws: Wisdom, Charisma")).toBeVisible();
    await waitFor(() =>
      expect(values.proficiencies).toMatchObject({
        savingThrows: ["wis", "cha"],
        weapons: ["Simple"],
        armor: ["Light"],
      }),
    );

    click("Life Domain");

    expect(values.levels).toEqual([
      {
        class: { name: "Cleric", source: "PHB" },
        subclass: { name: "Life Domain", source: "PHB" },
      },
    ]);
  });

  it("waits until 3rd level for a 2024 cleric's subclass, and drops it below that", async () => {
    renderStep("one");

    await pickClass("cle", /^Cleric/);
    expect(await screen.findByText("Cleric chooses a subclass at level 3.")).toBeVisible();

    setLevel(3);
    fireEvent.click(await screen.findByRole("button", { name: "Light Domain" }));

    expect(values.levels?.map((level) => level.subclass)).toEqual([
      undefined,
      undefined,
      { name: "Light Domain", source: "XPHB" },
    ]);

    setLevel(2);

    expect(values.levels).toHaveLength(2);
    expect(values.levels?.some((level) => level.subclass)).toBe(false);
  });

  it("says a typed level must be 1 to 20, and keeps the stored one", async () => {
    renderStep();

    await pickClass("fig", /^Fighter/);
    setLevel(25);

    expect(screen.getByText("A level is a whole number from 1 to 20.")).toBeVisible();
    expect(values.levels).toHaveLength(1);
  });

  it("takes the average or rolls each level after the first, as the player chooses", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    renderStep();

    await pickClass("fig", /^Fighter/);
    setLevel(3);
    expect(await screen.findByText("Level 2: 6")).toBeVisible();
    expect(screen.getByText("22")).toBeVisible();

    click("Roll");

    await waitFor(() =>
      expect(values.levels?.map((level) => level.rolled)).toEqual([undefined, 10, 10]),
    );
    expect(screen.getByText("30")).toBeVisible();

    vi.spyOn(Math, "random").mockReturnValue(0);
    click("Reroll");
    expect(values.levels?.map((level) => level.rolled)).toEqual([undefined, 1, 1]);

    click("Average");
    expect(values.levels?.map((level) => level.rolled)).toEqual([undefined, undefined, undefined]);
  });

  it("takes a typed gain for each level after the first, noting one the die cannot roll", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    renderStep();
    const gain = (level: number) => screen.getByRole("textbox", { name: `Level ${level} gain` });
    const type = (level: number, value: string) =>
      fireEvent.change(gain(level), { target: { value } });

    await pickClass("fig", /^Fighter/);
    setLevel(4);
    fireEvent.click(await screen.findByRole("button", { name: "Roll" }));
    await waitFor(() =>
      expect(values.levels?.map((level) => level.rolled)).toEqual([undefined, 10, 10, 10]),
    );

    click("Custom");
    expect(gain(2)).toHaveValue("10");
    type(2, "7");
    type(3, "15");
    type(4, "");
    expect(values.levels?.map((level) => level.rolled)).toEqual([undefined, 7, 15, undefined]);
    expect(screen.getByText("38")).toBeVisible();
    await waitFor(() =>
      expect(values.departures).toEqual([
        {
          field: "levels.2.rolled",
          note: "Level 3 gains 15 hit points, outside the d10's 1 to 10.",
        },
      ]),
    );

    for (const text of ["1.5", "-", "ten"]) {
      type(3, text);
      expect(screen.getByText("A hit point gain is a whole number.")).toBeVisible();
      expect(values.levels?.[2]?.rolled).toBe(15);
    }

    click("Roll");
    await waitFor(() =>
      expect(values.levels?.map((level) => level.rolled)).toEqual([undefined, 7, 15, 10]),
    );
    expect(screen.getByText("(typed)")).toBeVisible();

    setLevel(2);
    await waitFor(() => expect(values.departures).toEqual([]));

    click("Custom");
    click("Average");
    expect(values.levels?.map((level) => level.rolled)).toEqual([undefined, undefined]);
  });

  it("swaps the saves a replaced class granted for the new class's, keeping the level", async () => {
    renderStep();

    await pickClass("cle", /^Cleric/);
    setLevel(4);
    await waitFor(() => expect(values.proficiencies?.savingThrows).toEqual(["wis", "cha"]));

    click("Clear class, Cleric");
    expect(screen.getByRole("combobox", { name: "Class" })).toHaveFocus();
    await pickClass("fig", /^Fighter/);

    await waitFor(() => expect(values.proficiencies?.savingThrows).toEqual(["str", "con"]));
    expect(values.proficiencies?.armor).toEqual([]);
    expect(values.levels).toHaveLength(4);
    expect(screen.getByRole("spinbutton", { name: "Level" })).toHaveValue(4);
  });

  it("takes a class the catalog lacks as a homebrew class with the hit die named, noting the departure", async () => {
    const fetchMock = stubCatalog();
    renderStep();

    click("Not listed? Type a class");
    expect(screen.getByRole("textbox", { name: "Class name" })).toHaveFocus();
    fireEvent.change(screen.getByRole("textbox", { name: "Class name" }), {
      target: { value: "Blood Hunter" },
    });
    expect(screen.getByRole("button", { name: "Use" })).toBeDisabled();
    click("d10");
    click("Use");

    await waitFor(() => expect(values.levels).toEqual([{ class: { homebrewId: "hb-1" } }]));
    const [, init] = fetchMock.mock.calls.find(([, each]) => each?.method === "POST") ?? [];
    expect(JSON.parse(String(init?.body))).toEqual({
      name: "Blood Hunter",
      edition: "classic",
      hd: { number: 1, faces: 10 },
    });
    expect(values.departures).toEqual([
      {
        field: "levels",
        note: expect.stringContaining("Blood Hunter is a homebrew class"),
      },
    ]);
    expect(screen.getByRole("button", { name: "Clear class, Blood Hunter" })).toBeVisible();
    expect(await screen.findByText("Level 1: 10")).toBeVisible();

    click("Clear class, Blood Hunter");

    expect(values.levels).toEqual([]);
    expect(values.departures).toEqual([]);
  });

  it("reuses a stored homebrew class of the same name, edition and die", async () => {
    ROWS["/api/homebrew/classes"] = [BLOOD_HUNTER];
    const fetchMock = stubCatalog();
    renderStep();

    click("Not listed? Type a class");
    fireEvent.change(screen.getByRole("textbox", { name: "Class name" }), {
      target: { value: "blood hunter" },
    });
    click("d10");
    click("Use");

    await waitFor(() => expect(values.levels).toEqual([{ class: { homebrewId: "hb-1" } }]));
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });

  it("refuses to reuse a stored homebrew class on another die than the one named", async () => {
    ROWS["/api/homebrew/classes"] = [BLOOD_HUNTER];
    const fetchMock = stubCatalog();
    renderStep();

    click("Not listed? Type a class");
    fireEvent.change(screen.getByRole("textbox", { name: "Class name" }), {
      target: { value: "blood hunter" },
    });
    click("d8");
    click("Use");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Blood Hunter is already a homebrew class on a d10. Choose d10 to use it, or another name.",
    );
    expect(values.levels).toEqual([]);
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });
});
