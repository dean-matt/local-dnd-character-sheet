import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
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

const fireball = {
  name: "Fireball",
  source: "PHB",
  edition: "classic",
  level: 3,
  school: "V",
  concentration: false,
  ritual: false,
  json: {
    name: "Fireball",
    source: "PHB",
    level: 3,
    school: "V",
    duration: [{ type: "instant" }],
    entries: [
      "A {@b bright} streak.",
      {
        type: "entries",
        name: "At Higher Levels",
        entries: [{ type: "entries", name: "Nested", entries: ["deeper"] }],
      },
    ],
  },
};

const longsword = {
  name: "+1 Longsword",
  source: "DMG",
  edition: "classic",
  kind: "item",
  type: "M",
  rarity: "uncommon",
  requiresAttunement: false,
  json: { name: "+1 Longsword", source: "DMG", entries: ["A bonus to attack and damage."] },
};

const feature = (name: string, level: number) => ({
  name,
  source: "PHB",
  level,
  json: { name, source: "PHB", entries: [`${name} text.`] },
});

const barbarianAt3 = {
  level: 3,
  resources: [],
  spellSlots: [],
  optionalFeatures: [],
  features: [feature("Rage", 1), feature("Primal Path", 3)],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CatalogPage", () => {
  it("renders a row's name, source and text through the token renderer", async () => {
    stubFetchByUrl({ "/api/spells/Fireball/PHB": fireball });
    renderAt("/catalog/spells/Fireball/PHB");

    await screen.findByRole("heading", { level: 1, name: "Fireball" });
    expect(screen.getByText("PHB")).toBeInTheDocument();
    expect(screen.getByText("bright").tagName).toBe("STRONG");
    expect(screen.getByRole("heading", { level: 2, name: "At Higher Levels" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Nested" })).toBeInTheDocument();
  });

  it("reads a class feature from its class's grants at the level its address names", async () => {
    const fetchMock = stubFetchByUrl({ "/api/classes/Barbarian/PHB/at/3": barbarianAt3 });
    renderAt("/catalog/classes/Barbarian/PHB/features/Primal%20Path/PHB/3");

    await screen.findByRole("heading", { level: 1, name: "Primal Path" });
    expect(screen.getByText("Primal Path text.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/classes/Barbarian/PHB/at/3", undefined);
  });

  it("says a feature granted at another level is not found at this one", async () => {
    stubFetchByUrl({ "/api/classes/Barbarian/PHB/at/3": barbarianAt3 });
    renderAt("/catalog/classes/Barbarian/PHB/features/Rage/PHB/3");

    await screen.findByRole("heading", { level: 1, name: "Page not found" });
    expect(
      screen.getByText(/the class feature Rage \(PHB\) of Barbarian \(PHB\) at level 3/),
    ).toBeInTheDocument();
  });

  it("marks a homebrew row as homebrew", async () => {
    stubFetchByUrl({
      "/api/homebrew/spells/hb-1": {
        id: "hb-1",
        name: "Frost Nova",
        edition: "one",
        level: 2,
        school: "V",
        concentration: false,
        ritual: false,
        json: { ...fireball.json, name: "Frost Nova", source: "HB" },
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    });
    renderAt("/catalog/homebrew/spells/hb-1");

    await screen.findByRole("heading", { level: 1, name: "Frost Nova" });
    expect(screen.getByText("Homebrew")).toBeInTheDocument();
  });

  it("renders a magic variant under the name its expansion gives it", async () => {
    stubFetchByUrl({ "/api/items/Longsword/PHB/variants/%2B1%20Weapon/DMG": longsword });
    renderAt("/catalog/items/Longsword/PHB/variants/%2B1%20Weapon/DMG");

    await screen.findByRole("heading", { level: 1, name: "+1 Longsword" });
  });

  it("says what a stale link looked for", async () => {
    stubFetchByUrl({});
    renderAt("/catalog/spells/Fireball/XPHB");

    await screen.findByRole("heading", { level: 1, name: "Page not found" });
    expect(
      screen.getByText(/Nothing answers to the spell Fireball \(XPHB\)\./),
    ).toBeInTheDocument();
  });

  it("shows a refusal that is not a 404 as an error", async () => {
    const url = "/api/items/Club/PHB/variants/Vorpal%20Sword/DMG";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "Not a sword" }), { status: 409 })),
    );
    renderAt(url.replace("/api", "/catalog"));

    expect(await screen.findByRole("alert")).toHaveTextContent("Not a sword");
  });
});
