import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { routeConfig } from "../router.tsx";
import { stubFetchByUrl } from "../test/stubFetch.ts";

function renderAt(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={createMemoryRouter(routeConfig, { initialEntries: [path] })} />
    </QueryClientProvider>,
  );
}

const feat = (name: string, source: string, edition: "classic" | "one") => ({
  name,
  source,
  edition,
  json: { name, source, entries: [] },
});

const homebrewSpell = {
  id: "9",
  name: "Ember Lash",
  edition: "one",
  level: 1,
  school: "V",
  concentration: false,
  ritual: false,
  json: {
    name: "Ember Lash",
    source: "Homebrew",
    level: 1,
    school: "V",
    duration: [{ type: "instant" }],
    entries: [],
  },
  createdAt: "2024-01-01T00:00:00.000Z",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CatalogIndexPage", () => {
  it("lists one edition's rows, each linking to its detail route", async () => {
    stubFetchByUrl({
      "/api/characters": [],
      "/api/feats?edition=one&limit=100&offset=0": {
        items: [feat("Alert", "XPHB", "one"), feat("Tough", "XPHB", "one")],
        total: 2,
        limit: 100,
        offset: 0,
      },
    });
    renderAt("/catalog/feats");

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Feats");
    expect(await screen.findByRole("link", { name: /Alert/ })).toHaveAttribute(
      "href",
      "/catalog/feats/Alert/XPHB",
    );
    const editions = within(screen.getByRole("navigation", { name: "Edition" }));
    expect(editions.getByRole("link", { name: "2024" })).toHaveAttribute("aria-current", "page");
    expect(editions.getByRole("link", { name: "2014" })).toHaveAttribute(
      "href",
      "/catalog/feats?edition=classic&page=1",
    );
    expect(screen.queryByRole("navigation", { name: "Pages" })).not.toBeInTheDocument();
  });

  it("links a homebrew row by its id and pages through the rest", async () => {
    stubFetchByUrl({
      "/api/characters": [],
      "/api/spells?edition=one&limit=100&offset=100": {
        items: [homebrewSpell],
        total: 250,
        limit: 100,
        offset: 100,
      },
    });
    renderAt("/catalog/spells?edition=one&page=2");

    expect(await screen.findByRole("link", { name: /Ember Lash/ })).toHaveAttribute(
      "href",
      "/catalog/homebrew/spells/9",
    );
    const pages = within(screen.getByRole("navigation", { name: "Pages" }));
    expect(pages.getByText("Page 2 of 3")).toBeInTheDocument();
    expect(pages.getByRole("link", { name: /Previous/ })).toHaveAttribute(
      "href",
      "/catalog/spells?edition=one&page=1",
    );
    expect(pages.getByRole("link", { name: /Next/ })).toHaveAttribute(
      "href",
      "/catalog/spells?edition=one&page=3",
    );
  });

  it("points a page past the last back to the last", async () => {
    stubFetchByUrl({
      "/api/feats?edition=one&limit=100&offset=800": {
        items: [],
        total: 250,
        limit: 100,
        offset: 800,
      },
    });
    renderAt("/catalog/feats?page=9");

    expect(await screen.findByText(/This list ends at page 3/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to the last page" })).toHaveAttribute(
      "href",
      "/catalog/feats?edition=one&page=3",
    );
    expect(screen.queryByRole("navigation", { name: "Pages" })).not.toBeInTheDocument();
  });

  it("says when an edition has no rows of the type", async () => {
    stubFetchByUrl({
      "/api/characters": [],
      "/api/races?edition=classic&limit=100&offset=0": {
        items: [],
        total: 0,
        limit: 100,
        offset: 0,
      },
    });
    renderAt("/catalog/races?edition=classic");

    expect(await screen.findByText("No races in this edition.")).toBeInTheDocument();
  });
});
