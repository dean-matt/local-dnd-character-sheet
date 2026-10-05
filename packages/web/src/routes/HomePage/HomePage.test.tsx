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

/** Renders the page with `characters` as the list, or with that request failing where omitted. */
function renderHome(characters?: unknown) {
  stubFetchByUrl(
    characters === undefined
      ? { "/api/search/types": types }
      : { "/api/characters": characters, "/api/search/types": types },
  );
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
    renderHome([
      changed("1", "2026-01-01T00:00:00.000Z"),
      changed("2", "2026-01-05T00:00:00.000Z"),
      changed("3", "2026-01-03T00:00:00.000Z"),
      changed("4", "2026-01-04T00:00:00.000Z"),
      changed("5", "2026-01-02T00:00:00.000Z"),
    ]);

    await screen.findByRole("link", { name: "See all characters →" });
    const recent = screen.getByRole("region", { name: "Recent characters" });
    const tiles = within(recent)
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href")?.startsWith("/characters/"));
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
    const actions = within(recent).getAllByRole("button");
    expect(actions.map((button) => button.textContent)).toEqual(["Import", "+ New Character"]);
  });

  it("welcomes a first run with New Character leading, and no list to see", async () => {
    renderHome([]);

    expect(
      await screen.findByRole("heading", { level: 1, name: "Welcome to Local D&D" }),
    ).toBeInTheDocument();
    expect(screen.getByText("No characters yet")).toBeInTheDocument();
    const actions = screen.getAllByRole("button");
    expect(actions.map((button) => button.textContent)).toEqual(["+ New Character", "Import"]);
    for (const button of actions) {
      expect(button).toHaveAttribute("aria-disabled", "true");
      expect(button).toHaveAccessibleDescription("Not built yet");
    }
    expect(screen.queryByRole("link", { name: /see all characters/i })).not.toBeInTheDocument();
  });

  it("shows the error when the characters fail to load", async () => {
    renderHome();

    expect(await screen.findByRole("alert")).toHaveTextContent("nothing at /api/characters");
  });

  it("links to Search, Settings and each catalog type the search returns", async () => {
    renderHome([]);

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
});
