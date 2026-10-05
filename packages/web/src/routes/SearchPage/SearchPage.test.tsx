import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterRecord } from "../../test/records.ts";
import { stubFetchByUrl } from "../../test/stubFetch.ts";
import { SearchPage } from "./SearchPage.tsx";

const page = (items: unknown[], total = items.length, offset = 0) => ({
  items,
  total,
  limit: 50,
  offset,
});

const fireball = { type: "spell", name: "Fireball", source: "PHB", edition: "classic" };
const fireGiant = { type: "monster", name: "Fire Giant", source: "MM", edition: null };

const shared = {
  "/api/characters": [characterRecord("7", "Fira")],
  "/api/search/types": { types: ["item", "monster", "spell"] },
  "/api/search/sources": { sources: ["MM", "PHB"] },
  "/api/catalog/sources": { sources: [] },
};

function renderAt(path: string, bodies: Record<string, unknown>) {
  const fetchMock = stubFetchByUrl({ ...shared, ...bodies });
  router = createMemoryRouter([{ path: "/search", element: <SearchPage /> }], {
    initialEntries: [path],
  });
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return fetchMock;
}

let router: ReturnType<typeof createMemoryRouter>;
const where = () => router.state.location.pathname + router.state.location.search;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SearchPage", () => {
  it("restores the query and filters from the URL, and lists characters before the compendium", async () => {
    renderAt("/search?q=fir", {
      "/api/search?q=fir&limit=50": page([fireball, fireGiant]),
    });

    expect(screen.getByRole("searchbox", { name: "Search the compendium" })).toHaveValue("fir");
    const results = await screen.findByRole("list", { name: "Results" });
    await within(results).findByRole("link", { name: "Fira" });
    expect(
      within(results)
        .getAllByRole("listitem")
        .map((row) => row.textContent),
    ).toEqual([
      expect.stringContaining("Fira"),
      expect.stringContaining("Fireball"),
      expect.stringContaining("Fire Giant"),
    ]);
    expect(within(results).getByRole("link", { name: "Fira" })).toHaveAttribute(
      "href",
      "/characters/7",
    );
    expect(screen.getByRole("status")).toHaveTextContent("2 results and 1 character");
    expect(within(results).getByText(/No page yet/)).toBeInTheDocument();
  });

  it("opens a compendium result's detail in a modal", async () => {
    renderAt("/search?q=fire&type=spell", {
      "/api/search?q=fire&limit=50&type=spell": page([fireball]),
    });

    fireEvent.click(await screen.findByRole("button", { name: "Fireball" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("lists every row of a ticked type for an empty query", async () => {
    renderAt("/search?type=monster", {
      "/api/search?limit=50&type=monster": page([fireGiant]),
    });

    expect(await screen.findByText("Fire Giant")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Type Monsters" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("writes a filter change to the URL, and announces the new count", async () => {
    renderAt("/search?q=fire", {
      "/api/search?q=fire&limit=50": page([fireball, fireGiant]),
      "/api/search?q=fire&limit=50&type=spell": page([fireball]),
      "/api/search?q=fire&limit=50&type=spell&minLevel=3": page([fireball]),
      "/api/search?edition=one&q=fire&limit=50&type=spell&minLevel=3": page([]),
    });
    await screen.findByText("Fire Giant");

    fireEvent.click(await screen.findByRole("button", { name: "Type All types" }));
    fireEvent.click(await screen.findByRole("checkbox", { name: "Spells" }));
    expect(where()).toBe("/search?q=fire&type=spell");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("1 result"));

    fireEvent.change(screen.getByRole("spinbutton", { name: "Min" }), { target: { value: "3" } });
    expect(where()).toBe("/search?q=fire&type=spell&minLevel=3");

    fireEvent.click(screen.getByRole("checkbox", { name: "2014" }));
    expect(where()).toBe("/search?q=fire&type=spell&edition=one&minLevel=3");
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        'No results for "fire" under these filters.',
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
    expect(where()).toBe("/search?q=fire");
  });

  it("narrows by a source picked from the select, and removes it by its chip", async () => {
    renderAt("/search?q=fire", {
      "/api/search?q=fire&limit=50": page([fireball, fireGiant]),
      "/api/search?q=fire&limit=50&source=PHB": page([fireball]),
    });
    const select = await screen.findByRole("combobox", { name: "Narrow by source" });
    await within(select).findByRole("option", { name: "PHB" });

    fireEvent.change(select, { target: { value: "PHB" } });
    expect(where()).toBe("/search?q=fire&source=PHB");

    fireEvent.click(screen.getByRole("button", { name: "Remove PHB" }));
    expect(where()).toBe("/search?q=fire");
  });

  it("lists every row of a picked source for an empty query", async () => {
    renderAt("/search?source=MM", { "/api/search?limit=50&source=MM": page([fireGiant]) });

    expect(await screen.findByText("Fire Giant")).toBeInTheDocument();
  });

  it("offers rarity once Item is ticked", async () => {
    renderAt("/search?type=item", {
      "/api/search?limit=50&type=item": page([]),
      "/api/search?limit=50&type=item&rarity=very+rare": page([]),
    });

    fireEvent.change(await screen.findByRole("combobox", { name: "Narrow by rarity" }), {
      target: { value: "very rare" },
    });
    expect(where()).toBe("/search?type=item&rarity=very+rare");
    expect(screen.queryByRole("spinbutton", { name: "Min" })).not.toBeInTheDocument();
  });

  it("narrows items by kind once Item is ticked", async () => {
    renderAt("/search?type=item&kind=melee", {
      "/api/search?limit=50&type=item&kind=melee": page([]),
      "/api/search?limit=50&type=item&kind=melee%2Cshield": page([]),
    });

    const kind = await screen.findByRole("group", { name: "Kind" });
    expect(within(kind).getByText("Melee weapon")).toBeInTheDocument();
    fireEvent.change(within(kind).getByRole("combobox", { name: "Narrow by kind" }), {
      target: { value: "shield" },
    });
    expect(where()).toBe("/search?type=item&kind=melee%2Cshield");
  });

  it("leaves the level range alone while a level field is cleared to type a new one", async () => {
    renderAt("/search?type=spell&minLevel=3", {
      "/api/search?limit=50&type=spell&minLevel=3": page([]),
      "/api/search?limit=50&type=spell&minLevel=3&maxLevel=5": page([]),
    });

    const max = await screen.findByRole("spinbutton", { name: "Max" });
    fireEvent.change(max, { target: { value: "" } });
    expect(where()).toBe("/search?type=spell&minLevel=3");
    fireEvent.change(max, { target: { value: "5" } });
    expect(where()).toBe("/search?type=spell&minLevel=3&maxLevel=5");
  });

  it("offers Reset filters for no results only where a filter is set", async () => {
    renderAt("/search?q=zzz", { "/api/search?q=zzz&limit=50": page([]) });

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent('No results for "zzz"'),
    );
    expect(screen.queryByRole("button", { name: "Reset filters" })).not.toBeInTheDocument();
  });

  it("leads an item's line under its name with its kind, then its rarity", async () => {
    const longbow = {
      type: "item",
      name: "Longbow of Warning",
      source: "DMG",
      edition: "classic",
      item: { kinds: ["ranged"], rarity: "uncommon", category: "martial" },
    };
    renderAt("/search?type=item", { "/api/search?limit=50&type=item": page([longbow]) });

    const row = (await screen.findByRole("button", { name: "Longbow of Warning" })).closest("li");
    expect(row).toHaveTextContent("Martial ranged weapon • Uncommon");
    expect(within(row as HTMLElement).getByText("Item")).toBeInTheDocument();
  });

  it("picks types from a list the Type button opens, by keyboard, and names them on the button", async () => {
    renderAt("/search?q=fire", {
      "/api/search?q=fire&limit=50": page([]),
      "/api/search?q=fire&limit=50&type=item": page([]),
      "/api/search?q=fire&limit=50&type=item%2Cmonster": page([]),
    });

    const button = await screen.findByRole("button", { name: "Type All types" });
    fireEvent.click(button);
    const list = await screen.findByRole("group", { name: "Types to search" });
    const items = within(list).getByRole("checkbox", { name: "Items" });
    fireEvent.keyDown(button, { key: "ArrowDown" });
    expect(items).toHaveFocus();
    fireEvent.click(items);
    expect(where()).toBe("/search?q=fire&type=item");
    expect(await screen.findByRole("combobox", { name: "Narrow by kind" })).toBeInTheDocument();

    fireEvent.keyDown(items, { key: "ArrowDown" });
    const monsters = within(list).getByRole("checkbox", { name: "Monsters" });
    expect(monsters).toHaveFocus();
    fireEvent.click(monsters);
    expect(where()).toBe("/search?q=fire&type=item%2Cmonster");
    expect(screen.getByRole("button", { name: "Type Items, Monsters" })).toBeInTheDocument();

    fireEvent.keyDown(monsters, { key: "Escape" });
    expect(screen.queryByRole("group", { name: "Types to search" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Type Items, Monsters" })).toHaveFocus();
  });

  it("collapses to a filter icon that counts the filters on and opens the rail again", async () => {
    renderAt("/search?type=item&kind=melee%2Cranged", {
      "/api/search?limit=50&type=item&kind=melee%2Cranged": page([]),
    });

    fireEvent.click(await screen.findByRole("button", { name: "Hide filters" }));
    const show = screen.getByRole("button", { name: "Show filters (3 on)" });
    expect(show).toHaveTextContent("3");
    expect(screen.queryByRole("button", { name: /^Type/ })).not.toBeInTheDocument();

    fireEvent.click(show);
    expect(screen.getByRole("button", { name: "Type Items" })).toBeInTheDocument();
  });

  it("pages through results by offset", async () => {
    renderAt("/search?type=monster", {
      "/api/search?limit=50&type=monster": page([fireGiant], 120),
      "/api/search?limit=50&offset=50&type=monster": page([fireGiant], 120, 50),
    });

    const pages = await screen.findByRole("navigation", { name: "Result pages" });
    expect(within(pages).getByRole("button", { name: "Previous" })).toBeDisabled();
    fireEvent.click(within(pages).getByRole("button", { name: "Next" }));
    expect(where()).toBe("/search?type=monster&offset=50");
    expect(await screen.findByText("51–100 of 120")).toBeInTheDocument();
  });

  it("asks for a query before searching anything", () => {
    const fetchMock = renderAt("/search", {});

    expect(screen.getByRole("status")).toHaveTextContent(
      "Type a name to search the compendium, or pick a type or source.",
    );
    expect(fetchMock.mock.calls.map(([url]) => String(url))).not.toContainEqual(
      expect.stringMatching(/^\/api\/search\?/),
    );
  });
});
