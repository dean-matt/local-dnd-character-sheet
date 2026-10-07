import type { CharacterDefinition } from "@dnd/character";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { useWatch } from "react-hook-form";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithClient } from "../../test/renderWithClient.tsx";
import { CreationEquipment } from "./CreationEquipment.tsx";
import { CreationGrants } from "./CreationGrants.tsx";
import { CreationSkills } from "./CreationSkills.tsx";
import { creationForm } from "./creationForm.ts";
import { type EquipmentMemory, NO_EQUIPMENT } from "./equipmentPicks.ts";
import { ProficienciesStep } from "./ProficienciesStep.tsx";
import { useProficienciesDone } from "./useProficienciesDone.ts";

const PHB = (name: string) => ({ name, source: "PHB" });
const page = (items: unknown[]) => ({ items, total: items.length, limit: 200, offset: 0 });
const hit = (type: string, name: string, item?: object) => ({
  type,
  ...PHB(name),
  edition: "classic",
  ...(item && { item }),
});

const WIZARD = {
  ...PHB("Wizard"),
  edition: "classic",
  hitDie: 6,
  json: {
    ...PHB("Wizard"),
    startingProficiencies: {
      skills: [
        { choose: { from: ["arcana", "history", "insight", "medicine", "religion"], count: 2 } },
      ],
    },
    startingEquipment: {
      goldAlternative: "{@dice 4d4 × 10|4d4 × 10|Starting Gold}",
      defaultData: [
        { a: ["quarterstaff|phb"], b: ["dagger|phb"] },
        { a: ["component pouch|phb"], b: [{ equipmentType: "focusSpellcastingArcane" }] },
        { _: ["spellbook|phb", { special: "quill" }] },
      ],
    },
  },
};

const SAGE = {
  ...PHB("Sage"),
  edition: "classic",
  json: {
    ...PHB("Sage"),
    skillProficiencies: [{ arcana: true, history: true }],
    startingEquipment: [{ _: [{ item: "pouch|phb", containsValue: 1000 }] }],
  },
};

const ROWS: Record<string, unknown> = {
  "/api/classes/Wizard/PHB": WIZARD,
  "/api/classes/Wizard/PHB/subclasses?edition=classic&limit=200": page([]),
  "/api/backgrounds?edition=classic&limit=200": page([SAGE]),
};

const SKILLS = ["Arcana", "History", "Insight", "Medicine", "Religion"].map((name) =>
  hit("skill", name),
);
const ITEMS: Record<string, unknown[]> = {
  "": [hit("item", "Rope", { kinds: ["gear"], rarity: null, category: null })],
  focus: [hit("item", "Wand", { kinds: ["focus"], rarity: null, category: null })],
};
const CATALOG = ["Quarterstaff", "Dagger", "Component Pouch", "Spellbook", "Pouch"];

function stubCatalog() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const params = new URL(url, "http://local").searchParams;
      let body: unknown = ROWS[url];
      if (url === "/api/refs/resolve") {
        const { refs } = JSON.parse(String(init?.body)) as { refs: { name: string }[] };
        body = {
          refs: refs.map(({ name }) => {
            const row = CATALOG.find((each) => each.toLowerCase() === name.toLowerCase());
            return row ? { ...PHB(row), entries: [] } : null;
          }),
        };
      } else if (url.startsWith("/api/search?"))
        body = page(
          params.get("type") === "item" ? (ITEMS[params.get("kind") ?? ""] ?? []) : SKILLS,
        );
      return body === undefined
        ? new Response(JSON.stringify({ error: `nothing at ${url}` }), { status: 404 })
        : new Response(JSON.stringify(body), { status: 200 });
    }),
  );
}

let values: Partial<CharacterDefinition> = {};

function Values() {
  values = useWatch<CharacterDefinition>() as Partial<CharacterDefinition>;
  return null;
}

let done = false;

function Step() {
  const [memory, setMemory] = useState<EquipmentMemory>(NO_EQUIPMENT);
  done = useProficienciesDone(memory);
  return (
    <>
      <CreationSkills />
      <CreationEquipment memory={memory} onMemory={setMemory} />
      <ProficienciesStep memory={memory} onMemory={setMemory} />
    </>
  );
}

function renderStep({ keepDraft = false } = {}) {
  if (!keepDraft)
    localStorage.setItem(
      "draft:creation",
      JSON.stringify({
        edition: "classic",
        background: PHB("Sage"),
        levels: [{ class: PHB("Wizard") }],
      }),
    );
  renderWithClient(
    <creationForm.FormShell onSubmit={() => {}}>
      {() => (
        <>
          <CreationGrants />
          <Step />
          <Values />
        </>
      )}
    </creationForm.FormShell>,
  );
}

const checkbox = (name: RegExp) => screen.getByRole("checkbox", { name });
const radio = (name: RegExp) => screen.getByRole("radio", { name });
const inventoryNames = () =>
  (values.inventory ?? []).map((entry) => ("name" in entry.ref ? entry.ref.name : "homebrew"));

describe("ProficienciesStep", () => {
  beforeEach(() => {
    localStorage.clear();
    stubCatalog();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("shows a class skill the background grants as checked, disabled and granted", async () => {
    renderStep();

    const arcana = await screen.findByRole("checkbox", { name: /Arcana — granted by Background/ });
    expect(arcana).toBeChecked();
    expect(arcana).toBeDisabled();
    expect(screen.getByText("Choose 2 — 0 selected")).toBeVisible();
  });

  it("lands picked skills, and notes a pick past the count rather than refusing it", async () => {
    renderStep();

    fireEvent.click(await screen.findByRole("checkbox", { name: /^Insight/ }));
    fireEvent.click(checkbox(/^Religion/));

    await waitFor(() =>
      expect(values.proficiencies?.skills.map((skill) => skill.ref.name)).toEqual([
        "Arcana",
        "History",
        "Insight",
        "Religion",
      ]),
    );
    expect(screen.getByText("Choose 2 — 2 selected")).toBeVisible();
    expect(values.departures ?? []).toEqual([]);

    fireEvent.click(checkbox(/^Medicine/));

    await waitFor(() =>
      expect(values.departures).toEqual([
        {
          field: "proficiencies.skills",
          note: "3 skills taken from the Wizard list, which offers 2.",
        },
      ]),
    );
    fireEvent.click(checkbox(/^Medicine/));
    await waitFor(() => expect(values.departures).toEqual([]));
  });

  it("notes a skill no list offers, which stays listed so it can be cleared", async () => {
    localStorage.setItem(
      "draft:creation",
      JSON.stringify({
        edition: "classic",
        background: PHB("Sage"),
        levels: [{ class: PHB("Wizard") }],
        proficiencies: {
          savingThrows: [],
          skills: [{ ref: PHB("Stealth"), level: "proficient" }],
          armor: [],
          weapons: [],
          tools: [],
          languages: [],
        },
      }),
    );
    renderStep({ keepDraft: true });

    const stealth = await screen.findByRole("checkbox", { name: "Stealth" });
    expect(screen.getByRole("group", { name: "Other skills" })).toBeVisible();
    await waitFor(() =>
      expect(values.departures).toEqual([
        {
          field: "proficiencies.skills",
          note: "Stealth taken outside what the class and background offer.",
        },
      ]),
    );

    fireEvent.click(stealth);

    await waitFor(() => expect(values.departures).toEqual([]));
    expect(screen.queryByRole("group", { name: "Other skills" })).toBeNull();
  });

  it("lands what the lists give outright, then a pick, and takes back the pick it replaces", async () => {
    renderStep();

    await waitFor(() => expect(inventoryNames()).toEqual(["Spellbook", "Pouch"]));
    expect(values.money).toMatchObject({ gold: 10 });
    expect(screen.getByText("Spellbook, quill (not in the catalog)")).toBeVisible();

    fireEvent.click(radio(/\(b\) Dagger/));
    await waitFor(() => expect(inventoryNames()).toEqual(["Dagger", "Spellbook", "Pouch"]));

    fireEvent.click(radio(/\(a\) Quarterstaff/));
    await waitFor(() => expect(inventoryNames()).toEqual(["Quarterstaff", "Spellbook", "Pouch"]));
    expect(values.inventory?.[0]).toEqual({
      ref: PHB("Quarterstaff"),
      quantity: 1,
      carried: true,
      equipped: false,
      attuned: false,
    });
  });

  it("fills a slot for any item of a kind through a picker narrowed to it", async () => {
    renderStep();

    fireEvent.click(await screen.findByRole("radio", { name: /\(b\) an arcane focus/ }));
    const picker = screen.getByRole("combobox", { name: "Choose an arcane focus" });
    fireEvent.focus(picker);
    fireEvent.click(await screen.findByRole("option", { name: /Wand/ }));

    await waitFor(() => expect(inventoryNames()).toContain("Wand"));
    expect(
      screen.getByRole("button", { name: "Clear choose an arcane focus, Wand" }),
    ).toBeVisible();
    expect(values.departures ?? []).toEqual([]);
  });

  it("adds an item past the lists, and notes it as a departure", async () => {
    renderStep();
    await waitFor(() => expect(inventoryNames()).toEqual(["Spellbook", "Pouch"]));

    const picker = screen.getByRole("combobox", { name: "Add an item not on the lists" });
    fireEvent.focus(picker);
    fireEvent.click(await screen.findByRole("option", { name: /Rope/ }));

    await waitFor(() => expect(inventoryNames()).toEqual(["Spellbook", "Pouch", "Rope"]));
    expect(values.departures).toEqual([
      { field: "inventory", note: "Added beyond the starting equipment: Rope." },
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Remove Rope" }));
    await waitFor(() => expect(inventoryNames()).toEqual(["Spellbook", "Pouch"]));
    expect(values.departures).toEqual([]);
  });

  it("takes the gold alternative in place of the class's and the background's equipment", async () => {
    renderStep();
    await waitFor(() => expect(inventoryNames()).toEqual(["Spellbook", "Pouch"]));

    fireEvent.click(
      checkbox(/Take 4d4 × 10 gp instead of the class's and the background's equipment/),
    );

    await waitFor(() => expect(inventoryNames()).toEqual([]));
    const gold = values.money?.gold ?? 0;
    expect(gold).toBeGreaterThanOrEqual(40);
    expect(gold).toBeLessThanOrEqual(160);
    expect(screen.queryAllByRole("radio")).toEqual([]);

    fireEvent.click(checkbox(/Take 4d4 × 10 gp instead/));
    await waitFor(() => expect(inventoryNames()).toEqual(["Spellbook", "Pouch"]));
    expect(values.money).toMatchObject({ gold: 10 });
  });

  it("reads as done once every skill and equipment choice is made, and not after one is undone", async () => {
    renderStep();
    fireEvent.click(await screen.findByRole("checkbox", { name: /^Insight/ }));
    fireEvent.click(checkbox(/^Religion/));
    fireEvent.click(radio(/\(a\) Quarterstaff/));
    expect(done).toBe(false);

    fireEvent.click(radio(/\(a\) Component Pouch/));
    await waitFor(() => expect(done).toBe(true));

    fireEvent.click(checkbox(/^Religion/));
    await waitFor(() => expect(done).toBe(false));
  });
});
