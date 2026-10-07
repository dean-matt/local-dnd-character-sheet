import type { CharacterDefinition } from "@dnd/character";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { useWatch } from "react-hook-form";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithClient } from "../../test/renderWithClient.tsx";
import { CreationEquipment } from "./CreationEquipment.tsx";
import { CreationGrants } from "./CreationGrants.tsx";
import { CreationSkills } from "./CreationSkills.tsx";
import { CreationTools } from "./CreationTools.tsx";
import { creationForm } from "./creationForm.ts";
import { type EquipmentMemory, NO_EQUIPMENT } from "./equipmentPicks.ts";
import { ProficienciesStep } from "./ProficienciesStep.tsx";
import { useProficienciesDone } from "./useProficienciesDone.ts";

const PHB = (name: string) => ({ name, source: "PHB" });
const page = (items: unknown[]) => ({ items, total: items.length, limit: 200, offset: 0 });
const hit = (
  type: string,
  name: string,
  item?: { kinds: string[]; rarity: string | null; category: string | null; tool?: string },
) => ({
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
    startingEquipment: [{ _: [{ item: "pouch|phb", containsValue: 1000 }, { special: "ink" }] }],
  },
};

const SOLDIER = {
  ...PHB("Soldier"),
  edition: "classic",
  json: { ...PHB("Soldier"), skillProficiencies: [{ athletics: true, intimidation: true }] },
};

const GUILD_ARTISAN = {
  ...PHB("Guild Artisan"),
  edition: "classic",
  json: { ...PHB("Guild Artisan"), toolProficiencies: [{ anyArtisansTool: 1 }] },
};

const HALF_ORC = {
  ...PHB("Half-Orc"),
  edition: "classic",
  json: { ...PHB("Half-Orc"), skillProficiencies: [{ intimidation: true }] },
};

const LEONIN = {
  name: "Leonin",
  source: "MOT",
  edition: "classic",
  json: {
    name: "Leonin",
    source: "MOT",
    skillProficiencies: [
      { choose: { from: ["athletics", "intimidation", "perception", "survival"] } },
    ],
  },
};

const ROWS: Record<string, unknown> = {
  "/api/classes/Wizard/PHB": WIZARD,
  "/api/races/Half-Orc/PHB": HALF_ORC,
  "/api/races/Leonin/MOT": LEONIN,
  ...Object.fromEntries(
    ["classic", "one"].flatMap((edition) => [
      [`/api/classes/Wizard/PHB/subclasses?edition=${edition}&limit=200`, page([])],
      [`/api/backgrounds?edition=${edition}&limit=200`, page([SAGE, SOLDIER, GUILD_ARTISAN])],
      [`/api/races/Half-Orc/PHB/subraces?edition=${edition}&limit=200`, page([])],
      [`/api/races/Leonin/MOT/subraces?edition=${edition}&limit=200`, page([])],
    ]),
  ),
};

const SKILLS = [
  "Arcana",
  "Athletics",
  "History",
  "Insight",
  "Intimidation",
  "Medicine",
  "Religion",
  "Stealth",
].map((name) => hit("skill", name));
const ITEMS: Record<string, ReturnType<typeof hit>[]> = {
  "": [hit("item", "Rope", { kinds: ["gear"], rarity: null, category: null })],
  focus: [
    hit("item", "Wand", { kinds: ["focus"], rarity: null, category: null }),
    hit("item", "Wand of Magic Missiles", { kinds: ["focus"], rarity: "uncommon", category: null }),
  ],
};
const tool = (name: string, kind: string) =>
  hit("item", name, { kinds: ["tool"], rarity: null, category: null, tool: kind });
ITEMS.tool = [
  tool("Smith's Tools", "artisan"),
  tool("Carpenter's Tools", "artisan"),
  tool("Lute", "instrument"),
  tool("Thieves' Tools", "other"),
];
const CATALOG = [
  ...["Quarterstaff", "Dagger", "Component Pouch", "Spellbook", "Pouch"].map(PHB),
  { name: "Ink", source: "XPHB" },
];

function stubCatalog() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const params = new URL(url, "http://local").searchParams;
      let body: unknown = ROWS[url];
      if (url === "/api/refs/resolve") {
        const { refs } = JSON.parse(String(init?.body)) as {
          refs: { name: string; source: string }[];
        };
        const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
        body = {
          refs: refs.map((ref) => {
            const row = CATALOG.find(
              (each) => same(each.name, ref.name) && same(each.source, ref.source),
            );
            return row ? { ...row, entries: [] } : null;
          }),
        };
      } else if (url.startsWith("/api/search?"))
        body = page(
          params.get("type") === "item"
            ? (ITEMS[params.get("kind") ?? ""] ?? []).filter(
                (each) => params.get("rarity") !== "none" || each.item?.rarity === null,
              )
            : SKILLS,
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
      <CreationTools />
      <CreationEquipment memory={memory} onMemory={setMemory} />
      <ProficienciesStep memory={memory} onMemory={setMemory} />
    </>
  );
}

function renderStep({
  keepDraft = false,
  background = "Sage",
  race = undefined as { name: string; source: string } | undefined,
} = {}) {
  if (!keepDraft)
    localStorage.setItem(
      "draft:creation",
      JSON.stringify({
        edition: "classic",
        ...(race && { race }),
        background: PHB(background),
        levels: [{ class: PHB("Wizard") }],
      }),
    );
  return renderWithClient(
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
          note: "Stealth taken outside what the race, class, and background offer.",
        },
      ]),
    );

    fireEvent.click(stealth);

    await waitFor(() => expect(values.departures).toEqual([]));
    expect(screen.queryByRole("checkbox", { name: "Stealth" })).toBeNull();
  });

  it("adds by keyboard any skill not held or granted, past what the background and class offer", async () => {
    renderStep();
    const add = await screen.findByRole("combobox", { name: "Add a skill not on the lists" });

    fireEvent.keyDown(add, { key: "ArrowDown" });
    const offered = screen.getAllByRole("option").map((option) => option.textContent);
    expect(offered).toEqual([
      "Choose a skill",
      "Athletics",
      "Insight",
      "Intimidation",
      "Medicine",
      "Religion",
      "Stealth",
    ]);
    fireEvent.keyDown(add, { key: "End" });
    fireEvent.keyDown(add, { key: "Enter" });

    await waitFor(() =>
      expect(values.proficiencies?.skills.map((skill) => skill.ref.name)).toEqual([
        "Arcana",
        "History",
        "Stealth",
      ]),
    );
    const stealth = within(screen.getByRole("group", { name: "Other skills" })).getByRole(
      "checkbox",
      { name: "Stealth" },
    );
    expect(stealth).toBeChecked();

    fireEvent.click(stealth);
    await waitFor(() =>
      expect(values.proficiencies?.skills.map((skill) => skill.ref.name)).toEqual([
        "Arcana",
        "History",
      ]),
    );
  });

  it("notes a skill added past the lists as a departure, and drops the note once it is removed", async () => {
    renderStep();
    fireEvent.click(await screen.findByRole("combobox", { name: "Add a skill not on the lists" }));
    fireEvent.click(screen.getByRole("option", { name: "Athletics" }));

    await waitFor(() =>
      expect(values.departures).toEqual([
        {
          field: "proficiencies.skills",
          note: "Athletics taken outside what the race, class, and background offer.",
        },
      ]),
    );

    fireEvent.click(checkbox(/^Athletics/));
    await waitFor(() => expect(values.departures).toEqual([]));
  });

  describe("a skill the race and the background both grant", () => {
    const draft = (more: object) =>
      localStorage.setItem(
        "draft:creation",
        JSON.stringify({
          edition: "classic",
          race: PHB("Half-Orc"),
          background: PHB("Soldier"),
          levels: [{ class: PHB("Wizard") }],
          ...more,
        }),
      );
    const replacement = () =>
      screen.queryByRole("group", { name: "Any skill, in place of a duplicate" });

    it("earns a classic character a pick of any skill in its place, which departs from nothing", async () => {
      draft({});
      renderStep({ keepDraft: true });

      const group = await screen.findByRole("group", {
        name: "Any skill, in place of a duplicate",
      });
      expect(
        within(group).getByText("In place of Intimidation, granted by both Race and Background."),
      ).toBeVisible();
      fireEvent.click(within(group).getByRole("checkbox", { name: "Stealth" }));

      await waitFor(() =>
        expect(values.proficiencies?.skills.map((skill) => skill.ref.name)).toContain("Stealth"),
      );
      expect(within(group).getByText("Choose 1 — 1 selected")).toBeVisible();
      expect(
        within(screen.getByRole("group", { name: "Other skills" })).queryByRole("checkbox"),
      ).toBeNull();
      expect(values.departures ?? []).toEqual([]);
    });

    it("earns a 2024 character nothing, unless the table plays the 2014 replacement", async () => {
      draft({ edition: "one" });
      const { unmount } = renderStep({ keepDraft: true });
      await screen.findByRole("group", { name: "From Class: Wizard" });
      expect(replacement()).toBeNull();
      unmount();

      draft({ edition: "one", houseRules: { duplicateSkillReplacement: true } });
      renderStep({ keepDraft: true });
      expect(
        await screen.findByRole("group", { name: "Any skill, in place of a duplicate" }),
      ).toBeVisible();
    });
  });

  describe("a skill pick the race offers", () => {
    const LEONIN_REF = { name: "Leonin", source: "MOT" };
    const raceGroup = () => screen.findByRole("group", { name: "From Race: Leonin" });

    it("is asked beside the class's, lands the skill picked, and notes a pick past the count", async () => {
      renderStep({ race: LEONIN_REF });
      const group = await raceGroup();
      expect(screen.getByRole("group", { name: "From Class: Wizard" })).toBeVisible();
      expect(within(group).getByText("Choose 1 — 0 selected")).toBeVisible();

      fireEvent.click(within(group).getByRole("checkbox", { name: "Athletics" }));
      await waitFor(() =>
        expect(values.proficiencies?.skills.map((skill) => skill.ref.name)).toContain("Athletics"),
      );
      expect(within(group).getByText("Choose 1 — 1 selected")).toBeVisible();
      expect(values.departures ?? []).toEqual([]);

      fireEvent.click(within(group).getByRole("checkbox", { name: "Intimidation" }));
      await waitFor(() =>
        expect(values.departures).toEqual([
          {
            field: "proficiencies.skills",
            note: "2 skills taken from the Leonin list, which offers 1.",
          },
        ]),
      );
    });

    it("reads as done only once the race's pick is made", async () => {
      renderStep({ race: LEONIN_REF });
      await raceGroup();
      fireEvent.click(checkbox(/^Insight/));
      fireEvent.click(checkbox(/^Religion/));
      fireEvent.click(radio(/\(a\) Quarterstaff/));
      fireEvent.click(radio(/\(a\) Component Pouch/));
      await waitFor(() => expect(inventoryNames()).toContain("Component Pouch"));
      expect(done).toBe(false);

      fireEvent.click(checkbox(/^Athletics/));
      await waitFor(() => expect(done).toBe(true));
    });

    it("earns a classic character any skill where the grants cover the race's list", async () => {
      renderStep({ race: LEONIN_REF, background: "Soldier" });

      const group = await screen.findByRole("group", {
        name: "Any skill, in place of a duplicate",
      });
      expect(
        within(group).getByText(
          "In place of a pick the Wizard and Leonin lists have no skill left for.",
        ),
      ).toBeVisible();
    });
  });

  it("lands what the lists give outright, then a pick, and takes back the pick it replaces", async () => {
    renderStep();

    await waitFor(() => expect(inventoryNames()).toEqual(["Spellbook", "Pouch", "Ink"]));
    expect(values.money).toMatchObject({ gold: 10 });
    expect(screen.getByText("Spellbook, quill (not in the catalog)")).toBeVisible();

    fireEvent.click(radio(/\(b\) Dagger/));
    await waitFor(() => expect(inventoryNames()).toEqual(["Dagger", "Spellbook", "Pouch", "Ink"]));

    fireEvent.click(radio(/\(a\) Quarterstaff/));
    await waitFor(() =>
      expect(inventoryNames()).toEqual(["Quarterstaff", "Spellbook", "Pouch", "Ink"]),
    );
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
    const wand = await screen.findByRole("option", { name: /^Wand/ });
    expect(screen.queryByRole("option", { name: /Wand of Magic Missiles/ })).toBeNull();
    fireEvent.click(wand);

    await waitFor(() => expect(inventoryNames()).toContain("Wand"));
    expect(
      screen.getByRole("button", { name: "Clear choose an arcane focus, Wand" }),
    ).toBeVisible();
    expect(values.departures ?? []).toEqual([]);
  });

  it("adds an item past the lists, and notes it as a departure", async () => {
    renderStep();
    await waitFor(() => expect(inventoryNames()).toEqual(["Spellbook", "Pouch", "Ink"]));

    const picker = screen.getByRole("combobox", { name: "Add an item not on the lists" });
    fireEvent.focus(picker);
    fireEvent.click(await screen.findByRole("option", { name: /Rope/ }));

    await waitFor(() => expect(inventoryNames()).toEqual(["Spellbook", "Pouch", "Ink", "Rope"]));
    expect(values.departures).toEqual([
      { field: "inventory", note: "Added beyond the starting equipment: Rope." },
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Remove Rope" }));
    await waitFor(() => expect(inventoryNames()).toEqual(["Spellbook", "Pouch", "Ink"]));
    expect(values.departures).toEqual([]);
  });

  it("takes the gold alternative in place of the class's and the background's equipment", async () => {
    renderStep();
    await waitFor(() => expect(inventoryNames()).toEqual(["Spellbook", "Pouch", "Ink"]));

    fireEvent.click(
      checkbox(/Take 4d4 × 10 gp instead of the class's and the background's equipment/),
    );

    await waitFor(() => expect(inventoryNames()).toEqual([]));
    const gold = values.money?.gold ?? 0;
    expect(gold).toBeGreaterThanOrEqual(40);
    expect(gold).toBeLessThanOrEqual(160);
    expect(screen.queryAllByRole("radio")).toEqual([]);

    fireEvent.click(checkbox(/Take 4d4 × 10 gp instead/));
    await waitFor(() => expect(inventoryNames()).toEqual(["Spellbook", "Pouch", "Ink"]));
    expect(values.money).toMatchObject({ gold: 10 });
  });

  it("does not read as done before a class is chosen, though the background leaves nothing to pick", async () => {
    localStorage.setItem(
      "draft:creation",
      JSON.stringify({ edition: "classic", background: PHB("Sage") }),
    );
    renderStep({ keepDraft: true });

    await waitFor(() => expect(inventoryNames()).toEqual(["Pouch", "Ink"]));
    expect(values.proficiencies?.skills.map((skill) => skill.ref.name)).toEqual([
      "Arcana",
      "History",
    ]);
    expect(done).toBe(false);
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

  it("asks a background's pick of any artisan's tool, and lands the tool picked", async () => {
    renderStep({ background: "Guild Artisan" });

    const group = await screen.findByRole("group", {
      name: "Tools from Background: Guild Artisan (artisan's tools)",
    });
    expect(
      within(group)
        .getAllByRole("checkbox")
        .map((box) => box.closest("label")?.textContent),
    ).toEqual(["Carpenter's Tools", "Smith's Tools"]);
    expect(within(group).getByText("Choose 1 — 0 selected")).toBeVisible();

    fireEvent.click(within(group).getByRole("checkbox", { name: "Smith's Tools" }));

    await waitFor(() =>
      expect(values.proficiencies?.tools).toEqual([{ name: "Smith's Tools", level: "proficient" }]),
    );
    expect(within(group).getByText("Choose 1 — 1 selected")).toBeVisible();
    expect(values.departures ?? []).toEqual([]);
  });

  it("notes a tool pick past the count rather than refusing it", async () => {
    renderStep({ background: "Guild Artisan" });
    fireEvent.click(await screen.findByRole("checkbox", { name: "Smith's Tools" }));
    fireEvent.click(checkbox(/^Carpenter's Tools/));

    await waitFor(() =>
      expect(values.departures).toEqual([
        {
          field: "proficiencies.tools",
          note: "2 tools taken from the Guild Artisan list of artisan's tools, which offers 1.",
        },
      ]),
    );
    fireEvent.click(checkbox(/^Carpenter's Tools/));
    await waitFor(() => expect(values.departures).toEqual([]));
  });

  it("reads as done only once the tool pick is made too", async () => {
    renderStep({ background: "Guild Artisan" });
    fireEvent.click(await screen.findByRole("checkbox", { name: /^Insight/ }));
    fireEvent.click(checkbox(/^Religion/));
    fireEvent.click(radio(/\(a\) Quarterstaff/));
    fireEvent.click(radio(/\(a\) Component Pouch/));
    await waitFor(() => expect(values.proficiencies?.skills).toHaveLength(2));
    expect(done).toBe(false);

    fireEvent.click(checkbox(/^Smith's Tools/));
    await waitFor(() => expect(done).toBe(true));
  });
});
