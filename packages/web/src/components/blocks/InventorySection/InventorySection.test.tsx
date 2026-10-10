import type { CharacterInventory, SheetItem } from "@dnd/catalog";
import {
  type CharacterDerived,
  type CharacterReferences,
  characterDefinitionSchema,
} from "@dnd/character";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterKey } from "../../../hooks/characterKeys.ts";
import { characterRecord, derivedRecord } from "../../../test/records.ts";
import { stubFetch, stubFetchByUrl } from "../../../test/stubFetch.ts";
import { InventorySection } from "./InventorySection.tsx";

const flags = { quantity: 1, carried: true, equipped: false, attuned: false };
const plain = { type: null, value: null, estimate: null, weapon: null, armor: null };

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
      estimate: null,
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
      estimate: null,
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
      estimate: null,
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
      { ref: { name: "Longsword", source: "PHB" }, equipped: true },
      { ref: { name: "Cloak of Protection", source: "DMG" }, attuned: true },
      { ref: { name: "Ring of Warmth", source: "DMG" }, attuned: true, carried: false },
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

function renderSection(
  derived: CharacterDerived | null = load(),
  inventory = INVENTORY,
  references?: CharacterReferences,
) {
  const fetchMock = stubFetchByUrl({
    "/api/characters/1/inventory": inventory,
    ...(references && { "/api/characters/1/references": references }),
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const character = vex();
  client.setQueryData(characterKey(character.id), character);
  render(
    <QueryClientProvider client={client}>
      <InventorySection character={character} derived={derived ?? undefined} />
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
    const pressed = (name: string) => screen.getByRole("button", { name }).ariaPressed;
    expect(pressed("Equipped, +1 Longsword")).toBe("true");
    expect(row("+1 Longsword")).toHaveTextContent("Uncommon");
    expect(within(row("+1 Longsword")).queryByRole("button", { name: /^Attuned/ })).toBeNull();
    expect(pressed("Attuned, Cloak of Protection")).toBe("true");
    expect(pressed("Attuned, Ring of Warmth")).toBe("false");
    expect(row("Ring of Warmth")).toHaveTextContent("Not carried");
    expect(row("Ring of Warmth")).toHaveTextContent("Unknown (magic)");
    expect(screen.getByRole("textbox", { name: "Arrow quantity" })).toHaveValue("20");
    expect(row("Arrow")).toHaveTextContent("Weight: 1 lb");
    expect(row("Arrow")).not.toHaveTextContent("none");
  });

  it("marks a price a rarity table estimates, and names the table", async () => {
    const item = (
      name: string,
      estimate: Extract<SheetItem, { resolved: true }>["estimate"],
      quantity = 1,
    ) => ({
      resolved: true as const,
      name,
      source: "DMG",
      ...flags,
      ...plain,
      quantity,
      type: { abbreviation: "W", name: null },
      rarity: "rare",
      requiresAttunement: false,
      weight: null,
      entries: [],
      estimate,
    });
    renderSection(load(), {
      items: [
        item("Wand of Fear", {
          kind: "amount",
          table: "Magic Item Rarities and Values",
          copper: 400000,
        }),
        item(
          "Potion of Climbing",
          { kind: "range", table: "Magic Item Rarity", min: 2550, max: 5000 },
          2,
        ),
        item("Sovereign Glue", {
          kind: "range",
          table: "Magic Item Rarity",
          min: 5000100,
          max: null,
        }),
        item("Orb of Dragonkind", { kind: "priceless", table: "Magic Item Rarity" }),
      ],
    });

    await screen.findByText("Wand of Fear");
    expect(row("Wand of Fear")).toHaveTextContent("Estimated cost ~4,000 gp");
    expect(row("Potion of Climbing")).toHaveTextContent("Estimated cost ~51\u2013100 gp");
    expect(row("Sovereign Glue")).toHaveTextContent("~50,001+ gp");
    expect(row("Orb of Dragonkind")).toHaveTextContent("Estimated cost Priceless");
    expect(
      within(row("Wand of Fear")).getByTitle(
        "Estimated from the Magic Item Rarities and Values table",
      ),
    ).toBeInTheDocument();
  });

  it("splits the items into Weapons, Armor and Gear by type, keeping their order", async () => {
    renderSection();

    await screen.findByText("+1 Longsword");
    const names = (group: string) =>
      card(group)
        .getAllByRole("listitem")
        .map((li) => li.querySelector('[aria-haspopup="dialog"]')?.textContent);
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

    const net = (await screen.findByText("Net, as +1 Weapon (DMG)")).closest("li") as HTMLElement;
    expect(net).toHaveTextContent("PHB");
    expect(net).toHaveTextContent("Not found in the catalog");
    expect(within(net).queryByRole("button", { name: /^Net/ })).toBeNull();
  });

  it("names the variant a renamed one became", async () => {
    renderSection(load(), INVENTORY, {
      unresolved: [
        {
          field: "inventory[7].variant",
          kind: "item",
          ref: { name: "+1 Weapon", source: "DMG" },
          parent: { name: "Net", source: "PHB" },
          renamedTo: { name: "+1 Weapon", source: "XDMG" },
        },
      ],
    });

    const net = (await screen.findByText(/^Net,/)).closest("li") as HTMLElement;
    expect(await within(net).findByText("Renamed to +1 Weapon (XDMG)")).toBeInTheDocument();
  });

  it("leaves a variant unrenamed where only another row's base takes the rename", async () => {
    const variant = { name: "+1 Weapon", source: "DMG" };
    const missing = { resolved: false, source: "PHB", ...flags, variant } as const;
    renderSection(
      load(),
      {
        items: [
          { ...missing, name: "Net" },
          { ...missing, name: "Whip" },
        ],
      },
      {
        unresolved: [
          {
            field: "inventory[0].variant",
            kind: "item",
            ref: variant,
            parent: { name: "Net", source: "PHB" },
            renamedTo: { name: "+1 Weapon", source: "XDMG" },
          },
          { field: "inventory[1].ref", kind: "item", ref: { name: "Whip", source: "PHB" } },
          {
            field: "inventory[1].variant",
            kind: "item",
            ref: variant,
            parent: { name: "Whip", source: "PHB" },
          },
        ],
      },
    );

    await screen.findByText("Renamed to +1 Weapon (XDMG)");
    const whip = screen.getByText(/^Whip,/).closest("li") as HTMLElement;
    expect(whip).toHaveTextContent("Not found in the catalog");
  });

  it("counts the attunement slots in use against the derived total", () => {
    renderSection(load({ attunementSlots: { computed: 3, manual: 4, terms: [] } }));

    const attunement = card("Attunement");
    expect(attunement.getByText("Attuned").nextSibling).toHaveTextContent("2");
    expect(attunement.getByText("Slots").nextSibling).toHaveTextContent("4*");
  });

  it("warns, naming the attuned items, once more are attuned than the limit", async () => {
    renderSection(load({ attunementSlots: { computed: 3, manual: 1, terms: [] } }), {
      items: INVENTORY.items.map((item) =>
        item.name === "Ring of Warmth" ? { ...item, attuned: true } : item,
      ),
    } as CharacterInventory);

    await screen.findByText("Ring of Warmth");
    await waitFor(() =>
      expect(card("Attunement").getByRole("status")).toHaveTextContent(
        "2 / 1 attuned, over the limit: Cloak of Protection and Ring of Warmth.",
      ),
    );
  });

  it("shows no warning at or under the limit", async () => {
    renderSection(load({ attunementSlots: { computed: 2, manual: null, terms: [] } }));

    await screen.findByText("Ring of Warmth");
    expect(card("Attunement").queryByRole("status")).toBeNull();
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
    expect(
      currency
        .getAllByRole("textbox")
        .map((box) => (box as HTMLInputElement).labels?.[0]?.textContent)
        .filter((label) => !label?.startsWith("Adjust")),
    ).toEqual(["Platinum (pp)", "Gold (gp)", "Electrum (ep)", "Silver (sp)", "Copper (cp)"]);
    expect(currency.getByRole("textbox", { name: "Gold (gp)" })).toHaveValue("1,250");
    expect(currency.getByRole("textbox", { name: "Silver (sp)" })).toHaveValue("3");
    expect(currency.getByRole("textbox", { name: "Platinum (pp)" })).toHaveValue("0");
  });

  it("refuses a cleared coin rather than save it as none", async () => {
    const fetchMock = renderSection();

    const gold = card("Currency").getByRole("textbox", { name: "Gold (gp)" });
    fireEvent.change(gold, { target: { value: "" } });
    fireEvent.blur(gold);

    expect(await card("Currency").findByRole("alert")).toHaveTextContent("Not a valid value.");
    expect(fetchMock).not.toHaveBeenCalledWith("/api/characters/1", expect.anything());
  });

  it("writes an edited coin into the definition", async () => {
    const fetchMock = renderSection();

    const gold = card("Currency").getByRole("textbox", { name: "Gold (gp)" });
    fireEvent.change(gold, { target: { value: "1,300" } });
    fireEvent.blur(gold);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/characters/1", expect.anything()),
    );
    const init = fetchMock.mock.calls.find(([url]) => url === "/api/characters/1")?.[1];
    expect(JSON.parse(String(init?.body)).money).toMatchObject({ gold: 1300, silver: 3 });
  });

  describe("a coin adjustment", () => {
    const putBodies = (fetchMock: ReturnType<typeof vi.fn>) =>
      fetchMock.mock.calls
        .filter(([url]) => url === "/api/characters/1")
        .map(([, init]) => JSON.parse(String(init?.body)));

    function adjustGold(amount: string) {
      const field = card("Currency").getByRole("textbox", {
        name: "Adjust gold, negative to remove",
      }) as HTMLInputElement;
      fireEvent.change(field, { target: { value: amount } });
      fireEvent.submit(field.form as HTMLFormElement);
      return field;
    }

    it("adds a signed amount to the coin's total in one write", async () => {
      const fetchMock = renderSection();

      const field = adjustGold("+25");

      await waitFor(() => expect(putBodies(fetchMock)).toHaveLength(1));
      expect(putBodies(fetchMock)[0].money).toMatchObject({ gold: 1275, silver: 3 });
      expect(field).toHaveValue("");
    });

    it("takes a negative amount, commas and all, from the total", async () => {
      const fetchMock = renderSection();

      adjustGold("-1,000");

      await waitFor(() => expect(putBodies(fetchMock)).toHaveLength(1));
      expect(putBodies(fetchMock)[0].money).toMatchObject({ gold: 250 });
    });

    it("refuses a subtraction past the total and names the shortfall", async () => {
      const fetchMock = renderSection();

      adjustGold("-1,300");

      expect(await card("Currency").findByRole("alert")).toHaveTextContent(
        "Gold: Short by 50 gp; the total stays 1,250 gp.",
      );
      expect(putBodies(fetchMock)).toHaveLength(0);
      expect(card("Currency").getByRole("textbox", { name: "Gold (gp)" })).toHaveValue("1,250");
    });

    it("checks the shortfall against a write still settling, not the rendered total", async () => {
      const fetchMock = renderSection();
      let land = () => {};
      const writes = vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
        String(input) === "/api/characters/1"
          ? new Promise<Response>((resolve) => {
              land = () =>
                resolve(
                  new Response(
                    JSON.stringify({ ...vex(), definition: JSON.parse(String(init?.body)) }),
                  ),
                );
            })
          : fetchMock(input, init),
      );
      vi.stubGlobal("fetch", writes);

      adjustGold("-1,000");
      await waitFor(() => expect(putBodies(writes)).toHaveLength(1));
      adjustGold("-1,000");
      land();

      expect(await card("Currency").findByRole("alert")).toHaveTextContent(
        "Gold: Short by 750 gp; the total stays 250 gp.",
      );
      expect(putBodies(writes)).toHaveLength(1);
    });

    it("clears a refused shortfall once the amount is retyped", async () => {
      renderSection();

      const field = adjustGold("-1,300");
      await card("Currency").findByRole("alert");
      fireEvent.change(field, { target: { value: "-37" } });

      await waitFor(() => expect(card("Currency").queryByRole("alert")).toBeNull());
    });

    it("retries a write that failed, unsigned amount and all", async () => {
      const fetchMock = renderSection();

      adjustGold("25");
      expect(await card("Currency").findByRole("alert")).toHaveTextContent(
        "Gold: Couldn't save +25 gp",
      );
      fireEvent.click(card("Currency").getByRole("button", { name: "Retry" }));

      await waitFor(() => expect(putBodies(fetchMock)).toHaveLength(2));
      expect(putBodies(fetchMock).map((body) => body.money.gold)).toEqual([1275, 1275]);
    });

    it("keeps a write's Retry when the next amount is typed while it saves", async () => {
      const fetchMock = renderSection();
      let fail = () => {};
      const writes = vi.fn((input: RequestInfo | URL, init?: RequestInit) =>
        String(input) === "/api/characters/1"
          ? new Promise<Response>((resolve) => {
              fail = () =>
                resolve(new Response(JSON.stringify({ error: "down" }), { status: 500 }));
            })
          : fetchMock(input, init),
      );
      vi.stubGlobal("fetch", writes);

      const field = adjustGold("+25");
      await waitFor(() => expect(putBodies(writes)).toHaveLength(1));
      fireEvent.change(field, { target: { value: "-3" } });
      fail();

      expect(await card("Currency").findByRole("button", { name: "Retry" })).toBeInTheDocument();
    });

    it("applies the amount from its button as well as Enter", async () => {
      const fetchMock = renderSection();

      fireEvent.change(
        card("Currency").getByRole("textbox", { name: "Adjust gold, negative to remove" }),
        { target: { value: "+5" } },
      );
      fireEvent.click(card("Currency").getByRole("button", { name: "Apply gold adjustment" }));

      await waitFor(() => expect(putBodies(fetchMock)).toHaveLength(1));
      expect(putBodies(fetchMock)[0].money).toMatchObject({ gold: 1255 });
    });

    it("refuses text that is not a whole amount", async () => {
      const fetchMock = renderSection();

      adjustGold("10,00");

      expect(await card("Currency").findByRole("alert")).toHaveTextContent(
        "Enter an amount such as +25 or -37.",
      );
      expect(putBodies(fetchMock)).toHaveLength(0);
    });
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

  describe("a weapon's attack", () => {
    const attack = (grip: CharacterDerived["attacks"][number]["grip"]) => ({
      entry: 0,
      ability: "str" as const,
      attackBonus: {
        computed: 4,
        manual: null,
        terms: [
          { label: "Strength", value: 3 },
          { label: "Magic", value: 1 },
        ],
      },
      critThreshold: { computed: 20, manual: null, terms: [] },
      damage: {
        dice: grip?.held === "two-handed" ? "1d10" : "1d8",
        type: "slashing",
        modifier: { computed: 4, manual: null, terms: [{ label: "Strength", value: 3 }] },
      },
      grip,
      mastery: [],
    });
    const held = { held: "one-handed" as const, twoHandedBlocked: false };

    it("shows the attack and damage chips in place of the die, each opening its terms", async () => {
      renderSection(load({ attacks: [attack(held)] }));

      await screen.findByText("+1 Longsword");
      const sword = within(row("+1 Longsword"));
      expect(sword.queryByText("1d8")).toBeNull();
      fireEvent.click(sword.getByRole("button", { name: "+1 Longsword attack bonus +4" }));
      const terms = sword.getByRole("group", { name: "+1 Longsword attack bonus" });
      expect(terms).toHaveTextContent("Strength3");
      expect(terms).toHaveTextContent("Magic1");
      fireEvent.click(sword.getByRole("button", { name: "+1 Longsword damage 1d8+4" }));
      expect(sword.getByRole("group", { name: "+1 Longsword damage" })).toHaveTextContent(
        "One-handed 1d8",
      );
    });

    it("draws no grip toggle for a weapon with one die", async () => {
      renderSection(load({ attacks: [attack(null)] }));

      await screen.findByText("+1 Longsword");
      expect(within(row("+1 Longsword")).queryByRole("group", { name: /grip/ })).toBeNull();
    });

    it("stores the grip a player picks on the weapon's own inventory entry", async () => {
      const fetchMock = renderSection(load({ attacks: [attack(held)] }));

      const grip = within(await screen.findByRole("group", { name: "+1 Longsword grip" }));
      expect(grip.getByRole("button", { name: "1h, one-handed" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      fireEvent.click(grip.getByRole("button", { name: "2h, two-handed" }));

      await waitFor(() =>
        expect(fetchMock).toHaveBeenCalledWith("/api/characters/1", expect.anything()),
      );
      const init = fetchMock.mock.calls.find(([url]) => url === "/api/characters/1")?.[1];
      expect(init?.method).toBe("PUT");
      expect(JSON.parse(String(init?.body)).inventory[0]).toMatchObject({
        ref: { name: "Longsword", source: "PHB" },
        grip: "two-handed",
      });
    });

    it("says why two-handed is unavailable beside a shield, and writes nothing", async () => {
      const fetchMock = renderSection(
        load({ attacks: [attack({ held: "one-handed", twoHandedBlocked: true })] }),
      );

      const grip = within(await screen.findByRole("group", { name: "+1 Longsword grip" }));
      fireEvent.click(grip.getByRole("button", { name: "2h, two-handed, unavailable" }));
      expect(grip.getByRole("group", { name: "Two-handed" })).toHaveTextContent(
        "Unavailable while this weapon and a shield are both equipped.",
      );
      expect(fetchMock).not.toHaveBeenCalledWith("/api/characters/1", expect.anything());
    });

    it("says so when the grip fails to save", async () => {
      renderSection(load({ attacks: [attack(held)] }));

      const grip = within(await screen.findByRole("group", { name: "+1 Longsword grip" }));
      fireEvent.click(grip.getByRole("button", { name: "2h, two-handed" }));
      expect(await screen.findByRole("alert")).toHaveTextContent("The change was not saved");
    });
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
