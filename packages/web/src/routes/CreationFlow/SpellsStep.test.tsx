import type { CharacterDefinition } from "@dnd/character";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { useWatch } from "react-hook-form";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithClient } from "../../test/renderWithClient.tsx";
import { CreationSpells } from "./CreationSpells.tsx";
import { creationForm } from "./creationForm.ts";
import { SpellsStep } from "./SpellsStep.tsx";
import { useSpellsDone } from "./useSpellsDone.ts";

const PHB = (name: string) => ({ name, source: "PHB" });
const page = (items: unknown[]) => ({ items, total: items.length, limit: 200, offset: 0 });
const grants = (resources: Record<string, string>, slots: number[]) => ({
  level: 1,
  resources: Object.entries(resources).map(([resourceKey, value]) => ({ resourceKey, value })),
  spellSlots: slots.map((count, index) => ({ slotLevel: index + 1, slots: count })),
  optionalFeatures: [],
  features: [],
});

const classRow = (name: string, hitDie: number, json: Record<string, unknown> = {}) => ({
  ...PHB(name),
  edition: "classic",
  hitDie,
  json: { ...PHB(name), ...json },
});

const ROWS: Record<string, unknown> = {
  "/api/classes/Wizard/PHB": classRow("Wizard", 6, {
    spellcastingAbility: "int",
    preparedSpells: "<$level$> + <$int_mod$>",
  }),
  "/api/classes/Fighter/PHB": classRow("Fighter", 10),
  "/api/classes/Wizard/PHB/at/1": grants({ cantrips_known: "1" }, [2]),
  "/api/classes/Fighter/PHB/at/1": grants({}, []),
  "/api/classes/Wizard/PHB/subclasses?edition=classic&limit=200": page([]),
  "/api/classes/Fighter/PHB/subclasses?edition=classic&limit=200": page([]),
};

/** Each spell's level and the classes whose list holds it. */
const SPELLS: Record<string, { level: number; lists: string[] }> = {
  "Fire Bolt": { level: 0, lists: ["Wizard"] },
  "Sacred Flame": { level: 0, lists: ["Cleric"] },
  Shield: { level: 1, lists: ["Wizard"] },
  "Magic Missile": { level: 1, lists: ["Wizard"] },
  "Cure Wounds": { level: 1, lists: ["Cleric"] },
  Fireball: { level: 3, lists: ["Wizard"] },
};

/** The picks the draft's race offers, which a test widens. */
let raceOffers = { cantrips: 0, spells: 0, learned: 0, alternatives: false };

function stubCatalog() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const params = new URL(url, "http://local").searchParams;
      let body: unknown = ROWS[url];
      if (url.startsWith("/api/spells/granted?")) {
        const race = params.get("grantor") === "race";
        body = {
          spells: race ? [PHB("Thaumaturgy")] : [],
          picks: race ? raceOffers : { cantrips: 0, spells: 0, learned: 0, alternatives: false },
        };
      } else if (url === "/api/spells/lookup") {
        const request = JSON.parse(String(init?.body)) as {
          spells: { name: string }[];
          list?: { class: { name: string } };
          offeredBy?: unknown[];
        };
        body = {
          spells: request.spells.map(({ name }) => {
            const spell = SPELLS[name];
            if (!spell) return null;
            const listed = request.list && spell.lists.includes(request.list.class.name);
            const offered = request.offeredBy && name === "Sacred Flame";
            return {
              name,
              level: spell.level,
              ...(request.list && { listed }),
              ...(request.offeredBy && { offered }),
            };
          }),
        };
      } else if (url.startsWith("/api/search?")) {
        const cls = params.get("class")?.split("|")[0];
        const min = Number(params.get("minLevel"));
        const max = Number(params.get("maxLevel"));
        body = page(
          Object.entries(SPELLS)
            .filter(([, { level }]) => level >= min && level <= max)
            .filter(([, { lists }]) => cls === undefined || lists.includes(cls))
            .map(([name]) => ({ type: "spell", ...PHB(name), edition: "classic" })),
        );
      }
      return body === undefined
        ? new Response(JSON.stringify({ error: `nothing at ${url}` }), { status: 404 })
        : new Response(JSON.stringify(body), { status: 200 });
    }),
  );
}

let values: Partial<CharacterDefinition> = {};
let done = false;

function Values() {
  values = useWatch<CharacterDefinition>() as Partial<CharacterDefinition>;
  done = useSpellsDone();
  return null;
}

function renderStep(className = "Wizard") {
  localStorage.setItem(
    "draft:creation",
    JSON.stringify({
      edition: "classic",
      race: PHB("Tiefling"),
      levels: [{ class: PHB(className) }],
      abilityScores: { str: 10, dex: 10, con: 10, int: 12, wis: 10, cha: 10 },
    }),
  );
  return renderWithClient(
    <creationForm.FormShell onSubmit={() => {}}>
      {() => (
        <>
          <CreationSpells />
          <SpellsStep />
          <Values />
        </>
      )}
    </creationForm.FormShell>,
  );
}

const section = (name: string) => screen.getByRole("region", { name });

async function pick(label: string, option: string) {
  const input = screen.getByRole("combobox", { name: label });
  fireEvent.focus(input);
  fireEvent.click(await screen.findByRole("option", { name: new RegExp(option) }));
}

const picks = () => (values.spells ?? []).filter((entry) => !entry.granted);

describe("SpellsStep", () => {
  beforeEach(() => {
    localStorage.clear();
    raceOffers = { cantrips: 0, spells: 0, learned: 0, alternatives: false };
    stubCatalog();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("asks for the class's counts, a 2014 wizard preparing its level plus its Intelligence modifier", async () => {
    renderStep();

    expect(await screen.findByRole("region", { name: "Cantrips" })).toHaveTextContent(
      "Choose 1 — 0 selected",
    );
    expect(section("Spells Prepared")).toHaveTextContent("Choose 2 — 0 selected");
  });

  it("shows a granted spell apart from the picks, and stores it marked granted", async () => {
    renderStep();

    const granted = await screen.findByRole("region", { name: "Granted by Tiefling" });
    expect(granted).toHaveTextContent("Thaumaturgy");
    await waitFor(() =>
      expect(values.spells).toEqual([{ ref: PHB("Thaumaturgy"), prepared: true, granted: true }]),
    );
    expect(picks()).toEqual([]);
  });

  it("offers the class's list at the levels its slots cast, and lands a pick as prepared", async () => {
    renderStep();
    await screen.findByRole("region", { name: "Spells Prepared" });

    const input = screen.getByRole("combobox", { name: "Add a spell" });
    fireEvent.focus(input);
    const list = await screen.findByRole("listbox", { name: "Add a spell" });
    await waitFor(() =>
      expect(
        within(list)
          .getAllByRole("option")
          .map((option) => option.textContent),
      ).toEqual([expect.stringContaining("Shield"), expect.stringContaining("Magic Missile")]),
    );
    fireEvent.click(within(list).getByRole("option", { name: /Shield/ }));

    await waitFor(() => expect(picks()).toEqual([{ ref: PHB("Shield"), prepared: true }]));
    await waitFor(() =>
      expect(section("Spells Prepared")).toHaveTextContent("Choose 2 — 1 selected"),
    );
  });

  it("notes a pick off the list or past a count, taken through the escape, and marks the step done", async () => {
    renderStep();
    await screen.findByRole("region", { name: "Cantrips" });

    await pick("Add a cantrip", "Fire Bolt");
    await pick("Add a spell", "Shield");
    await pick("Add a spell", "Magic Missile");
    await waitFor(() => expect(done).toBe(true));
    expect(values.departures ?? []).toEqual([]);

    fireEvent.click(screen.getByRole("checkbox", { name: /Offer spells off the Wizard list/ }));
    await pick("Add a spell", "Cure Wounds");

    const note =
      "3 spells prepared, where the class allows 2; Cure Wounds picked off the Wizard spell list.";
    await waitFor(() => expect(values.departures).toEqual([{ field: "spells", note }]));
    expect(screen.getByText(note).previousElementSibling).toHaveTextContent("Off the rules");

    fireEvent.click(screen.getByRole("button", { name: "Remove Cure Wounds" }));
    await waitFor(() => expect(values.departures).toEqual([]));
  });

  it("excuses a pick the race offers from the class's count and list", async () => {
    raceOffers = { cantrips: 1, spells: 0, learned: 0, alternatives: false };
    renderStep();
    await screen.findByRole("region", { name: "Cantrips" });

    await pick("Add a cantrip", "Fire Bolt");
    fireEvent.click(screen.getByRole("checkbox", { name: /Offer spells off the Wizard list/ }));
    await pick("Add a cantrip", "Sacred Flame");

    await waitFor(() =>
      expect(picks().map((entry) => ("name" in entry.ref ? entry.ref.name : ""))).toEqual([
        "Fire Bolt",
        "Sacred Flame",
      ]),
    );
    await waitFor(() => expect(section("Cantrips")).toHaveTextContent("Choose 2 — 2 selected"));
    expect(values.departures ?? []).toEqual([]);
  });

  it("says a class that casts nothing has nothing to choose, and counts the step done", async () => {
    renderStep("Fighter");

    expect(
      await screen.findByText(/Fighter doesn't cast spells at level 1\. Nothing to choose here/),
    ).toBeVisible();
    expect(screen.queryByRole("combobox")).toBeNull();
    await waitFor(() => expect(done).toBe(true));
  });

  it("offers a class that casts nothing the picks its race offers, done once they are made", async () => {
    raceOffers = { cantrips: 1, spells: 0, learned: 0, alternatives: false };
    renderStep("Fighter");

    expect(
      await screen.findByText(/Fighter doesn't cast spells at level 1\. Pick here only the spells/),
    ).toBeVisible();
    expect(section("Cantrips")).toHaveTextContent("Choose 1 — 0 selected");
    expect(done).toBe(false);

    await pick("Add a cantrip", "Sacred Flame");
    await waitFor(() => expect(done).toBe(true));
    expect(values.departures ?? []).toEqual([]);
  });
});
