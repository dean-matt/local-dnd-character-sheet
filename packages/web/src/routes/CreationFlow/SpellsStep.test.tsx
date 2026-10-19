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

const WIZARD = { spellcastingAbility: "int", preparedSpells: "<$level$> + <$int_mod$>" };

const ROWS: Record<string, unknown> = {
  "/api/classes/Wizard/PHB": classRow("Wizard", 6, WIZARD),
  "/api/classes/Fighter/PHB": classRow("Fighter", 10),
  "/api/classes/Wizard/PHB/at/1": grants({ cantrips_known: "1" }, [2]),
  "/api/classes/Wizard/PHB/at/3": grants({ cantrips_known: "1" }, [4, 2]),
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

/** The list a race's picks come from, as its `choose` filter names it. */
const RACE_LIST = "Cleric";

/** The picks the draft's race offers, which a test widens. */
let raceOffers = { cantrips: 0, spells: 0, learned: 0, alternatives: false };

/** The alternative blocks the draft's race offers, which a test names. */
let raceBlocks: string[] = [];

/** What `POST /spells/lookup` answers, a row's offer holding the race's list. */
function lookup(request: {
  spells: { name: string }[];
  list?: { class: { name: string } };
  offer?: unknown;
}) {
  return {
    spells: request.spells.map(({ name }) => {
      const spell = SPELLS[name];
      if (!spell) return null;
      const listed = request.offer
        ? spell.lists.includes(RACE_LIST)
        : request.list && spell.lists.includes(request.list.class.name);
      return { name, level: spell.level, ...(listed !== undefined && { listed }) };
    }),
  };
}

/** What `GET /search` answers, narrowed to a row's offer as to the race's list. */
function search(params: URLSearchParams) {
  const cls = params.get("offer") ? RACE_LIST : params.get("class")?.split("|")[0];
  const min = Number(params.get("minLevel"));
  const max = Number(params.get("maxLevel"));
  return page(
    Object.entries(SPELLS)
      .filter(([, { level }]) => level >= min && level <= max)
      .filter(([, { lists }]) => cls === undefined || lists.includes(cls))
      .map(([name]) => ({ type: "spell", ...PHB(name), edition: "classic" })),
  );
}

/** What `GET /spells/granted` answers: the race's spells and offer, and nothing for any other row. */
function granted(params: URLSearchParams) {
  const race = params.get("grantor") === "race";
  const chosen = params.get("block") === "1";
  return {
    spells: race ? [PHB("Thaumaturgy"), ...(chosen ? [PHB("Fire Bolt")] : [])] : [],
    blocks: race ? raceBlocks : [],
    picks: race ? raceOffers : { cantrips: 0, spells: 0, learned: 0, alternatives: false },
  };
}

function stubCatalog() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const params = new URL(url, "http://local").searchParams;
      let body: unknown = ROWS[url];
      if (url.startsWith("/api/spells/granted?")) {
        body = granted(params);
      } else if (url === "/api/spells/lookup") {
        body = lookup(JSON.parse(String(init?.body)));
      } else if (url.startsWith("/api/search?")) {
        body = search(params);
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

function renderStep(className = "Wizard", draft: Partial<CharacterDefinition> = {}) {
  localStorage.setItem(
    "draft:creation",
    JSON.stringify({
      edition: "classic",
      race: PHB("Tiefling"),
      levels: [{ class: PHB(className) }],
      abilityScores: { str: 10, dex: 10, con: 10, int: 12, wis: 10, cha: 10 },
      ...draft,
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
    raceBlocks = [];
    stubCatalog();
  });
  afterEach(() => {
    ROWS["/api/classes/Wizard/PHB"] = classRow("Wizard", 6, WIZARD);
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

  it("fills a spellbook first, prepares from it, and notes a book past its size", async () => {
    ROWS["/api/classes/Wizard/PHB"] = classRow("Wizard", 6, {
      ...WIZARD,
      spellsKnownProgressionFixed: [2, 2],
    });
    renderStep("Wizard", { spells: [{ ref: PHB("Fire Bolt"), prepared: false }] });

    const book = await screen.findByRole("region", { name: "Spellbook" });
    expect(book).toHaveTextContent("Choose 2 — 0 selected");
    expect(section("Spells Prepared")).toHaveTextContent("Add spells to the spellbook");

    await pick("Add a spell", "Shield");
    await pick("Add a spell", "Magic Missile");
    await waitFor(() =>
      expect(picks().slice(1)).toEqual([
        { ref: PHB("Shield"), prepared: false },
        { ref: PHB("Magic Missile"), prepared: false },
      ]),
    );
    const prepared = section("Spells Prepared");
    expect(prepared).toHaveTextContent("Choose 2 from the spellbook — 0 selected");
    expect(done).toBe(false);

    fireEvent.click(within(prepared).getByRole("button", { name: "Shield", pressed: false }));
    fireEvent.click(within(prepared).getByRole("button", { name: "Magic Missile" }));
    await waitFor(() => expect(done).toBe(true));
    expect(within(prepared).getByRole("button", { name: "Shield" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(values.departures ?? []).toEqual([]);

    fireEvent.click(screen.getByRole("checkbox", { name: /Offer spells off the Wizard list/ }));
    await pick("Add a spell", "Cure Wounds");
    const note =
      "3 spells in the spellbook, where the class holds 2; Cure Wounds picked off the Wizard spell list.";
    await waitFor(() => expect(values.departures).toEqual([{ field: "spells", note }]));
  });

  it("sizes the spellbook by every level's gain up to the class's level", async () => {
    ROWS["/api/classes/Wizard/PHB"] = classRow("Wizard", 6, {
      ...WIZARD,
      spellsKnownProgressionFixed: [6, 2, 2, 2],
    });
    const wizard = { class: PHB("Wizard") };
    renderStep("Wizard", { levels: [wizard, wizard, wizard] });

    expect(await screen.findByRole("region", { name: "Spellbook" })).toHaveTextContent(
      "Choose 10 — 0 selected",
    );
  });

  it("asks to prepare no more than a book smaller than the count holds", async () => {
    ROWS["/api/classes/Wizard/PHB"] = classRow("Wizard", 6, {
      ...WIZARD,
      spellsKnownProgressionFixed: [2, 2],
    });
    renderStep("Wizard", {
      abilityScores: { str: 10, dex: 10, con: 10, int: 20, wis: 10, cha: 10 },
    });

    await screen.findByRole("region", { name: "Spellbook" });
    expect(section("Spells Prepared")).toHaveTextContent("Choose 2 from the spellbook");
  });

  it("asks a class with spellbook gains but no preparation formula for no spellbook", async () => {
    ROWS["/api/classes/Wizard/PHB"] = classRow("Wizard", 6, {
      spellcastingAbility: "int",
      spellsKnownProgressionFixed: [6, 2],
    });
    renderStep();

    await screen.findByRole("region", { name: "Spells Known" });
    expect(screen.queryByRole("region", { name: "Spellbook" })).toBeNull();
  });

  it("says a class that casts nothing has nothing to choose, and counts the step done", async () => {
    renderStep("Fighter");

    expect(
      await screen.findByText(/Fighter doesn't cast spells at level 1\. Nothing to choose here/),
    ).toBeVisible();
    expect(screen.queryByRole("combobox")).toBeNull();
    await waitFor(() => expect(done).toBe(true));
  });

  it("asks which of a race's alternative blocks applies, and grants the chosen block's spells", async () => {
    raceBlocks = ["Abyssal", "Infernal"];
    renderStep();

    const choice = await screen.findByRole("group", { name: /Tiefling: which spells apply/ });
    expect(values.spells).not.toContainEqual(expect.objectContaining({ ref: PHB("Fire Bolt") }));
    fireEvent.click(within(choice).getByRole("button", { name: "Infernal" }));

    await waitFor(() =>
      expect(values.spellBlocks).toEqual([
        { grantor: { kind: "race", ref: PHB("Tiefling") }, block: 1 },
      ]),
    );
    await waitFor(() =>
      expect(values.spells).toContainEqual({
        ref: PHB("Fire Bolt"),
        prepared: true,
        granted: true,
      }),
    );
    expect(screen.getByRole("button", { name: "Infernal" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("widens no class count by the picks a race offers", async () => {
    raceOffers = { cantrips: 1, spells: 0, learned: 0, alternatives: false };
    renderStep();
    expect(await screen.findByRole("region", { name: "Cantrips" })).toHaveTextContent(
      "Choose 1 — 0 selected",
    );
  });

  it("asks a class that casts nothing for the picks a race offers, and the step waits on them", async () => {
    raceOffers = { cantrips: 1, spells: 0, learned: 0, alternatives: false };
    renderStep("Fighter");

    expect(
      await screen.findByText(/Fighter doesn't cast spells at level 1\. Pick here only/),
    ).toBeVisible();
    const field = await screen.findByRole("region", { name: "Cantrips from Tiefling" });
    expect(field).toHaveTextContent("Choose 1 — 0 selected");
    expect(done).toBe(false);

    await pick("Add a cantrip", "Sacred Flame");
    await waitFor(() =>
      expect(picks()).toEqual([
        {
          ref: PHB("Sacred Flame"),
          prepared: true,
          pickedFor: { kind: "race", ref: PHB("Tiefling") },
        },
      ]),
    );
    await waitFor(() => expect(done).toBe(true));
    expect(values.departures ?? []).toEqual([]);
  });

  it("holds a race's picks apart from the class's counts and list", async () => {
    raceOffers = { cantrips: 1, spells: 0, learned: 0, alternatives: false };
    renderStep();
    const own = await screen.findByRole("region", { name: "Cantrips" });
    await screen.findByRole("region", { name: "Cantrips from Tiefling" });

    const raceInput = within(section("Cantrips from Tiefling")).getByRole("combobox");
    fireEvent.focus(raceInput);
    fireEvent.click(await screen.findByRole("option", { name: /Sacred Flame/ }));
    await waitFor(() =>
      expect(section("Cantrips from Tiefling")).toHaveTextContent("Choose 1 — 1 selected"),
    );
    expect(own).toHaveTextContent("Choose 1 — 0 selected");
    expect(done).toBe(false);
    expect(values.departures ?? []).toEqual([]);
  });

  it("lists a pick made for a row that offers none now, so its departure can be cleared", async () => {
    const pickedFor = { kind: "feat" as const, ref: PHB("Alert") };
    renderStep("Wizard", { spells: [{ ref: PHB("Light"), prepared: true, pickedFor }] });

    const stray = await screen.findByRole("region", { name: "Picked for Alert" });
    const note = "Light picked for Alert, which offers none.";
    await waitFor(() => expect(values.departures).toEqual([{ field: "spells", note }]));

    fireEvent.click(within(stray).getByRole("button", { name: "Remove Light" }));
    await waitFor(() => expect(values.departures).toEqual([]));
    expect(screen.queryByRole("region", { name: "Picked for Alert" })).toBeNull();
  });
});
