import type { CharacterInventory, SheetItem } from "@dnd/catalog";
import { type CharacterDerived, characterDefinitionSchema } from "@dnd/character";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterKey } from "../../../../hooks/characterKeys.ts";
import { useCharacter } from "../../../../hooks/useCharacter.ts";
import { characterRecord, derivedRecord } from "../../../../test/records.ts";
import { saveToasts } from "../../../../test/saveToasts.ts";
import { SaveToasts } from "../../../SaveToasts.tsx";
import { ItemList } from "./ItemList.tsx";

const flags = { quantity: 1, carried: true, equipped: false, attuned: false };
const plain = {
  type: null,
  rarity: null,
  value: null,
  estimate: null,
  weapon: null,
  armor: null,
  entries: [],
};

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

function vex(houseRules: Record<string, boolean> = {}) {
  const record = characterRecord("1", "Vex");
  const definition = characterDefinitionSchema.parse({
    ...record.definition,
    houseRules,
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

const homebrew = {
  type: "item",
  id: "hb-1",
  name: "Lucky Coin",
  edition: "one",
  item: { kinds: ["other"], rarity: null, category: null },
};

function searchPage(url: string) {
  const kind = new URL(url, "http://local").searchParams.get("kind");
  const items =
    kind === "melee,ranged,ammunition"
      ? [hit("Dagger", "XPHB"), hit("+1 Armor", "XDMG", { variant: true })]
      : [
          hit("Rope", "XPHB", { kinds: ["gear"] }),
          hit("+1 Weapon", "XDMG", { variant: true }),
          homebrew,
        ];
  return json({ items, total: items.length, limit: 20, offset: 0 });
}

/** `+1 Weapon` expanded over a Dagger, or the error a `status` other than 200 answers. */
function expansion(status: number, refusal: string) {
  if (status !== 200) return json({ error: refusal }, status);
  return json({
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

function variantReply(url: string, variantStatus: number, overrideStatus: number, refusal: string) {
  const [path, query] = url.split("?");
  if (path !== "/api/items/Dagger/XPHB/variants/%2B1%20Weapon/XDMG") {
    return json({ error: `nothing at ${url}` }, 404);
  }
  return expansion(query === "override=true" ? overrideStatus : variantStatus, refusal);
}

/**
 * Answers the character, its inventory, a search for "+1" or a base item, and a variant's
 * expansion. `refetch: false` holds every inventory read after the first, as a slow
 * refetch would, and `holdFirstPut` the first write until `releasePut` runs.
 */
let releasePut = () => {};

function stubApi({
  inventory = ITEMS,
  variantStatus = 200,
  overrideStatus = 200,
  refusal = "This base item does not meet the variant's requirements",
  refetch = true,
  holdFirstPut = false,
  houseRules,
}: {
  inventory?: SheetItem[];
  variantStatus?: number;
  overrideStatus?: number;
  refusal?: string;
  refetch?: boolean;
  holdFirstPut?: boolean;
  houseRules?: Record<string, boolean>;
} = {}) {
  let reads = 0;
  let record = vex(houseRules);
  let held = holdFirstPut
    ? new Promise<void>((resolve) => {
        releasePut = resolve;
      })
    : undefined;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (init?.method === "PUT") {
      const wait = held;
      held = undefined;
      await wait;
      record = { ...record, definition: JSON.parse(String(init.body)) };
      return json(record);
    }
    if (url === "/api/characters/1") return json(record);
    if (url === "/api/characters/1/inventory") {
      reads += 1;
      return reads > 1 && !refetch ? new Promise<Response>(() => {}) : json({ items: inventory });
    }
    if (url.startsWith("/api/search?")) return searchPage(url);
    if (url.startsWith("/api/items/"))
      return variantReply(url, variantStatus, overrideStatus, refusal);
    return json({ error: `nothing at ${url}` }, 404);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderList(
  derived: CharacterDerived = derivedRecord(),
  inventory?: CharacterInventory["items"],
  stub: Parameters<typeof stubApi>[0] = {},
) {
  const fetchMock = stubApi({ inventory, ...stub });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const character = vex(stub.houseRules);
  client.setQueryData(characterKey(character.id), character);
  render(
    <QueryClientProvider client={client}>
      <ItemList character={character} derived={derived} />
      <SaveToasts />
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

/** Opens `group`'s Add item modal and picks from its search. */
async function addFrom(group: string, query: string, option: RegExp) {
  fireEvent.click(await screen.findByRole("button", { name: `Add item to ${group}` }));
  await pick("Search items", query, option);
}

const searchedKinds = (fetchMock: ReturnType<typeof stubApi>) =>
  fetchMock.mock.calls
    .map(([url]) => String(url))
    .filter((url) => url.startsWith("/api/search?"))
    .map((url) => new URL(url, "http://local").searchParams.get("kind") ?? undefined);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ItemList", () => {
  it("adds a picked item to the end of the inventory", async () => {
    const fetchMock = renderList();

    await screen.findByText("Longsword");
    await addFrom("Gear", "rope", /^Rope/);

    const definition = await written(fetchMock);
    expect(definition.inventory).toHaveLength(4);
    expect(definition.inventory[3]).toEqual({
      ref: { name: "Rope", source: "XPHB" },
      ...flags,
    });
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "PUT")).toHaveLength(1);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Add item to Gear" })).toHaveFocus();
  });

  it("searches a column's own items first, and every item once the filter is cleared", async () => {
    const fetchMock = renderList();

    await screen.findByText("Longsword");
    fireEvent.click(screen.getByRole("button", { name: "Add item to Armor" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Search items" }), {
      target: { value: "pl" },
    });
    await waitFor(() => expect(searchedKinds(fetchMock)).toContain("light,medium,heavy,shield"));
    const show = screen.getByRole("combobox", { name: "Show" });
    expect(show).toHaveTextContent("Armor");

    fireEvent.click(show);
    fireEvent.click(screen.getByRole("option", { name: "All items" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Search items" }), {
      target: { value: "rope" },
    });
    fireEvent.click(await screen.findByRole("option", { name: /^Rope/ }));

    expect((await written(fetchMock)).inventory[3]).toMatchObject({
      ref: { name: "Rope", source: "XPHB" },
    });
    expect(searchedKinds(fetchMock).at(-1)).toBeUndefined();
  });

  it("starts the Gear search on every kind but the weapons and armor", async () => {
    const fetchMock = renderList();

    await screen.findByText("Longsword");
    fireEvent.click(screen.getByRole("button", { name: "Add item to Gear" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Search items" }), {
      target: { value: "r" },
    });

    await waitFor(() =>
      expect(searchedKinds(fetchMock)).toContain(
        "ammunition,potion,scroll,ring,wand,rod,staff,wondrous,focus,gear,tool,treasure,other",
      ),
    );
  });

  it("adds a homebrew item by its id, the same way", async () => {
    const fetchMock = renderList();

    await screen.findByText("Longsword");
    await addFrom("Gear", "coin", /^Lucky Coin/);

    expect((await written(fetchMock)).inventory[3]).toEqual({
      ref: { homebrewId: "hb-1" },
      ...flags,
    });
  });

  it("offers each column's Add item button while the inventory is empty", async () => {
    renderList(derivedRecord(), []);

    expect(await screen.findByText("No weapons.")).toBeInTheDocument();
    for (const group of ["Weapons", "Armor", "Gear"]) {
      expect(screen.getByRole("button", { name: `Add item to ${group}` })).toBeInTheDocument();
    }
  });

  it("notes an empty group in its card", async () => {
    renderList();

    await screen.findByText("Longsword");
    const armor = screen.getByRole("heading", { level: 3, name: "Armor" }).closest("section");
    expect(armor).toHaveTextContent("No armor.");
  });

  it("adds a magic variant as the pair it names, once its base item is picked", async () => {
    const fetchMock = renderList();

    await screen.findByText("Longsword");
    await addFrom("Weapons", "+1", /^\+1 Weapon/);
    const base = screen.getByRole("combobox", { name: "Base item for +1 Weapon" });
    fireEvent.change(base, { target: { value: "dag" } });
    const another = await screen.findByRole("option", { name: /^\+1 Armor/ });
    expect(another).toHaveAttribute("aria-disabled", "true");
    expect(another).toHaveTextContent("Another magic variant, not a base item");
    expect(searchedKinds(fetchMock)).toContain("melee,ranged,ammunition");
    fireEvent.click(screen.getByRole("option", { name: /^Dagger/ }));

    const definition = await written(fetchMock);
    expect(definition.inventory[3]).toMatchObject({
      ref: { name: "Dagger", source: "XPHB" },
      variant: { name: "+1 Weapon", source: "XDMG" },
    });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Add item to Weapons" })).toHaveFocus();
  });

  it("says why a variant refuses the base item picked, and saves nothing", async () => {
    const fetchMock = stubApi({ variantStatus: 409 });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(characterKey("1"), vex());
    render(
      <QueryClientProvider client={client}>
        <ItemList character={vex()} derived={derivedRecord()} />
      </QueryClientProvider>,
    );

    await screen.findByText("Longsword");
    await addFrom("Weapons", "+1", /^\+1 Weapon/);
    await pick("Base item for +1 Weapon", "dag", /^Dagger/);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Dagger cannot take +1 Weapon. This base item does not meet the variant's requirements.",
    );
    expect(fetchMock).not.toHaveBeenCalledWith("/api/characters/1", expect.anything());
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("combobox", { name: "Search items" })).toBeInTheDocument();
  });

  it("adds a refused pair of one group anyway, saving a code that holds no error wording", async () => {
    const fetchMock = stubApi({ variantStatus: 409, refusal: "Reworded by a later release" });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(characterKey("1"), vex());
    render(
      <QueryClientProvider client={client}>
        <ItemList character={vex()} derived={derivedRecord()} />
      </QueryClientProvider>,
    );

    await screen.findByText("Longsword");
    await addFrom("Weapons", "+1", /^\+1 Weapon/);
    await pick("Base item for +1 Weapon", "dag", /^Dagger/);
    fireEvent.click(await screen.findByRole("button", { name: "Add anyway" }));

    const definition = await written(fetchMock);
    expect(definition.inventory[3]).toMatchObject({
      ref: { name: "Dagger", source: "XPHB" },
      variant: { name: "+1 Weapon", source: "XDMG" },
      variantOverride: { code: "requirements" },
    });
  });

  it("marks an overridden entry with the reason the check gave, as visible text", async () => {
    const reason = "Dagger cannot take +1 Weapon. This base item does not meet the requirements.";
    renderList(derivedRecord(), [{ ...ITEMS[0], overridden: reason }, ITEMS[1]] as SheetItem[]);

    await screen.findByText("Longsword");
    expect(within(row("Longsword")).getByText("Off the rules")).toBeVisible();
    expect(within(row("Longsword")).getByText(reason)).toBeVisible();
    expect(within(row("Cloak of Protection")).queryByText("Off the rules")).toBeNull();
  });

  it("offers no Add anyway where the server refuses the override too", async () => {
    stubApi({ variantStatus: 409, overrideStatus: 409 });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(characterKey("1"), vex());
    render(
      <QueryClientProvider client={client}>
        <ItemList character={vex()} derived={derivedRecord()} />
      </QueryClientProvider>,
    );

    await screen.findByText("Longsword");
    await addFrom("Weapons", "+1", /^\+1 Weapon/);
    await pick("Base item for +1 Weapon", "dag", /^Dagger/);
    fireEvent.click(await screen.findByRole("button", { name: "Add anyway" }));

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Add anyway" })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("cannot take +1 Weapon");
  });

  it("offers no Add anyway for a check that failed", async () => {
    stubApi({ variantStatus: 500 });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(characterKey("1"), vex());
    render(
      <QueryClientProvider client={client}>
        <ItemList character={vex()} derived={derivedRecord()} />
      </QueryClientProvider>,
    );

    await screen.findByText("Longsword");
    await addFrom("Weapons", "+1", /^\+1 Weapon/);
    await pick("Base item for +1 Weapon", "dag", /^Dagger/);

    await screen.findByRole("alert");
    expect(screen.queryByRole("button", { name: "Add anyway" })).not.toBeInTheDocument();
  });

  it("says a variant check that failed was not a refusal", async () => {
    const fetchMock = stubApi({ variantStatus: 500 });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(characterKey("1"), vex());
    render(
      <QueryClientProvider client={client}>
        <ItemList character={vex()} derived={derivedRecord()} />
      </QueryClientProvider>,
    );

    await screen.findByText("Longsword");
    await addFrom("Weapons", "+1", /^\+1 Weapon/);
    await pick("Base item for +1 Weapon", "dag", /^Dagger/);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Dagger as +1 Weapon could not be checked",
    );
    expect(fetchMock).not.toHaveBeenCalledWith("/api/characters/1", expect.anything());
  });

  it("places an item in a container and takes it out again", async () => {
    const fetchMock = renderList({
      ...derivedRecord(),
      containers: [{ entry: 1, name: "Cloak of Protection", overflow: [] }],
    });

    fireEvent.click(await screen.findByRole("combobox", { name: "Kept in, Longsword" }));
    fireEvent.click(screen.getByRole("option", { name: "In Cloak of Protection" }));

    const definition = await written(fetchMock);
    expect(definition.inventory[1].id).toBeTruthy();
    expect(definition.inventory[0].inside).toBe(definition.inventory[1].id);
    expect(screen.queryByRole("combobox", { name: "Kept in, Cloak of Protection" })).toBeNull();
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

  it("names an item without upstream's star, and still removes the entry it names", async () => {
    const [, cloak, ring] = ITEMS as [SheetItem, SheetItem, SheetItem];
    const arrow = { ...cloak, name: "Arrow of Slaying (*)", attuned: false };
    const fetchMock = renderList(derivedRecord(), [arrow, cloak, ring]);

    const remove = await screen.findByRole("button", { name: "Remove Arrow of Slaying" });
    expect(screen.getByText("Arrow of Slaying")).toBeInTheDocument();
    expect(screen.queryByText(/\(\*\)/)).toBeNull();
    fireEvent.click(remove);

    const definition = await written(fetchMock);
    expect(definition.inventory.map((entry: { ref: { name: string } }) => entry.ref.name)).toEqual([
      "Cloak of Protection",
      "Ring of Warmth",
    ]);
  });

  it("draws the list busy while a row write and its refetch run, and idle once both land", async () => {
    const fetchMock = renderList(
      { ...derivedRecord(), containers: [{ entry: 1, name: "Cloak of Protection", overflow: [] }] },
      undefined,
      { holdFirstPut: true },
    );

    const remove = await screen.findByRole("button", { name: "Remove Longsword" });
    const list = remove.closest("ul") as HTMLElement;
    expect(list).toHaveAttribute("aria-busy", "false");
    fireEvent.click(remove);
    await waitFor(() => expect(list).toHaveAttribute("aria-busy", "true"));
    const equip = screen.getByRole("button", { name: "Equipped, Ring of Warmth" });
    expect(equip).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("combobox", { name: "Kept in, Longsword" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    releasePut();

    await written(fetchMock);
    await waitFor(() => expect(list).toHaveAttribute("aria-busy", "false"));
    expect(equip).not.toHaveAttribute("aria-disabled");
  });

  it("drops a row's edit while its rows wait on a refetch, rather than edit the entry that moved up", async () => {
    const fetchMock = stubApi({ refetch: false });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(characterKey("1"), vex());
    function Live() {
      const character = useCharacter("1");
      return character.data ? (
        <ItemList character={character.data} derived={derivedRecord()} />
      ) : null;
    }
    render(
      <QueryClientProvider client={client}>
        <Live />
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Remove Longsword" }));
    await written(fetchMock);
    const cloak = screen.getByRole("button", { name: "Remove Cloak of Protection" });
    await waitFor(() => expect(cloak).toHaveAttribute("aria-disabled", "true"));
    fireEvent.click(cloak);

    const puts = fetchMock.mock.calls.filter(([, init]) => init?.method === "PUT");
    expect(puts).toHaveLength(1);
  });

  it("removes one of two entries holding the same item on a double click", async () => {
    const fetchMock = stubApi({ inventory: [ITEMS[0], ITEMS[0]] as SheetItem[] });
    const record = vex();
    const sword = { ref: { name: "Longsword", source: "PHB" }, ...flags };
    const character = {
      ...record,
      definition: { ...record.definition, inventory: [sword, sword] },
    };
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(characterKey("1"), character);
    render(
      <QueryClientProvider client={client}>
        <ItemList character={character} derived={derivedRecord()} />
      </QueryClientProvider>,
    );

    const [remove] = await screen.findAllByRole("button", { name: "Remove Longsword" });
    fireEvent.click(remove as HTMLElement);
    fireEvent.click(remove as HTMLElement);

    expect((await written(fetchMock)).inventory).toHaveLength(1);
    await waitFor(() => expect(client.isMutating() + client.isFetching()).toBe(0));
    const puts = fetchMock.mock.calls.filter(([, init]) => init?.method === "PUT");
    expect(puts).toHaveLength(1);
  });

  it("keeps row edits working after an item is added while one is saving", async () => {
    const fetchMock = stubApi({ holdFirstPut: true });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(characterKey("1"), vex());
    render(
      <QueryClientProvider client={client}>
        <ItemList character={vex()} derived={derivedRecord()} />
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Equipped, Ring of Warmth" }));
    await addFrom("Gear", "rope", /^Rope/);
    releasePut();
    await waitFor(() =>
      expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "PUT")).toHaveLength(2),
    );
    await waitFor(() => expect(client.isMutating() + client.isFetching()).toBe(0));

    fireEvent.click(screen.getByRole("button", { name: "Remove Longsword" }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "PUT")).toHaveLength(3),
    );
  });

  it("keeps the attune toggle where the derived block failed", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    stubApi();
    client.setQueryData(characterKey("1"), vex());
    render(
      <QueryClientProvider client={client}>
        <ItemList character={vex()} derived={undefined} />
      </QueryClientProvider>,
    );

    expect(
      await screen.findByRole("button", { name: "Attuned, Ring of Warmth" }),
    ).toBeInTheDocument();
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

    expect(await saveToasts().findByText(/^Longsword quantity: /)).toBeInTheDocument();
    expect(quantity).toHaveAttribute("aria-invalid", "true");
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

  describe("a weapon or armor the character lacks proficiency with", () => {
    const unproficient = (): CharacterDerived => ({
      ...derivedRecord(),
      unproficientItems: [{ entry: 0, requires: "Martial weapons" }],
    });

    it("equips as printed", async () => {
      const fetchMock = renderList(unproficient());

      fireEvent.click(await screen.findByRole("button", { name: "Equipped, Longsword" }));

      expect((await written(fetchMock)).inventory[0].equipped).toBe(true);
    });

    it("refuses under the house rule, naming the proficiency it lacks", async () => {
      const fetchMock = renderList(unproficient(), undefined, {
        houseRules: { requireEquipProficiency: true },
      });

      const blocked = await screen.findByRole("button", { name: "Equip Longsword, unavailable" });
      expect(screen.queryByRole("button", { name: "Equipped, Longsword" })).toBeNull();
      fireEvent.click(blocked);
      expect(
        within(screen.getByRole("group", { name: "Can't equip" })).getByText(
          "Requires Martial weapons proficiency.",
        ),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Equipped, Cloak of Protection" })).toBeEnabled();
      expect(fetchMock).not.toHaveBeenCalledWith("/api/characters/1", expect.anything());
    });
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

  it("attunes past the slots rather than refusing", async () => {
    const fetchMock = renderList({
      ...derivedRecord(),
      attunementSlots: { computed: 3, manual: 1, terms: [] },
    });

    await screen.findByText("Ring of Warmth");
    fireEvent.click(
      within(row("Ring of Warmth")).getByRole("button", { name: "Attuned, Ring of Warmth" }),
    );

    expect((await written(fetchMock)).inventory[2].attuned).toBe(true);
  });

  it("toasts a change that failed to save, with Retry", async () => {
    renderList();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ error: "disk full" }, 500)),
    );

    fireEvent.click(await screen.findByRole("button", { name: "Remove Longsword" }));
    expect(
      await saveToasts().findByText("Inventory: Couldn't save: disk full"),
    ).toBeInTheDocument();
    expect(saveToasts().getByRole("button", { name: /^Retry / })).toBeInTheDocument();
  });
});
