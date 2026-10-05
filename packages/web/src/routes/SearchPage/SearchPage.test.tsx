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
    expect(screen.getByRole("checkbox", { name: "Monster" })).toBeChecked();
  });

  it("writes a filter change to the URL, and announces the new count", async () => {
    renderAt("/search?q=fire", {
      "/api/search?q=fire&limit=50": page([fireball, fireGiant]),
      "/api/search?q=fire&limit=50&type=spell": page([fireball]),
      "/api/search?q=fire&limit=50&type=spell&minLevel=3": page([fireball]),
      "/api/search?edition=one&q=fire&limit=50&type=spell&minLevel=3": page([]),
    });
    await screen.findByText("Fire Giant");

    fireEvent.click(await screen.findByRole("checkbox", { name: "Spell" }));
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
