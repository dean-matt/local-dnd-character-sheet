import type { CharacterSpells } from "@dnd/catalog";
import type { CharacterDerived } from "@dnd/character";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterRecord, derivedRecord } from "../../test/records.ts";
import { stubFetch, stubFetchByUrl } from "../../test/stubFetch.ts";
import { SpellsSection } from "./SpellsSection.tsx";

const SPELLS: CharacterSpells = {
  spells: [
    {
      resolved: true,
      name: "Hex",
      source: "XPHB",
      prepared: true,
      level: 1,
      school: "E",
      concentration: true,
      ritual: false,
      time: [{ number: 1, unit: "bonus" }],
      range: { type: "point", distance: { type: "feet", amount: 90 } },
      components: { v: true, s: true, m: "the petrified eye of a newt" },
      duration: [{ type: "timed", duration: { type: "hour", amount: 1 }, concentration: true }],
      entries: ["Deal an extra {@damage 1d6} necrotic damage."],
    },
    {
      resolved: true,
      name: "Eldritch Blast",
      source: "XPHB",
      prepared: false,
      level: 0,
      school: "V",
      concentration: false,
      ritual: false,
      entries: [],
    },
    {
      resolved: true,
      name: "Glimmer",
      prepared: false,
      level: 0,
      school: "V",
      concentration: false,
      ritual: true,
      entries: [],
    },
    { resolved: false, name: "Lost Spell", source: "PHB", prepared: false },
  ],
};

const computed = (value: number) => ({ computed: value, manual: null, terms: [] });

function renderSection(
  derived: CharacterDerived = derivedRecord(),
  spells: CharacterSpells = SPELLS,
) {
  const fetchMock = stubFetchByUrl({ "/api/characters/1/spells": spells });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <SpellsSection character={characterRecord("1", "Vex")} derived={derived} />
    </QueryClientProvider>,
  );
  return fetchMock;
}

const card = (name: string) =>
  within(screen.getByRole("heading", { level: 3, name }).closest("section") as HTMLElement);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SpellsSection", () => {
  it("shows each casting class's save DC, attack bonus and prepared count", async () => {
    renderSection();

    const warlock = card("Warlock · Charisma");
    expect(warlock.getByText("Spell Save DC").nextSibling).toHaveTextContent("13");
    expect(warlock.getByText("Spell Attack Bonus").nextSibling).toHaveTextContent("+5");
    expect(warlock.getByText("Spells Prepared").nextSibling).toHaveTextContent("2");
    await screen.findByText("Hex");
  });

  it("shows one set of numbers per class for a multiclassed caster", async () => {
    const [warlock] = derivedRecord().spellcasting;
    renderSection({
      ...derivedRecord(),
      spellcasting: [
        warlock as CharacterDerived["spellcasting"][number],
        {
          class: { name: "Wizard", source: "XPHB" },
          ability: "int",
          saveDc: computed(10),
          attackBonus: computed(2),
        },
      ],
    });

    expect(card("Wizard · Intelligence").getByText("Spell Save DC").nextSibling).toHaveTextContent(
      "10",
    );
    expect(card("Wizard · Intelligence").queryByText("Spells Prepared")).toBeNull();
    await screen.findByText("Hex");
  });

  it("lists slots by level and pact slots apart, marking an overridden total", async () => {
    renderSection({
      ...derivedRecord(),
      spellSlots: [
        { level: 1, total: computed(4) },
        { level: 2, total: { computed: 3, manual: 2, terms: [] } },
      ],
    });

    const slots = card("Spell Slots");
    expect(slots.getByText("1st level").nextSibling).toHaveTextContent("4");
    expect(slots.getByText("2nd level").nextSibling).toHaveTextContent("2*");
    expect(slots.getByText("Pact Magic, 1st level").nextSibling).toHaveTextContent("1");
    await screen.findByText("Hex");
  });

  it("groups spells by level, cantrips first, and shows what a caster checks", async () => {
    renderSection();

    await screen.findByText("Hex");
    const headings = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(headings.slice(-3)).toEqual(["Cantrips", "1st level", "Not found"]);

    const hex = screen.getByText("Hex").closest("summary") as HTMLElement;
    expect(hex).toHaveTextContent("Enchantment");
    expect(hex).toHaveTextContent("Prepared");
    expect(hex).toHaveTextContent("Concentration");
    expect(hex).not.toHaveTextContent("Ritual");
    expect(hex).toHaveTextContent("Casting time: 1 bonus action.");
    expect(hex).toHaveTextContent("Range: 90 feet.");
    expect(hex).toHaveTextContent("Components: V, S, M (the petrified eye of a newt).");
    expect(hex).toHaveTextContent("Duration: Up to 1 hour.");
  });

  it("tells a known spell from a prepared one and marks a homebrew spell", async () => {
    renderSection();

    const blast = (await screen.findByText("Eldritch Blast")).closest("summary") as HTMLElement;
    expect(blast).toHaveTextContent("Known");
    expect(blast).not.toHaveTextContent("Homebrew");
    expect(blast).toHaveTextContent("Casting time: —none.");

    const glimmer = screen.getByText("Glimmer").closest("summary") as HTMLElement;
    expect(glimmer).toHaveTextContent("Homebrew");
    expect(glimmer).toHaveTextContent("Ritual");
  });

  it("renders a spell's text through the token renderer", async () => {
    renderSection();

    const summary = await screen.findByText("Hex");
    fireEvent.click(summary);
    const details = summary.closest("details") as HTMLElement;
    expect(details).toHaveTextContent("Deal an extra 1d6 necrotic damage.");
    expect(details).not.toHaveTextContent("{@damage");
  });

  it("shows a reference that resolves to nothing by its stored name, marked", async () => {
    renderSection();

    const row = (await screen.findByText("Lost Spell (PHB)")).closest("li") as HTMLElement;
    expect(row).toHaveTextContent("Not found in the catalog");
    expect(row.querySelector("details")).toBeNull();
  });

  it("shows no spell view for a character who does not cast", () => {
    const fetchMock = renderSection({
      ...derivedRecord(),
      spellcasting: [],
      spellSlots: [],
      pactSlots: null,
    });

    expect(screen.getByText("Vex doesn't cast spells.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 3 })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says so when a caster has no spells yet", async () => {
    renderSection(derivedRecord(), { spells: [] });

    expect(await screen.findByText("Vex has no spells yet.")).toBeInTheDocument();
  });

  it("reports a failed read", async () => {
    stubFetch(
      new Response(JSON.stringify({ error: "No character with that id" }), { status: 404 }),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <SpellsSection character={characterRecord("1", "Vex")} derived={derivedRecord()} />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("No character with that id");
  });
});
