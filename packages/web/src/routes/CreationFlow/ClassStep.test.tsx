import type { CharacterDefinition } from "@dnd/character";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { useWatch } from "react-hook-form";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithClient } from "../../test/renderWithClient.tsx";
import { ClassStep } from "./ClassStep.tsx";
import { CreationGrants } from "./CreationGrants.tsx";
import { CreationPrerequisites } from "./CreationPrerequisites.tsx";
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
  multiclassing: {
    requirements: { or: [{ str: 13, dex: 13 }] },
    proficienciesGained: {
      weapons: ["simple", "martial"],
      armorProficiencies: [{ light: true, medium: true, shield: true }],
    },
  },
  classFeatures: [gains("Martial Archetype", "Fighter", "", 3)],
});
const WIZARD = classRow("Wizard", "PHB", 6, {
  proficiency: ["int", "wis"],
  multiclassing: { requirements: { int: 13 } },
  classFeatures: [gains("Arcane Tradition", "Wizard", "", 2)],
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
  "/api/classes/Wizard/PHB": WIZARD,
  "/api/classes/Wizard/PHB/subclasses?edition=classic&limit=200": page([
    subclass("School of Evocation", WIZARD),
  ]),
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
        ? [
            hit("Cleric", "PHB"),
            hit("Fighter", "PHB"),
            hit("Wizard", "PHB"),
            hit("Cleric", "XPHB"),
          ].filter((each) => each.edition === params.get("edition"))
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

function renderStep(
  edition: CharacterDefinition["edition"] = "classic",
  draft: Partial<CharacterDefinition> = {},
) {
  localStorage.setItem("draft:creation", JSON.stringify({ edition, ...draft }));
  renderWithClient(
    <creationForm.FormShell onSubmit={() => {}}>
      {() => (
        <>
          <CreationGrants />
          <CreationPrerequisites />
          <ClassStep />
          <Values />
        </>
      )}
    </creationForm.FormShell>,
  );
}

async function pickClass(query: string, option: RegExp, label = "Class") {
  fireEvent.change(screen.getByRole("combobox", { name: label }), { target: { value: query } });
  fireEvent.click(await screen.findByRole("option", { name: option }));
}

async function addClass(query: string, option: RegExp) {
  click("Add another class");
  await pickClass(query, option, "Another class");
}

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));
/** Each grid cell after the first level, as its term and value read. */
const cells = () =>
  screen
    .getAllByRole("term")
    .slice(1)
    .map((term) => `${term.textContent}: ${term.nextElementSibling?.textContent}`);

const setLevel = (level: number, label = "Level") =>
  fireEvent.change(screen.getByRole("spinbutton", { name: label }), {
    target: { value: String(level) },
  });

const classesOf = () =>
  values.levels?.map((level) => ("name" in level.class ? level.class.name : ""));

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
    await waitFor(() => expect(cells()).toEqual(["Level 2: 6", "Level 3: 6"]));
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
    type(4, "-10");
    expect(screen.getByText("33")).toBeVisible();
    type(4, "");
    await waitFor(() =>
      expect(values.departures).toEqual([
        {
          field: "levels.2.rolled",
          note: "Level 3 gains 15 hit points, outside the d10's 1 to 10.",
        },
      ]),
    );

    type(3, "-");
    expect(
      screen.queryByText("Level 3: A hit point gain is a whole number from -999 to 999."),
    ).not.toBeInTheDocument();
    for (const text of ["1.5", "ten", "1000"]) {
      type(3, text);
      expect(
        screen.getByText("Level 3: A hit point gain is a whole number from -999 to 999."),
      ).toBeVisible();
      expect(gain(3)).toHaveAccessibleDescription(
        "Level 3: A hit point gain is a whole number from -999 to 999.",
      );
    }
    fireEvent.blur(gain(3));
    expect(gain(3)).toHaveValue("1000");
    expect(gain(3)).toHaveAccessibleDescription(
      "Level 3: A hit point gain is a whole number from -999 to 999.",
    );
    expect(values.levels?.[2]?.rolled).toBe(15);

    click("Roll");
    await waitFor(() =>
      expect(values.levels?.map((level) => level.rolled)).toEqual([undefined, 7, 15, 10]),
    );
    expect(cells()).toEqual(["Level 2: 7", "Level 3: 15typed", "Level 4: 10"]);

    setLevel(2);
    await waitFor(() => expect(values.departures).toEqual([]));

    click("Custom");
    click("Average");
    expect(values.levels?.map((level) => level.rolled)).toEqual([undefined, undefined]);
  });

  it("holds 1st level at the die's maximum in the grid's first cell, under every method", async () => {
    renderStep();
    const first = () => screen.getAllByRole("term")[0]?.nextElementSibling as HTMLElement;

    await pickClass("fig", /^Fighter/);
    setLevel(2);
    await waitFor(() => expect(screen.getAllByRole("term")[0]).toHaveTextContent("Level 1"));
    expect(first()).toHaveTextContent(/^10/);
    expect(within(first()).getByText("max")).toBeVisible();
    expect(within(first()).getByText(", the die's maximum")).toHaveClass("sr-only");

    click("Custom");
    const fixed = screen.getByRole("textbox", { name: "Level 1, the die's maximum" });
    expect(fixed).toHaveValue("10");
    expect(fixed).toHaveAttribute("readonly");
    expect(within(first()).getByText("max")).toBeVisible();
    fireEvent.change(fixed, { target: { value: "4" } });
    expect(fixed).toHaveValue("10");
    expect(values.levels?.[0]?.rolled).toBeUndefined();
    expect(screen.queryByText(/highest face/)).not.toBeInTheDocument();
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
    expect(await screen.findByRole("term")).toHaveTextContent("Level 1");
    expect(screen.getByRole("term").nextElementSibling).toHaveTextContent(/^10/);

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
  it("starts a character in two classes, summing their levels, each level on its own die", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    renderStep();

    await pickClass("fig", /^Fighter/);
    setLevel(3);
    await addClass("wiz", /^Wizard/);

    expect(screen.getByRole("button", { name: "Clear class, Wizard" })).toHaveFocus();
    setLevel(2, "Wizard level");
    expect(classesOf()).toEqual(["Fighter", "Fighter", "Fighter", "Wizard", "Wizard"]);
    expect(screen.getByText("Character level").parentElement).toHaveTextContent(
      "Character level 5",
    );
    await waitFor(() =>
      expect(cells()).toEqual([
        "Level 2 d10: 6",
        "Level 3 d10: 6",
        "Level 4 d6: 4",
        "Level 5 d6: 4",
      ]),
    );
    expect(screen.getByText("30")).toBeVisible();

    fireEvent.click(await screen.findByRole("button", { name: "Champion" }));
    fireEvent.click(await screen.findByRole("button", { name: "School of Evocation" }));
    expect(values.levels?.map((level) => level.subclass?.name)).toEqual([
      undefined,
      undefined,
      "Champion",
      undefined,
      "School of Evocation",
    ]);

    click("Roll");
    await waitFor(() =>
      expect(values.levels?.map((level) => level.rolled)).toEqual([undefined, 10, 10, 6, 6]),
    );
    expect(screen.getByText("42")).toBeVisible();

    setLevel(1, "Fighter level");
    expect(classesOf()).toEqual(["Fighter", "Wizard", "Wizard"]);
    expect(values.levels?.some((level) => level.subclass?.name === "Champion")).toBe(false);
    expect(values.levels?.map((level) => level.rolled)).toEqual([undefined, 6, 6]);
  });

  it("closes an opened class picker unpicked on Cancel, handing focus back", async () => {
    renderStep();

    await pickClass("fig", /^Fighter/);
    click("Add another class");
    expect(screen.getByRole("combobox", { name: "Another class" })).toHaveFocus();
    click("Cancel");

    expect(screen.queryByRole("combobox", { name: "Another class" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add another class" })).toHaveFocus();
    expect(classesOf()).toEqual(["Fighter"]);
  });

  it("holds the classes' levels to 20 between them", async () => {
    renderStep();

    await pickClass("fig", /^Fighter/);
    setLevel(19);
    await addClass("wiz", /^Wizard/);
    setLevel(2, "Wizard level");

    expect(screen.getByText("A level is a whole number from 1 to 1.")).toBeVisible();
    expect(values.levels).toHaveLength(20);
    expect(
      screen.getByText("The character is at level 20, so takes no further class."),
    ).toBeVisible();
  });

  it("grants a later class its multiclass proficiencies and no saves, and takes them back on removal", async () => {
    renderStep();

    await pickClass("cle", /^Cleric/);
    await waitFor(() => expect(values.proficiencies?.armor).toEqual(["Light"]));
    await addClass("fig", /^Fighter/);

    expect(
      await screen.findByText("Multiclassing grants: Simple, Martial, Light, Medium, Shield"),
    ).toBeVisible();
    await waitFor(() =>
      expect(values.proficiencies).toMatchObject({
        savingThrows: ["wis", "cha"],
        weapons: ["Simple", "Martial"],
        armor: ["Light", "Medium", "Shield"],
      }),
    );

    click("Clear class, Fighter");

    expect(screen.getByRole("button", { name: "Add another class" })).toHaveFocus();
    await waitFor(() =>
      expect(values.proficiencies).toMatchObject({
        savingThrows: ["wis", "cha"],
        weapons: ["Simple"],
        armor: ["Light"],
      }),
    );
  });

  it("names each class's multiclass prerequisite, and notes one the scores miss as a departure", async () => {
    renderStep();

    await pickClass("fig", /^Fighter/);
    await addClass("wiz", /^Wizard/);

    expect(
      await screen.findByText("Multiclassing in or out of Wizard needs Intelligence 13."),
    ).toBeVisible();
    expect(
      screen.getByText("Multiclassing in or out of Fighter needs Strength 13 or Dexterity 13."),
    ).toBeVisible();
    expect(values.departures).toEqual([]);
  });

  it("records a class taken without its prerequisite as a departure, never refusing it", async () => {
    const abilityScores = { str: 15, dex: 10, con: 14, int: 8, wis: 12, cha: 10 };
    renderStep("classic", { abilityScores });

    await pickClass("fig", /^Fighter/);
    await addClass("wiz", /^Wizard/);

    const note = "Multiclassing in or out of Wizard needs Intelligence 13.";
    await waitFor(() => expect(values.departures).toEqual([{ field: "levels.1.class", note }]));
    expect(screen.getByText(note)).toBeVisible();
    expect(screen.getByText("Off the rules")).toBeVisible();
    expect(classesOf()).toEqual(["Fighter", "Wizard"]);

    click("Clear class, Wizard");
    await waitFor(() => expect(values.departures).toEqual([]));
  });
  it("notes a typed first class under its own row, and drops the note when it leaves", async () => {
    renderStep();

    click("Not listed? Type a class");
    fireEvent.change(screen.getByRole("textbox", { name: "Class name" }), {
      target: { value: "Blood Hunter" },
    });
    click("d10");
    click("Use");
    await screen.findByRole("button", { name: "Clear class, Blood Hunter" });
    await addClass("fig", /^Fighter/);

    expect(screen.getAllByText("Off the rules")).toHaveLength(1);

    click("Clear class, Blood Hunter");

    expect(values.levels).toEqual([{ class: { name: "Fighter", source: "PHB" } }]);
    expect(values.departures).toEqual([]);
    expect(screen.queryByText("Off the rules")).not.toBeInTheDocument();
  });
});
