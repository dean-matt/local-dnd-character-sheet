import type { CharacterSpells } from "@dnd/catalog";
import type { CharacterDerived, CharacterReferences } from "@dnd/character";
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
      time: [
        { number: 1, unit: "bonus" },
        {
          number: 1,
          unit: "reaction",
          condition: "which you take when {@spell magic missile} hits",
        },
      ],
      range: { type: "point", distance: { type: "feet", amount: 90 } },
      components: { v: true, s: true, m: "the petrified eye of a newt" },
      duration: [{ type: "timed", duration: { type: "hour", amount: 1 }, concentration: true }],
      damageDice: "1d6",
      damageTypes: ["necrotic"],
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
      damageDice: "4d6",
      damageTypes: ["fire", "radiant"],
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
  references?: CharacterReferences,
) {
  const fetchMock = stubFetchByUrl({
    "/api/characters/1/spells": spells,
    ...(references && { "/api/characters/1/references": references }),
  });
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

  it("draws each level's slots as empty pips, pact slots in the same row shape", async () => {
    renderSection({
      ...derivedRecord(),
      spellSlots: [
        { level: 1, total: computed(4) },
        { level: 2, total: { computed: 3, manual: 2, terms: [] } },
      ],
    });

    const slots = card("Spell Slots");
    const row = (spoken: string) =>
      slots.getByText(new RegExp(`^${spoken}:`)).closest("li") as HTMLElement;
    const pips = (spoken: string) => [
      ...(row(spoken).querySelectorAll(":scope > [aria-hidden]")[1]?.children ?? []),
    ];
    expect(slots.getByText("1st Level: 4 slots")).toBeInTheDocument();
    expect(pips("1st Level")).toHaveLength(4);
    expect(pips("2nd Level")).toHaveLength(2);
    expect(row("2nd Level")).toHaveTextContent("overridden from 3");
    expect(slots.getByText("Pact Magic, 1st Level: 1 slot")).toBeInTheDocument();
    expect(row("Pact Magic, 1st Level")).toHaveTextContent("Pact 1st");
    expect(pips("Pact Magic, 1st Level")).toHaveLength(1);
    for (const pip of pips("1st Level")) {
      expect(pip.getAttribute("style")).toBeNull();
      expect(pip.className.split(" ")).toEqual([
        "size-[15px]",
        "shrink-0",
        "rounded-full",
        "border-[1.5px]",
        "border-accent",
      ]);
    }
    await screen.findByText("Hex");
  });

  it("lists every spell in one card under level subheadings, cantrips first", async () => {
    renderSection();

    await screen.findByText("Hex");
    const known = card("Known Spells");
    const headings = known.getAllByRole("heading", { level: 4 }).map((h) => h.textContent);
    expect(headings).toEqual(["Cantrips", "1st Level", "Not found"]);

    const hex = screen.getByText("Hex").closest("li") as HTMLElement;
    const school = within(hex).getByText("Enchantment");
    const prepared = within(hex).getByText("Prepared");
    expect(school.compareDocumentPosition(prepared)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(hex).toHaveTextContent("Concentration");
    expect(hex).not.toHaveTextContent("Ritual");
    expect(hex).not.toHaveTextContent("90 feet");
    expect(hex).toHaveTextContent("Deal an extra 1d6 necrotic damage.");
  });

  it("puts a spell's casting facts in its detail modal", async () => {
    renderSection();

    fireEvent.click(await screen.findByRole("button", { name: "Hex" }));

    const modal = within(screen.getByRole("dialog", { name: "Hex" }));
    expect(modal.getByText(/Casting time:/).parentElement).toHaveTextContent(
      "Casting time: 1 bonus action or 1 reaction, which you take when magic missile hits.",
    );
    expect(modal.getByText(/Range:/).parentElement).toHaveTextContent("Range: 90 feet.");
    expect(modal.getByText(/Components:/).parentElement).toHaveTextContent(
      "Components: V, S, M (the petrified eye of a newt).",
    );
    expect(modal.getByText(/Duration:/).parentElement).toHaveTextContent("Duration: Up to 1 hour.");
  });

  it("tells a known spell from a prepared one and marks a homebrew spell", async () => {
    renderSection();

    const blast = (await screen.findByText("Eldritch Blast")).closest("li") as HTMLElement;
    expect(blast).toHaveTextContent("Known");
    expect(blast).not.toHaveTextContent("Homebrew");

    const glimmer = screen.getByText("Glimmer").closest("li") as HTMLElement;
    expect(glimmer).toHaveTextContent("Homebrew");
    expect(glimmer).toHaveTextContent("Ritual");
  });

  it("pairs a damage roll with its type only where the spell deals one", async () => {
    renderSection();

    const hex = (await screen.findByText("Hex")).closest("li") as HTMLElement;
    expect(hex).toHaveTextContent("1d6 necrotic");
    const blast = screen.getByText("Eldritch Blast").closest("li") as HTMLElement;
    expect(within(blast).getByText("4d6")).toBeInTheDocument();
    expect(within(blast).getByText("fire, radiant")).toBeInTheDocument();
  });

  it("renders a spell's text through the token renderer", async () => {
    renderSection();

    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(await screen.findByRole("button", { name: "Hex" }));
    const modal = screen.getByRole("dialog", { name: "Hex" });
    expect(modal).toHaveTextContent("Deal an extra 1d6 necrotic damage.");
    expect(modal).not.toHaveTextContent("{@damage");
  });

  it("shows a reference that resolves to nothing by its stored name, marked", async () => {
    renderSection();

    const row = (await screen.findByText("Lost Spell (PHB)")).closest("li") as HTMLElement;
    expect(row).toHaveTextContent("Not found in the catalog");
    expect(within(row).queryByRole("button")).toBeNull();
  });

  it("names the row a renamed reference became, without showing it", async () => {
    renderSection(derivedRecord(), SPELLS, {
      unresolved: [
        {
          field: "spells[0].ref",
          kind: "item",
          ref: { name: "Lost Spell", source: "PHB" },
          renamedTo: { name: "Lost Item", source: "XPHB" },
        },
        {
          field: "spells[3].ref",
          kind: "spell",
          ref: { name: "Lost Spell", source: "PHB" },
          renamedTo: { name: "Found Spell", source: "XPHB" },
        },
      ],
    });

    const row = (await screen.findByText("Lost Spell (PHB)")).closest("li") as HTMLElement;
    expect(await within(row).findByText("Renamed to Found Spell (XPHB)")).toBeInTheDocument();
    expect(row).not.toHaveTextContent("Not found in the catalog");
    expect(within(row).queryByRole("button")).toBeNull();
  });

  it("asks for no reference report where every spell resolves", async () => {
    const fetchMock = renderSection(derivedRecord(), { spells: SPELLS.spells.slice(0, -1) });

    await screen.findByText("Hex");
    expect(fetchMock.mock.calls.map(([url]) => String(url))).not.toContain(
      "/api/characters/1/references",
    );
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
