import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterRecord } from "../../test/records.ts";
import { stubFetchByUrl } from "../../test/stubFetch.ts";
import { HomePage } from "./HomePage.tsx";

const types = { types: ["spell", "item", "condition"] };

function changed(id: string, updatedAt: string) {
  return { ...characterRecord(id, `Hero ${id}`), updatedAt };
}

/** New Character and Import, in the order they are drawn. */
function actionOrder(scope: Pick<typeof screen, "getByRole">) {
  const row = scope.getByRole("link", { name: "+ New Character" }).parentElement;
  return Array.from(row?.children ?? [], (action) => action.textContent);
}

/** Renders the page with `bodies` as the API's answers, any request it omits failing. */
function renderHome(
  bodies: Record<string, unknown> = { "/api/characters": [], "/api/search/types": types },
) {
  stubFetchByUrl(bodies);
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("HomePage", () => {
  it("shows the four most recently changed characters, newest first", async () => {
    renderHome({
      "/api/search/types": types,
      "/api/characters": [
        changed("1", "2026-01-01T00:00:00.000Z"),
        changed("2", "2026-01-05T00:00:00.000Z"),
        changed("3", "2026-01-03T00:00:00.000Z"),
        changed("4", "2026-01-04T00:00:00.000Z"),
        changed("5", "2026-01-02T00:00:00.000Z"),
      ],
    });

    await screen.findByRole("link", { name: "See all characters →" });
    const recent = screen.getByRole("region", { name: "Recent characters" });
    const tiles = within(recent)
      .getAllByRole("link")
      .filter((link) => /^\/characters\/\d+$/.test(link.getAttribute("href") ?? ""));
    expect(tiles.map((tile) => tile.getAttribute("href"))).toEqual([
      "/characters/2",
      "/characters/4",
      "/characters/3",
      "/characters/5",
    ]);
    expect(within(recent).getByRole("link", { name: "See all characters →" })).toHaveAttribute(
      "href",
      "/characters",
    );
    expect(actionOrder(within(recent))).toEqual(["Import", "+ New Character"]);
  });

  it("welcomes a first run with New Character leading, and no list to see", async () => {
    renderHome();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Welcome to Local D&D" }),
    ).toBeInTheDocument();
    expect(screen.getByText("No characters yet")).toBeInTheDocument();
    expect(actionOrder(screen)).toEqual(["+ New Character", "Import"]);
    expect(screen.getByRole("link", { name: "+ New Character" })).toHaveAttribute(
      "href",
      "/characters/new",
    );
    const importButton = screen.getByRole("button", { name: "Import" });
    expect(importButton).toHaveAttribute("aria-disabled", "true");
    expect(importButton).toHaveAccessibleDescription("Import is not built yet");
    expect(screen.queryByRole("link", { name: /see all characters/i })).not.toBeInTheDocument();
  });

  it("shows a loading state while the characters are in flight", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Loading characters…");
  });

  it("shows the error when the characters fail to load", async () => {
    renderHome({ "/api/search/types": types });

    expect(await screen.findByRole("alert")).toHaveTextContent("nothing at /api/characters");
  });

  it("links to Search, Settings and each catalog type the search returns", async () => {
    renderHome();

    const explore = screen.getByRole("region", { name: "Explore" });
    expect(within(explore).getByRole("link", { name: /^Search/ })).toHaveAttribute(
      "href",
      "/search",
    );
    expect(within(explore).getByRole("link", { name: /^Settings/ })).toHaveAttribute(
      "href",
      "/settings",
    );
    const compendium = await within(explore).findByRole("list", { name: "Compendium" });
    expect(
      within(compendium)
        .getAllByRole("link")
        .map((link) => [link.textContent, link.getAttribute("href")]),
    ).toEqual([
      ["Conditions", "/search?type=condition"],
      ["Items", "/search?type=item"],
      ["Spells", "/search?type=spell"],
    ]);
  });

  it("says so in Explore when the catalog's types fail to load, keeping Search and Settings", async () => {
    renderHome({ "/api/characters": [] });

    const explore = screen.getByRole("region", { name: "Explore" });
    expect(
      await within(explore).findByText("The catalog's types did not load."),
    ).toBeInTheDocument();
    expect(within(explore).getByRole("link", { name: /^Search/ })).toBeInTheDocument();
    expect(within(explore).queryByRole("list", { name: "Compendium" })).not.toBeInTheDocument();
  });
});
