import type { CharacterInventory, SheetItem } from "@dnd/catalog";
import {
  type CharacterDerived,
  characterDefinitionSchema,
  defaultCharacterState,
} from "@dnd/character";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { characterKey } from "../../../../hooks/characterKeys.ts";
import { useCharacter } from "../../../../hooks/useCharacter.ts";
import { characterRecord, derivedRecord } from "../../../../test/records.ts";
import { saveToasts } from "../../../../test/saveToasts.ts";
import { SaveToasts } from "../../../SaveToasts.tsx";
import { ItemList } from "./ItemList.tsx";

type ResolvedItem = Extract<SheetItem, { resolved: true }>;
const flags = { quantity: 1, carried: true, equipped: false, attuned: false };
const plain = {
  type: null,
  rarity: null,
  value: null,
  estimate: null,
  weapon: null,
  armor: null,
  offers: { abilities: null, proficiency: false, language: false },
  charges: null,
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

function vex(houseRules: Record<string, boolean> = {}, firstEntry: object = {}) {
  const record = characterRecord("1", "Vex");
  const definition = characterDefinitionSchema.parse({
    ...record.definition,
    houseRules,
    inventory: [
      { ref: { name: "Longsword", source: "PHB" }, ...firstEntry },
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
  const params = new URL(url, "http://local").searchParams;
  if (params.get("type") === "language") {
    const items = [{ type: "language", name: "Elvish", source: "XPHB", edition: "one" }];
    return json({ items, total: 1, limit: 20, offset: 0 });
  }
  const kind = params.get("kind");
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

/** Answers the character's play state, raging or not, and takes a write to it. */
function stateStub(raging: boolean) {
  let state = { ...defaultCharacterState(), activeEffects: raging ? [{ name: "Rage" }] : [] };
  return (url: string, init?: RequestInit) => {
    if (url !== "/api/characters/1/state") return undefined;
    if (init?.method === "PUT") state = JSON.parse(String(init.body));
    return json({ characterId: "1", state, updatedAt: "2026-01-01T00:00:00.000Z" });
  };
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
  firstEntry,
  homebrewItem,
  raging = false,
}: {
  inventory?: SheetItem[];
  variantStatus?: number;
  overrideStatus?: number;
  refusal?: string;
  refetch?: boolean;
  holdFirstPut?: boolean;
  houseRules?: Record<string, boolean>;
  firstEntry?: object;
  /** The homebrew record `/api/homebrew/items/{id}` reads, which a `PUT` there renames. */
  homebrewItem?: { id: string; name: string };
  raging?: boolean;
} = {}) {
  let reads = 0;
  let homebrewRow = homebrewItem;
  const homebrewReply = (url: string, init?: RequestInit) => {
    if (!homebrewRow || url !== `/api/homebrew/items/${homebrewRow.id}`) return undefined;
    if (init?.method === "PUT") {
      homebrewRow = { ...homebrewRow, name: JSON.parse(String(init.body)).name };
    }
    return json(homebrewRow);
  };
  const renamed = (items: SheetItem[]) =>
    items.map((item) =>
      homebrewRow && item.homebrewId === homebrewRow.id
        ? { ...item, name: homebrewRow.name }
        : item,
    );
  let record = vex(houseRules, firstEntry);
  let held = holdFirstPut
    ? new Promise<void>((resolve) => {
        releasePut = resolve;
      })
    : undefined;
  const stateReply = stateStub(raging);
  const answer = async (url: string, init?: RequestInit) => {
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
      return reads > 1 && !refetch
        ? new Promise<Response>(() => {})
        : json({ items: renamed(inventory) });
    }
    if (url.startsWith("/api/search?")) return searchPage(url);
    if (url.startsWith("/api/items/"))
      return variantReply(url, variantStatus, overrideStatus, refusal);
    return json({ error: `nothing at ${url}` }, 404);
  };
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    return homebrewReply(url, init) ?? stateReply(url, init) ?? answer(url, init);
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
  const character = vex(stub.houseRules, stub.firstEntry);
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
  fireEvent.click(await screen.findByLabelText(`Add item to ${group}`));
  await pick("Search items", query, option);
}

const searchedKinds = (fetchMock: ReturnType<typeof stubApi>) =>
  fetchMock.mock.calls
    .map(([url]) => String(url))
    .filter((url) => url.startsWith("/api/search?"))
    .map((url) => new URL(url, "http://local").searchParams.get("kind") ?? undefined);

// Edit loads the editor as its own chunk; loaded here, no test's wait has to cover the import.
beforeAll(async () => {
  await import("../../../HomebrewEditor/HomebrewEditor.tsx");
});

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
      id: expect.any(String),
      ...flags,
    });
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "PUT")).toHaveLength(1);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByLabelText("Add item to Gear")).toHaveFocus();
  });

  it("searches a column's own items first, and every item once the filter is cleared", async () => {
    const fetchMock = renderList();

    await screen.findByText("Longsword");
    fireEvent.click(screen.getByLabelText("Add item to Armor"));
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
    fireEvent.click(screen.getByLabelText("Add item to Gear"));
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
      id: expect.any(String),
      ...flags,
    });
  });

  describe("a homebrew item's detail", () => {
    const record = {
      id: "hb-1",
      name: "Lucky Lantern",
      edition: "one",
      type: null,
      rarity: null,
      requiresAttunement: false,
      json: { name: "Lucky Lantern", source: "HB", entries: ["It glows."] },
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    const inventory: SheetItem[] = [
      ITEMS[0] as SheetItem,
      {
        resolved: true,
        name: "Lucky Lantern",
        homebrewId: "hb-1",
        ...flags,
        ...plain,
        requiresAttunement: false,
        weight: null,
      },
      { resolved: false, name: "Homebrew", homebrewId: "gone", ...flags },
    ];
    const openDetail = (name: string) =>
      fireEvent.click(within(row(name)).getByRole("button", { name }));
    const detail = () => document.querySelector("dialog[open]") as HTMLElement;

    it("offers Edit, reading the row alone, and none on a catalog item or a missing one", async () => {
      const fetchMock = renderList(derivedRecord(), inventory, { homebrewItem: record });

      await screen.findByText("Lucky Lantern");
      openDetail("Lucky Lantern");
      expect(await within(detail()).findByRole("button", { name: "Edit" })).toBeInTheDocument();
      const urls = fetchMock.mock.calls.map(([url]) => String(url));
      expect(urls).toContain("/api/homebrew/items/hb-1");
      expect(urls).not.toContain("/api/homebrew/items");
      fireEvent(detail(), new Event("cancel", { cancelable: true }));

      openDetail("Longsword");
      expect(within(detail()).queryByRole("button", { name: "Edit" })).toBeNull();
      fireEvent(detail(), new Event("cancel", { cancelable: true }));

      expect(within(row("Homebrew")).queryByRole("button", { name: "Homebrew" })).toBeNull();
    });

    it("renames the inventory row once a rename from the sheet saves", async () => {
      renderList(derivedRecord(), inventory, { homebrewItem: record });

      await screen.findByText("Lucky Lantern");
      openDetail("Lucky Lantern");
      fireEvent.click(await within(detail()).findByRole("button", { name: "Edit" }));
      const editor = await waitFor(() => {
        const open = document.querySelectorAll<HTMLElement>("dialog[open]");
        expect(open).toHaveLength(2);
        return open[1] as HTMLElement;
      });
      fireEvent.change(within(editor).getByLabelText("Name", { selector: "input" }), {
        target: { value: "Cursed Lantern" },
      });
      fireEvent.click(within(editor).getByRole("button", { name: "Save" }));

      expect(await screen.findByRole("button", { name: "Cursed Lantern" })).toBeInTheDocument();
    });
  });

  it("offers each column's Add item button while the inventory is empty", async () => {
    renderList(derivedRecord(), []);

    expect(await screen.findByText("No weapons.")).toBeInTheDocument();
    for (const group of ["Weapons", "Armor", "Gear"]) {
      expect(screen.getByLabelText(`Add item to ${group}`)).toBeInTheDocument();
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
    expect(screen.getByLabelText("Add item to Weapons")).toHaveFocus();
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
    fireEvent.click(await screen.findByText("Add anyway"));

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
    fireEvent.click(await screen.findByText("Add anyway"));

    await waitFor(() => expect(screen.queryByText("Add anyway")).not.toBeInTheDocument());
    await screen.findByText(/cannot take \+1 Weapon/);
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
    expect(screen.queryByText("Add anyway")).not.toBeInTheDocument();
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

    fireEvent.click(await screen.findByLabelText("Kept in, Longsword"));
    fireEvent.click(screen.getByRole("option", { name: "In Cloak of Protection" }));

    const definition = await written(fetchMock);
    expect(definition.inventory[1].id).toBeTruthy();
    expect(definition.inventory[0].inside).toBe(definition.inventory[1].id);
    expect(screen.queryByRole("combobox", { name: "Kept in, Cloak of Protection" })).toBeNull();
  });

  it("removes an item", async () => {
    const fetchMock = renderList();

    fireEvent.click(await screen.findByLabelText("Remove Cloak of Protection"));

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

    const remove = await screen.findByLabelText("Remove Arrow of Slaying");
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

    const remove = await screen.findByLabelText("Remove Longsword");
    const list = remove.closest("ul") as HTMLElement;
    expect(list).toHaveAttribute("aria-busy", "false");
    fireEvent.click(remove);
    await waitFor(() => expect(list).toHaveAttribute("aria-busy", "true"));
    const equip = screen.getByLabelText("Equipped, Ring of Warmth");
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

    fireEvent.click(await screen.findByLabelText("Remove Longsword"));
    await written(fetchMock);
    const cloak = screen.getByLabelText("Remove Cloak of Protection");
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

    const [remove] = await screen.findAllByLabelText("Remove Longsword");
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

    fireEvent.click(await screen.findByLabelText("Equipped, Ring of Warmth"));
    await addFrom("Gear", "rope", /^Rope/);
    releasePut();
    await waitFor(() =>
      expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "PUT")).toHaveLength(2),
    );
    await waitFor(() => expect(client.isMutating() + client.isFetching()).toBe(0));

    fireEvent.click(screen.getByLabelText("Remove Longsword"));
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

    expect(await screen.findByLabelText("Attuned, Ring of Warmth")).toBeInTheDocument();
  });

  it("changes an item's quantity", async () => {
    const fetchMock = renderList();

    const quantity = await screen.findByLabelText("Longsword quantity");
    expect(quantity).toHaveValue("1");
    fireEvent.change(quantity, { target: { value: "2" } });
    fireEvent.blur(quantity);

    expect((await written(fetchMock)).inventory[0].quantity).toBe(2);
  });

  it("refuses a quantity under one rather than removing the item", async () => {
    const fetchMock = renderList();

    const quantity = await screen.findByLabelText("Longsword quantity");
    fireEvent.change(quantity, { target: { value: "0" } });
    fireEvent.blur(quantity);

    expect(await saveToasts().findByText(/^Longsword quantity: /)).toBeInTheDocument();
    expect(quantity).toHaveAttribute("aria-invalid", "true");
    expect(fetchMock).not.toHaveBeenCalledWith("/api/characters/1", expect.anything());
  });

  it("draws the equip toggle as a backpack while stowed and the type's icon once equipped", async () => {
    renderList(derivedRecord(), [{ ...ITEMS[0], equipped: true } as SheetItem, ...ITEMS.slice(1)]);

    const sword = await screen.findByLabelText("Equipped, Longsword");
    expect(sword).toHaveAttribute("aria-pressed", "true");
    expect(sword.querySelector("svg")).toHaveClass("lucide-sword");
    const cloak = screen.getByLabelText("Equipped, Cloak of Protection");
    expect(cloak).toHaveAttribute("aria-pressed", "false");
    expect(cloak.querySelector("svg")).toHaveClass("lucide-backpack");
  });

  describe("an item's charges", () => {
    const wand = (): SheetItem[] => [
      {
        ...ITEMS[0],
        name: "Wand of Wonder",
        weapon: null,
        charges: {
          max: 7,
          printedMax: 7,
          recharge: "dawn",
          regains: { kind: "roll", notation: "1d6 + 1" },
        },
      } as SheetItem,
    ];
    const stateWrites = (fetchMock: ReturnType<typeof stubApi>) =>
      fetchMock.mock.calls
        .filter(([url, init]) => url === "/api/characters/1/state" && init?.method === "PUT")
        .map(([, init]) => JSON.parse(String(init?.body)));
    const definitionWrites = (fetchMock: ReturnType<typeof stubApi>) =>
      fetchMock.mock.calls.filter(
        ([url, init]) => url === "/api/characters/1" && init?.method === "PUT",
      );

    it("shows what is left against the maximum and when the item recharges", async () => {
      renderList(derivedRecord(), wand());
      expect(await screen.findByText(/7 \/ 7 charges/)).toHaveTextContent("recharges at dawn");
    });

    it("spends a charge in one state write and announces it, then restores it", async () => {
      const fetchMock = renderList(derivedRecord(), wand(), { firstEntry: { id: "wand" } });
      fireEvent.click(await screen.findByLabelText("Spend a charge of Wand of Wonder"));

      expect(await screen.findByText("Wand of Wonder: 6 of 7 charges left.")).toBeInTheDocument();
      expect(stateWrites(fetchMock)).toEqual([
        expect.objectContaining({ itemCharges: [{ id: "wand", expended: 1 }] }),
      ]);
      expect(definitionWrites(fetchMock)).toHaveLength(0);

      fireEvent.click(screen.getByLabelText("Restore a charge of Wand of Wonder"));
      await waitFor(() => expect(stateWrites(fetchMock)).toHaveLength(2));
      expect(stateWrites(fetchMock)[1]?.itemCharges).toEqual([]);
    });

    it("gives an entry with no id one before its first charge is spent", async () => {
      const fetchMock = renderList(derivedRecord(), wand());
      fireEvent.click(await screen.findByLabelText("Spend a charge of Wand of Wonder"));

      await waitFor(() => expect(stateWrites(fetchMock)).toHaveLength(1));
      const id = JSON.parse(String(definitionWrites(fetchMock)[0]?.[1]?.body)).inventory[0].id;
      expect(id).toEqual(expect.any(String));
      expect(stateWrites(fetchMock)[0]?.itemCharges).toEqual([{ id, expended: 1 }]);
    });

    it("keeps a restore unavailable while nothing is spent", async () => {
      renderList(derivedRecord(), wand());
      expect(await screen.findByLabelText("Restore a charge of Wand of Wonder")).toHaveAttribute(
        "aria-disabled",
        "true",
      );
    });

    it("saves the table's own maximum on the entry, and clears it at the printed one", async () => {
      const fetchMock = renderList(derivedRecord(), wand());
      const max = await screen.findByLabelText("Wand of Wonder maximum charges");
      fireEvent.change(max, { target: { value: "10" } });
      fireEvent.blur(max);

      expect((await written(fetchMock)).inventory[0].chargesMax).toBe(10);
    });
  });

  describe("heavy armor equipped during a rage", () => {
    const plate = (): SheetItem[] => [
      {
        ...ITEMS[0],
        name: "Plate Armor",
        weapon: null,
        armor: { category: "heavy", armorClass: 18 },
      } as SheetItem,
    ];
    const stateWrites = (fetchMock: ReturnType<typeof stubApi>) =>
      fetchMock.mock.calls.filter(
        ([url, init]) => url === "/api/characters/1/state" && init?.method === "PUT",
      );

    it("ends the rage", async () => {
      const fetchMock = renderList(derivedRecord(), plate(), { raging: true });
      await screen.findByText("Plate Armor");
      await waitFor(() =>
        expect(fetchMock).toHaveBeenCalledWith("/api/characters/1/state", undefined),
      );

      fireEvent.click(await screen.findByLabelText("Equipped, Plate Armor"));

      await waitFor(() => expect(stateWrites(fetchMock)).toHaveLength(1));
      expect(JSON.parse(String(stateWrites(fetchMock)[0]?.[1]?.body)).activeEffects).toEqual([]);
    });

    const failPut = (fetchMock: ReturnType<typeof stubApi>, target: string) =>
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
          String(input) === target && init?.method === "PUT"
            ? json({ error: "disk full" }, 500)
            : fetchMock(input, init),
        ),
      );

    it("toasts a rage that failed to end", async () => {
      const fetchMock = renderList(derivedRecord(), plate(), { raging: true });
      await screen.findByText("Plate Armor");
      await waitFor(() =>
        expect(fetchMock).toHaveBeenCalledWith("/api/characters/1/state", undefined),
      );
      failPut(fetchMock, "/api/characters/1/state");

      fireEvent.click(await screen.findByLabelText("Equipped, Plate Armor"));

      expect(
        await saveToasts().findByText("Rage: Couldn't end the rage: disk full"),
      ).toBeInTheDocument();
    });

    it("keeps the rage when the armor failed to save", async () => {
      const fetchMock = renderList(derivedRecord(), plate(), { raging: true });
      await screen.findByText("Plate Armor");
      await waitFor(() =>
        expect(fetchMock).toHaveBeenCalledWith("/api/characters/1/state", undefined),
      );
      failPut(fetchMock, "/api/characters/1");

      fireEvent.click(await screen.findByLabelText("Equipped, Plate Armor"));

      await saveToasts().findByText("Inventory: Couldn't save: disk full");
      expect(stateWrites(fetchMock)).toHaveLength(0);
    });

    it("leaves a character who is not raging alone", async () => {
      const fetchMock = renderList(derivedRecord(), plate());
      await screen.findByText("Plate Armor");
      await waitFor(() =>
        expect(fetchMock).toHaveBeenCalledWith("/api/characters/1/state", undefined),
      );

      fireEvent.click(await screen.findByLabelText("Equipped, Plate Armor"));

      expect((await written(fetchMock)).inventory[0].equipped).toBe(true);
      expect(stateWrites(fetchMock)).toHaveLength(0);
    });
  });

  describe("a weapon or armor the character lacks proficiency with", () => {
    const unproficient = (): CharacterDerived => ({
      ...derivedRecord(),
      unproficientItems: [{ entry: 0, requires: "Martial weapons" }],
    });

    it("equips as printed", async () => {
      const fetchMock = renderList(unproficient());

      fireEvent.click(await screen.findByLabelText("Equipped, Longsword"));

      expect((await written(fetchMock)).inventory[0].equipped).toBe(true);
    });

    it("refuses under the house rule, naming the proficiency it lacks", async () => {
      const fetchMock = renderList(unproficient(), undefined, {
        houseRules: { requireEquipProficiency: true },
      });

      const blocked = await screen.findByLabelText("Equip Longsword, unavailable");
      expect(screen.queryByLabelText("Equipped, Longsword")).toBeNull();
      fireEvent.click(blocked);
      expect(
        within(screen.getByRole("group", { name: "Can't equip" })).getByText(
          "Requires Martial weapons proficiency.",
        ),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Equipped, Cloak of Protection" })).toBeEnabled();
      expect(fetchMock).not.toHaveBeenCalledWith("/api/characters/1", expect.anything());
    });

    it("stows an item already equipped under the house rule", async () => {
      const fetchMock = renderList(
        unproficient(),
        [{ ...ITEMS[0], equipped: true } as SheetItem, ...ITEMS.slice(1)],
        { houseRules: { requireEquipProficiency: true } },
      );

      fireEvent.click(await screen.findByLabelText("Equipped, Longsword"));

      expect((await written(fetchMock)).inventory[0].equipped).toBe(false);
    });
  });

  it("carries an item it equips", async () => {
    const fetchMock = renderList();

    fireEvent.click(await screen.findByLabelText("Equipped, Ring of Warmth"));

    expect((await written(fetchMock)).inventory[2]).toMatchObject({
      equipped: true,
      carried: true,
    });
  });

  it("attunes an item while a slot is free, and ends attunement", async () => {
    const fetchMock = renderList();

    await screen.findByText("Ring of Warmth");
    const ring = within(row("Ring of Warmth"));
    fireEvent.click(ring.getByLabelText("Attuned, Ring of Warmth"));
    expect((await written(fetchMock)).inventory[2].attuned).toBe(true);

    const cloak = within(row("Cloak of Protection"));
    expect(cloak.getByLabelText("Attuned, Cloak of Protection")).toHaveAttribute(
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
    fireEvent.click(within(row("Ring of Warmth")).getByLabelText("Attuned, Ring of Warmth"));

    expect((await written(fetchMock)).inventory[2].attuned).toBe(true);
  });

  describe("picks the wearer makes", () => {
    const offering = (offers: Partial<ResolvedItem["offers"]> = {}): SheetItem[] =>
      [
        {
          ...ITEMS[0],
          offers: { abilities: null, proficiency: false, language: false, ...offers },
        },
        ...ITEMS.slice(1),
      ] as SheetItem[];
    const scores: Partial<ResolvedItem["offers"]> = {
      abilities: { from: ["str", "dex"], count: 1 },
    };

    it("offers nothing on an item that offers no pick", async () => {
      renderList();

      await screen.findByText("Longsword");
      expect(within(row("Longsword")).queryByLabelText(/^Proficiency, /)).toBeNull();
      expect(within(row("Longsword")).queryByRole("button", { name: /^Raises/ })).toBeNull();
    });

    it("replaces a score pick past the count", async () => {
      const fetchMock = renderList(derivedRecord(), offering(scores), {
        firstEntry: { abilityPicks: ["str"] },
      });

      await screen.findByText("Longsword");
      fireEvent.click(within(row("Longsword")).getByRole("button", { name: /Raises, Longsword/ }));
      fireEvent.click(screen.getByRole("checkbox", { name: "Dexterity" }));
      await waitFor(async () =>
        expect((await written(fetchMock)).inventory[0].abilityPicks).toEqual(["dex"]),
      );
    });

    it("clears a score pick", async () => {
      const fetchMock = renderList(derivedRecord(), offering(scores), {
        firstEntry: { abilityPicks: ["str"] },
      });

      await screen.findByText("Longsword");
      fireEvent.click(within(row("Longsword")).getByRole("button", { name: /Raises, Longsword/ }));
      fireEvent.click(screen.getByRole("button", { name: "Clear scores" }));
      await waitFor(async () =>
        expect((await written(fetchMock)).inventory[0]).not.toHaveProperty("abilityPicks"),
      );
    });

    it("stores a proficiency pick, and an emptied field clears it", async () => {
      const fetchMock = renderList(derivedRecord(), offering({ proficiency: true }));

      const field = await screen.findByLabelText("Proficiency, Longsword");
      fireEvent.change(field, { target: { value: "Longbow" } });
      fireEvent.blur(field);
      expect((await written(fetchMock)).inventory[0].proficiencyPick).toBe("Longbow");
    });

    it("clears a proficiency pick", async () => {
      const fetchMock = renderList(derivedRecord(), offering({ proficiency: true }), {
        firstEntry: { proficiencyPick: "Longbow" },
      });

      const field = await screen.findByLabelText("Proficiency, Longsword");
      expect(field).toHaveValue("Longbow");
      fireEvent.change(field, { target: { value: "" } });
      fireEvent.blur(field);
      await waitFor(async () =>
        expect((await written(fetchMock)).inventory[0]).not.toHaveProperty("proficiencyPick"),
      );
    });

    it("stores a language pick from the catalog", async () => {
      const fetchMock = renderList(derivedRecord(), offering({ language: true }));

      await screen.findByText("Longsword");
      await pick("Language, Longsword", "elv", /^Elvish/);

      expect((await written(fetchMock)).inventory[0].languagePick).toEqual({
        name: "Elvish",
        source: "XPHB",
      });
    });

    it("removes a language pick", async () => {
      const fetchMock = renderList(derivedRecord(), offering({ language: true }), {
        firstEntry: { languagePick: { name: "Elvish", source: "XPHB" } },
      });

      fireEvent.click(await screen.findByLabelText("Remove Elvish"));

      await waitFor(async () =>
        expect((await written(fetchMock)).inventory[0]).not.toHaveProperty("languagePick"),
      );
    });
  });

  it("toasts a change that failed to save, with Retry", async () => {
    renderList();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ error: "disk full" }, 500)),
    );

    fireEvent.click(await screen.findByLabelText("Remove Longsword"));
    expect(
      await saveToasts().findByText("Inventory: Couldn't save: disk full"),
    ).toBeInTheDocument();
    expect(saveToasts().getByRole("button", { name: /^Retry / })).toBeInTheDocument();
  });

  describe("filters", () => {
    const FILTERED: SheetItem[] = [
      ...ITEMS,
      {
        ...(ITEMS[0] as ResolvedItem),
        name: "Dagger",
        weapon: { category: "simple", damage: { dice: "1d4", type: "piercing" } },
      },
      {
        ...(ITEMS[0] as ResolvedItem),
        name: "Chain Mail",
        type: { abbreviation: "HA", name: "Heavy Armor" },
        weapon: null,
        armor: { category: "heavy", armorClass: 16 },
      },
    ];
    const weapons = () =>
      screen.getByRole("heading", { level: 3, name: "Weapons" }).closest("section") as HTMLElement;
    const armor = () =>
      screen.getByRole("heading", { level: 3, name: "Armor" }).closest("section") as HTMLElement;
    const gearCard = () =>
      screen.getByRole("heading", { level: 3, name: "Gear" }).closest("section") as HTMLElement;
    const open = (card: string) =>
      fireEvent.click(screen.getByRole("button", { name: new RegExp(`^Filter ${card}`) }));
    async function addPick(facet: string, option: string) {
      fireEvent.click(screen.getByRole("combobox", { name: `Add ${facet}` }));
      fireEvent.click(await screen.findByRole("option", { name: option }));
    }

    it("narrows a card to rows matching every facet, any pick within one, and badges the button", async () => {
      renderList(undefined, FILTERED);
      await screen.findByText("Longsword");

      open("Weapons");
      expect(screen.getAllByText("Showing all", { selector: "p" })).toHaveLength(2);
      await addPick("weapon class", "Simple");
      expect(within(weapons()).queryByText("Longsword")).toBeNull();
      expect(within(weapons()).getByText("Dagger")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Filter Weapons (1 active)" })).toBeInTheDocument();

      await addPick("weapon class", "Martial");
      expect(within(weapons()).getByText("Longsword")).toBeInTheDocument();
      await addPick("damage type", "Piercing");
      expect(within(weapons()).queryByText("Longsword")).toBeNull();
      expect(within(weapons()).getByText("Dagger")).toBeInTheDocument();
      expect(screen.queryByRole("option", { name: "Simple" })).toBeNull();
    });

    it("offers a picked option no more, and removes a chip by its ×", async () => {
      renderList(undefined, FILTERED);
      await screen.findByText("Longsword");

      open("Weapons");
      await addPick("weapon class", "Simple");
      fireEvent.click(screen.getByRole("combobox", { name: "Add weapon class" }));
      expect(screen.queryByRole("option", { name: "Simple" })).toBeNull();
      fireEvent.keyDown(screen.getByRole("combobox", { name: "Add weapon class" }), {
        key: "Escape",
      });
      fireEvent.click(screen.getByRole("button", { name: "Remove Simple" }));
      expect(screen.getAllByText("Showing all", { selector: "p" })).toHaveLength(2);
      expect(within(weapons()).getByText("Longsword")).toBeInTheDocument();
    });

    it("says nothing matches, apart from an empty card's own note", async () => {
      renderList(undefined, FILTERED);
      await screen.findByText("Longsword");

      open("Weapons");
      await addPick("weapon class", "Simple");
      await addPick("damage type", "Slashing");
      expect(weapons()).toHaveTextContent("Nothing matches the filter.");
      expect(armor()).not.toHaveTextContent("Nothing matches the filter.");
    });

    it("puts Filter immediately left of Add item at the header's far end", async () => {
      renderList(undefined, FILTERED);
      await screen.findByText("Longsword");

      const buttons = within(weapons()).getAllByRole("button", { name: /^(Filter|Add item)/ });
      expect(buttons.map((button) => button.textContent)).toEqual(["Filter", "Add item"]);
      expect(buttons[0]?.parentElement?.nextElementSibling).toBe(buttons[1]);
      expect(buttons[1]?.nextElementSibling).toBeNull();
    });

    it("keeps the empty note on a card with no rows", async () => {
      renderList(undefined, ITEMS);
      await screen.findByText("Longsword");
      expect(armor()).toHaveTextContent("No armor.");
    });

    it("resets every facet at once", async () => {
      renderList(undefined, FILTERED);
      await screen.findByText("Longsword");

      open("Weapons");
      await addPick("weapon class", "Simple");
      await addPick("damage type", "Piercing");
      fireEvent.click(screen.getByRole("button", { name: "Reset" }));
      expect(screen.getAllByText("Showing all", { selector: "p" })).toHaveLength(2);
      expect(within(weapons()).getByText("Longsword")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Filter Weapons" })).toBeInTheDocument();
    });

    it("filters Armor and Gear by their own facets", async () => {
      const gear = (name: string, category: string): ResolvedItem => ({
        ...(ITEMS[0] as ResolvedItem),
        name,
        type: { abbreviation: "G", name: category },
        weapon: null,
      });
      renderList(undefined, [
        ...FILTERED,
        {
          ...(ITEMS[0] as ResolvedItem),
          name: "Leather",
          type: { abbreviation: "LA", name: "Light Armor" },
          weapon: null,
          armor: { category: "light", armorClass: 11 },
        },
        gear("Rope", "Adventuring Gear"),
        gear("Lute", "Instrument"),
      ]);
      await screen.findByText("Longsword");

      open("Armor");
      await addPick("armor class", "Heavy");
      expect(within(armor()).getByText("Chain Mail")).toBeInTheDocument();
      expect(within(armor()).queryByText("Leather")).toBeNull();

      open("Gear");
      await addPick("category", "Instrument");
      expect(within(gearCard()).getByText("Lute")).toBeInTheDocument();
      expect(within(gearCard()).queryByText("Rope")).toBeNull();
    });

    it("closes on Escape with focus back on the Filter button", async () => {
      renderList(undefined, FILTERED);
      await screen.findByText("Longsword");

      const button = screen.getByRole("button", { name: "Filter Weapons" });
      button.focus();
      fireEvent.click(button);
      const select = screen.getByRole("combobox", { name: "Add weapon class" });
      select.focus();
      fireEvent.keyDown(select, { key: "ArrowDown" });
      fireEvent.keyDown(select, { key: "ArrowDown" });
      fireEvent.keyDown(select, { key: "Enter" });
      expect(screen.getByRole("button", { name: "Remove Martial" })).toBeInTheDocument();

      fireEvent.keyDown(screen.getByRole("button", { name: "Remove Martial" }), { key: "Escape" });
      expect(screen.queryByRole("group", { name: "Weapons filter" })).toBeNull();
      expect(screen.getByRole("button", { name: "Filter Weapons (1 active)" })).toHaveFocus();
    });

    it("edits a filtered row as it does unfiltered", async () => {
      const fetchMock = renderList(undefined, FILTERED);
      await screen.findByText("Longsword");

      open("Weapons");
      await addPick("weapon class", "Martial");
      const quantity = screen.getByLabelText("Longsword quantity");
      fireEvent.change(quantity, { target: { value: "2" } });
      fireEvent.blur(quantity);
      expect((await written(fetchMock)).inventory[0].quantity).toBe(2);
    });

    it("shows every card unfiltered after a remount", async () => {
      renderList(undefined, FILTERED);
      await screen.findByText("Longsword");
      open("Weapons");
      await addPick("weapon class", "Simple");
      expect(within(weapons()).queryByText("Longsword")).toBeNull();

      cleanup();
      renderList(undefined, FILTERED);
      await screen.findByText("Longsword");
      expect(screen.getByRole("button", { name: "Filter Weapons" })).toBeInTheDocument();
      expect(within(weapons()).getByText("Dagger")).toBeInTheDocument();
    });
  });
});
