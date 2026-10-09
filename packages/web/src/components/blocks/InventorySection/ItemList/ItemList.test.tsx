import type { CharacterInventory, SheetItem } from "@dnd/catalog";
import { type CharacterDerived, characterDefinitionSchema } from "@dnd/character";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterKey } from "../../../../hooks/characterKeys.ts";
import { characterRecord, derivedRecord } from "../../../../test/records.ts";
import { ItemList } from "./ItemList.tsx";

const flags = { quantity: 1, carried: true, equipped: false, attuned: false };
const plain = { type: null, rarity: null, value: null, weapon: null, armor: null, entries: [] };

const ITEMS: SheetItem[] = [
  {
    resolved: true,
    name: "Longsword",
    source: "PHB",
    ...flags,
    ...plain,
    type: { abbreviation: "M", name: "Melee Weapon" },
    requiresAttunement: false,
    weight: 3,
    weapon: { category: "martial", damage: { dice: "1d8", type: "slashing" } },
  },
  {
    resolved: true,
    name: "Cloak of Protection",
    source: "DMG",
    ...flags,
    ...plain,
    attuned: true,
    requiresAttunement: true,
    weight: 1,
  },
  {
    resolved: true,
    name: "Ring of Warmth",
    source: "DMG",
    ...flags,
    ...plain,
    carried: false,
    requiresAttunement: true,
    weight: null,
  },
];

function vex() {
  const record = characterRecord("1", "Vex");
  const definition = characterDefinitionSchema.parse({
    ...record.definition,
    inventory: [
      { ref: { name: "Longsword", source: "PHB" } },
      { ref: { name: "Cloak of Protection", source: "DMG" }, attuned: true },
      { ref: { name: "Ring of Warmth", source: "DMG" }, carried: false },
    ],
  });
  return { ...record, definition };
}

const hit = (name: string, source: string, item: object = {}) => ({
  type: "item",
  name,
  source,
  edition: "one",
  item: { kinds: ["melee"], rarity: null, category: null, ...item },
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/** Answers the inventory, a search for "+1" or a base item, and a variant's expansion. */
function stubApi({ inventory = ITEMS, refuse = false } = {}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (init?.method === "PUT") {
      return json({ ...vex(), definition: JSON.parse(String(init.body)) });
    }
    if (url === "/api/characters/1/inventory") return json({ items: inventory });
    if (url.startsWith("/api/search?")) {
      const kind = new URL(url, "http://local").searchParams.get("kind");
      const items = kind
        ? [hit("Dagger", "XPHB"), hit("+1 Armor", "XDMG", { variant: true })]
        : [hit("Rope", "XPHB", { kinds: ["gear"] }), hit("+1 Weapon", "XDMG", { variant: true })];
      return json({ items, total: items.length, limit: 20, offset: 0 });
    }
    if (url === "/api/items/Dagger/XPHB/variants/%2B1%20Weapon/XDMG") {
      return refuse
        ? json({ error: "This base item does not meet the variant's requirements" }, 409)
        : json({
            name: "+1 Dagger",
            source: "XDMG",
            edition: "one",
            kind: "baseitem",
            type: "M|XPHB",
            rarity: "uncommon",
            requiresAttunement: false,
            json: { name: "+1 Dagger", source: "XDMG" },
          });
    }
    return json({ error: `nothing at ${url}` }, 404);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderList(
  derived: CharacterDerived = derivedRecord(),
  inventory?: CharacterInventory["items"],
) {
  const fetchMock = stubApi({ inventory });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const character = vex();
  client.setQueryData(characterKey(character.id), character);
  render(
    <QueryClientProvider client={client}>
      <ItemList character={character} derived={derived} />
    </QueryClientProvider>,
  );
  return fetchMock;
}

/** The definition the last `PUT` wrote, once one has. */
async function written(fetchMock: ReturnType<typeof stubApi>) {
  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith("/api/characters/1", expect.anything()),
  );
  const puts = fetchMock.mock.calls.filter(([, init]) => init?.method === "PUT");
  return JSON.parse(String(puts.at(-1)?.[1]?.body));
}

const row = (name: string) => screen.getAllByText(name)[0]?.closest("li") as HTMLElement;

async function pick(label: string, query: string, option: RegExp) {
  fireEvent.change(screen.getByRole("combobox", { name: label }), { target: { value: query } });
  fireEvent.click(await screen.findByRole("option", { name: option }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ItemList", () => {
  it("adds a picked item to the end of the inventory", async () => {
    const fetchMock = renderList();

    await screen.findByText("Longsword");
    await pick("Add an item", "rope", /^Rope/);

    const definition = await written(fetchMock);
    expect(definition.inventory).toHaveLength(4);
    expect(definition.inventory[3]).toEqual({
      ref: { name: "Rope", source: "XPHB" },
      ...flags,
    });
  });

  it("offers the picker while the inventory is empty", async () => {
    renderList(derivedRecord(), []);

    expect(await screen.findByText("Vex has no items yet.")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Add an item" })).toBeInTheDocument();
  });

  it("adds a magic variant as the pair it names, once its base item is picked", async () => {
    const fetchMock = renderList();

    await screen.findByText("Longsword");
    await pick("Add an item", "+1", /^\+1 Weapon/);
    const base = screen.getByRole("combobox", { name: "Base item for +1 Weapon" });
    fireEvent.change(base, { target: { value: "dag" } });
    const another = await screen.findByRole("option", { name: /^\+1 Armor/ });
    expect(another).toHaveAttribute("aria-disabled", "true");
    expect(another).toHaveTextContent("Another magic variant, not a base item");
    const kinds = fetchMock.mock.calls.map(
      ([url]) => new URL(String(url), "http://local").searchParams.get("kind") ?? undefined,
    );
    expect(kinds).toContain("melee");
    fireEvent.click(screen.getByRole("option", { name: /^Dagger/ }));

    const definition = await written(fetchMock);
    expect(definition.inventory[3]).toMatchObject({
      ref: { name: "Dagger", source: "XPHB" },
      variant: { name: "+1 Weapon", source: "XDMG" },
    });
    expect(screen.getByRole("combobox", { name: "Add an item" })).toBeInTheDocument();
  });

  it("says why a variant refuses the base item picked, and saves nothing", async () => {
    const fetchMock = stubApi({ refuse: true });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(characterKey("1"), vex());
    render(
      <QueryClientProvider client={client}>
        <ItemList character={vex()} derived={derivedRecord()} />
      </QueryClientProvider>,
    );

    await screen.findByText("Longsword");
    await pick("Add an item", "+1", /^\+1 Weapon/);
    await pick("Base item for +1 Weapon", "dag", /^Dagger/);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Dagger cannot take +1 Weapon. This base item does not meet the variant's requirements.",
    );
    expect(fetchMock).not.toHaveBeenCalledWith("/api/characters/1", expect.anything());
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("combobox", { name: "Add an item" })).toBeInTheDocument();
  });

  it("removes an item", async () => {
    const fetchMock = renderList();

    fireEvent.click(await screen.findByRole("button", { name: "Remove Cloak of Protection" }));

    const definition = await written(fetchMock);
    expect(definition.inventory.map((entry: { ref: { name: string } }) => entry.ref.name)).toEqual([
      "Longsword",
      "Ring of Warmth",
    ]);
  });

  it("changes an item's quantity", async () => {
    const fetchMock = renderList();

    const quantity = await screen.findByRole("textbox", { name: "Longsword quantity" });
    expect(quantity).toHaveValue("1");
    fireEvent.change(quantity, { target: { value: "2" } });
    fireEvent.blur(quantity);

    expect((await written(fetchMock)).inventory[0].quantity).toBe(2);
  });

  it("refuses a quantity under one rather than removing the item", async () => {
    const fetchMock = renderList();

    const quantity = await screen.findByRole("textbox", { name: "Longsword quantity" });
    fireEvent.change(quantity, { target: { value: "0" } });
    fireEvent.blur(quantity);

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith("/api/characters/1", expect.anything());
  });

  it("draws the equip toggle as a backpack while stowed and the type's icon once equipped", async () => {
    renderList(derivedRecord(), [{ ...ITEMS[0], equipped: true } as SheetItem, ...ITEMS.slice(1)]);

    const sword = await screen.findByRole("button", { name: "Equipped, Longsword" });
    expect(sword).toHaveAttribute("aria-pressed", "true");
    expect(sword.querySelector("svg")).toHaveClass("lucide-sword");
    const cloak = screen.getByRole("button", { name: "Equipped, Cloak of Protection" });
    expect(cloak).toHaveAttribute("aria-pressed", "false");
    expect(cloak.querySelector("svg")).toHaveClass("lucide-backpack");
  });

  it("carries an item it equips", async () => {
    const fetchMock = renderList();

    fireEvent.click(await screen.findByRole("button", { name: "Equipped, Ring of Warmth" }));

    expect((await written(fetchMock)).inventory[2]).toMatchObject({
      equipped: true,
      carried: true,
    });
  });

  it("attunes an item while a slot is free, and ends attunement", async () => {
    const fetchMock = renderList();

    await screen.findByText("Ring of Warmth");
    const ring = within(row("Ring of Warmth"));
    fireEvent.click(ring.getByRole("button", { name: "Attuned, Ring of Warmth" }));
    expect((await written(fetchMock)).inventory[2].attuned).toBe(true);

    const cloak = within(row("Cloak of Protection"));
    expect(cloak.getByRole("button", { name: "Attuned, Cloak of Protection" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(row("Longsword")).queryByRole("button", { name: /^Attuned/ })).toBeNull();
  });

  it("refuses an attunement past the slots, naming the items that hold them", async () => {
    const fetchMock = renderList({
      ...derivedRecord(),
      attunementSlots: { computed: 3, manual: 1, terms: [] },
    });

    await screen.findByText("Ring of Warmth");
    const ring = within(row("Ring of Warmth"));
    fireEvent.click(ring.getByRole("button", { name: "Attune Ring of Warmth, no slot free" }));
    expect(ring.getByRole("group", { name: "Attunement" })).toHaveTextContent(
      "The one attunement slot is taken by Cloak of Protection. End attunement to one of them first.",
    );
    expect(fetchMock).not.toHaveBeenCalledWith("/api/characters/1", expect.anything());
  });

  it("says so when a change fails to save", async () => {
    renderList();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ error: "disk full" }, 500)),
    );

    fireEvent.click(await screen.findByRole("button", { name: "Remove Longsword" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The change was not saved: disk full",
    );
  });
});
