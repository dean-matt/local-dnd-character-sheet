import type { CharacterInventory } from "@dnd/catalog";
import { type CharacterDerived, characterDefinitionSchema } from "@dnd/character";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterRecord, derivedRecord } from "../../test/records.ts";
import { stubFetch, stubFetchByUrl } from "../../test/stubFetch.ts";
import { InventorySection } from "./InventorySection.tsx";

const flags = { quantity: 1, carried: true, equipped: false, attuned: false };
const plain = { type: null, value: null, weapon: null, armor: null };

const INVENTORY: CharacterInventory = {
  items: [
    {
      resolved: true,
      name: "+1 Longsword",
      source: "DMG",
      ...flags,
      equipped: true,
      type: { abbreviation: "M", name: "Melee Weapon" },
      rarity: "uncommon",
      requiresAttunement: false,
      weight: 3,
      value: null,
      weapon: { category: "martial", damage: { dice: "1d8", type: "slashing" } },
      armor: null,
      entries: ["You have a {@b +1 bonus} to attack rolls."],
    },
    {
      resolved: true,
      name: "Cloak of Protection",
      source: "DMG",
      ...flags,
      ...plain,
      type: { abbreviation: "W", name: null },
      attuned: true,
      rarity: "uncommon",
      requiresAttunement: true,
      weight: 1,
      entries: [],
    },
    {
      resolved: true,
      name: "Ring of Warmth",
      source: "DMG",
      ...flags,
      ...plain,
      type: { abbreviation: "RG", name: "Ring" },
      value: 7,
      carried: false,
      rarity: "unknown (magic)",
      requiresAttunement: true,
      weight: null,
      entries: [],
    },
    {
      resolved: true,
      name: "Arrow",
      source: "PHB",
      ...flags,
      ...plain,
      type: { abbreviation: "A", name: "Ammunition" },
      value: 5,
      quantity: 20,
      rarity: "none",
      requiresAttunement: false,
      weight: 0.05,
      entries: [],
    },
    {
      resolved: true,
      name: "Lucky Coin",
      ...flags,
      ...plain,
      value: 150,
      rarity: null,
      requiresAttunement: false,
      weight: null,
      entries: [],
    },
    {
      resolved: true,
      name: "Shield",
      source: "PHB",
      ...flags,
      type: { abbreviation: "S", name: "Shield" },
      rarity: "none",
      requiresAttunement: false,
      weight: 6,
      value: 1000,
      weapon: null,
      armor: { category: "shield", armorClass: 2 },
      entries: [],
    },
    {
      resolved: true,
      name: "Chain Mail",
      source: "PHB",
      ...flags,
      type: { abbreviation: "HA", name: "Heavy Armor" },
      rarity: "none",
      requiresAttunement: false,
      weight: 55,
      value: 7500,
      weapon: null,
      armor: { category: "heavy", armorClass: 16 },
      entries: [],
    },
    {
      resolved: false,
      name: "Net",
      source: "PHB",
      ...flags,
      variant: { name: "+1 Weapon", source: "DMG" },
    },
  ],
};

/** `characterRecord`'s Vex, attuned to two items and carrying a purse. */
function vex() {
  const record = characterRecord("1", "Vex");
  const definition = characterDefinitionSchema.parse({
    ...record.definition,
    inventory: [
      { ref: { name: "Cloak of Protection", source: "DMG" }, attuned: true },
      { ref: { name: "Ring of Warmth", source: "DMG" }, attuned: true, carried: false },
      { ref: { name: "Longsword", source: "PHB" }, equipped: true },
    ],
    money: { gold: 1250, silver: 3 },
  });
  return { ...record, definition };
}

const load = (overrides: Partial<CharacterDerived> = {}): CharacterDerived => ({
  ...derivedRecord(),
  carriedWeight: 30.5,
  ...overrides,
});

function renderSection(derived: CharacterDerived | null = load(), inventory = INVENTORY) {
  const fetchMock = stubFetchByUrl({ "/api/characters/1/inventory": inventory });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <InventorySection character={vex()} derived={derived ?? undefined} />
    </QueryClientProvider>,
  );
  return fetchMock;
}

const card = (name: string) =>
  within(screen.getByRole("heading", { level: 3, name }).closest("section") as HTMLElement);

/** The first match is the row's name, which comes before any chip spelling the same word. */
const row = (name: string) => screen.getAllByText(name)[0]?.closest("li") as HTMLElement;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("InventorySection", () => {
  it("lists each item with its quantity, and marks equipped and attuned on the row", async () => {
    renderSection();

    await screen.findByText("+1 Longsword");
    expect(row("+1 Longsword")).toHaveTextContent("Equipped");
    expect(row("+1 Longsword")).toHaveTextContent("Uncommon");
    expect(row("+1 Longsword")).not.toHaveTextContent("Attuned");
    expect(row("Cloak of Protection")).toHaveTextContent("Attuned");
    expect(row("Cloak of Protection")).not.toHaveTextContent("Requires attunement");
    expect(row("Ring of Warmth")).toHaveTextContent("Requires attunement");
    expect(row("Ring of Warmth")).toHaveTextContent("Not carried");
    expect(row("Ring of Warmth")).toHaveTextContent("Unknown (magic)");
    expect(row("Arrow")).toHaveTextContent("×20");
    expect(row("Arrow")).toHaveTextContent("Weight: 1 lb");
    expect(row("Arrow")).not.toHaveTextContent("none");
  });

  it("splits the items into Weapons, Armor and Gear by type, keeping their order", async () => {
    renderSection();

    await screen.findByText("+1 Longsword");
    const names = (group: string) =>
      card(group)
        .getAllByRole("listitem")
        .map((li) => li.firstElementChild?.firstElementChild?.textContent);
    expect(names("Weapons")).toEqual(["+1 Longsword"]);
    expect(names("Armor")).toEqual(["Shield", "Chain Mail"]);
    expect(card("Gear").getAllByRole("listitem")).toHaveLength(5);
    expect(screen.queryByRole("heading", { level: 3, name: "Items" })).toBeNull();
  });

  it("prints a row's type facts as chips and its price in a price chip", async () => {
    renderSection();

    await screen.findByText("+1 Longsword");
    expect(row("+1 Longsword")).toHaveTextContent("Martial");
    expect(within(row("+1 Longsword")).getByText("1d8")).toBeInTheDocument();
    expect(within(row("+1 Longsword")).getByText("slashing")).toBeInTheDocument();
    expect(row("+1 Longsword")).not.toHaveTextContent("Cost");
    expect(row("Chain Mail")).toHaveTextContent("Heavy");
    expect(row("Chain Mail")).toHaveTextContent("AC 16");
    expect(row("Chain Mail")).toHaveTextContent("Cost 75 gp");
    expect(row("Shield")).toHaveTextContent("AC +2");
    expect(row("Shield")).toHaveTextContent("Cost 10 gp");
    expect(row("Arrow")).toHaveTextContent("Ammunition");
    expect(row("Arrow")).toHaveTextContent("Cost 1 gp");
    expect(row("Lucky Coin")).toHaveTextContent("Cost 15 sp");
    expect(row("Ring of Warmth")).toHaveTextContent("Cost 7 cp");
  });

  it("drops a nameless type rather than print its code", async () => {
    renderSection();

    await screen.findByText("Cloak of Protection");
    expect(row("Cloak of Protection")).not.toHaveTextContent(/\bW\b/);
  });

  it("marks a homebrew item beside the catalog ones", async () => {
    renderSection();

    await screen.findByText("Lucky Coin");
    expect(row("Lucky Coin")).toHaveTextContent("Homebrew");
    expect(row("+1 Longsword")).not.toHaveTextContent("Homebrew");
  });

  it("renders an item's text through the token renderer", async () => {
    renderSection();

    fireEvent.click(await screen.findByRole("button", { name: "+1 Longsword" }));
    const modal = screen.getByRole("dialog", { name: "+1 Longsword" });
    expect(modal).toHaveTextContent("You have a +1 bonus to attack rolls.");
    expect(modal).not.toHaveTextContent("{@b");
  });

  it("shows an unresolved magic variant by the pair it names, with nothing to open", async () => {
    renderSection();

    const net = (await screen.findByText(/Net \(PHB\)/)).closest("li") as HTMLElement;
    expect(net).toHaveTextContent("Net (PHB), as +1 Weapon (DMG)");
    expect(net).toHaveTextContent("Not found in the catalog");
    expect(within(net).queryByRole("button")).toBeNull();
  });

  it("counts the attunement slots in use against the derived total", () => {
    renderSection(load({ attunementSlots: { computed: 3, manual: 4, terms: [] } }));

    const attunement = card("Attunement");
    expect(attunement.getByText("Attuned").nextSibling).toHaveTextContent("2");
    expect(attunement.getByText("Slots").nextSibling).toHaveTextContent("4*");
  });

  it("shows the load against carrying capacity, naming a tier only under the variant", async () => {
    renderSection(load({ encumbrance: null }));

    const carrying = card("Carrying");
    expect(carrying.getByText("Carried").nextSibling).toHaveTextContent("30.5 lb");
    expect(carrying.getByText("Carrying Capacity").nextSibling).toHaveTextContent("120 lb");
    expect(carrying.queryByText("Encumbrance")).toBeNull();
    expect(await carrying.findByText("Leaves out 1 item not found.")).toBeInTheDocument();
  });

  it("names the encumbrance tier the character is in", () => {
    renderSection(load({ encumbrance: "heavilyEncumbered" }));

    expect(card("Carrying").getByText("Encumbrance").nextSibling).toHaveTextContent(
      "Heavily encumbered",
    );
  });

  it("shows every coin side by side, each label over its value", () => {
    renderSection();

    const currency = card("Currency");
    expect(currency.getAllByRole("term").map((term) => term.textContent)).toEqual([
      "Platinum (pp)",
      "Gold (gp)",
      "Electrum (ep)",
      "Silver (sp)",
      "Copper (cp)",
    ]);
    expect(currency.getByText("Gold (gp)").nextSibling).toHaveTextContent("1,250");
    expect(currency.getByText("Silver (sp)").nextSibling).toHaveTextContent("3");
    expect(currency.getByText("Platinum (pp)").nextSibling).toHaveTextContent("0");
  });

  it("still lists items and coins where the derived block failed", async () => {
    renderSection(null);

    expect(await screen.findByText("+1 Longsword")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 3, name: "Carrying" })).toBeNull();
    expect(card("Currency").getByText("Gold (gp)")).toBeInTheDocument();
  });

  it("says so when the character has no items", async () => {
    renderSection(load(), { items: [] });

    expect(await screen.findByText("Vex has no items yet.")).toBeInTheDocument();
  });

  it("reports a failed read", async () => {
    stubFetch(
      new Response(JSON.stringify({ error: "No character with that id" }), { status: 404 }),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <InventorySection character={vex()} derived={load()} />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("No character with that id");
  });
});
