import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stubFetchByUrl } from "../test/stubFetch.ts";
import { CatalogDetail } from "./CatalogDetail.tsx";

function renderAt(address: string) {
  const onClose = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <CatalogDetail address={address} onClose={onClose} />
    </QueryClientProvider>,
  );
  return onClose;
}

const dialogNamed = (name: string) => screen.findByRole("dialog", { name });

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
        name: "Blast",
        entries: [{ type: "entries", name: "Nested", entries: [] }],
      },
    ],
    entriesHigherLevel: [{ type: "entries", name: "At Higher Levels", entries: ["More dice."] }],
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

describe("CatalogDetail", () => {
  it("renders a row's name, source and text through the token renderer", async () => {
    stubFetchByUrl({ "/api/spells/Fireball/PHB": fireball });
    renderAt("/spells/Fireball/PHB");

    await dialogNamed("Fireball");
    expect(screen.getByText("PHB")).toBeInTheDocument();
    expect(screen.getByText("Spell")).toBeInTheDocument();
    expect(screen.getByText("2014 rules")).toBeInTheDocument();
    expect(screen.getByText("bright").tagName).toBe("STRONG");
    expect(screen.getByRole("heading", { level: 3, name: "Blast" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 4, name: "Nested" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "At Higher Levels" })).toBeInTheDocument();
    expect(screen.getByText("More dice.")).toBeInTheDocument();
  });

  it("reads a class feature from its class's grants at the level its address names", async () => {
    const fetchMock = stubFetchByUrl({ "/api/classes/Barbarian/PHB/at/3": barbarianAt3 });
    renderAt("/classes/Barbarian/PHB/features/Primal%20Path/PHB/3");

    await dialogNamed("Primal Path");
    expect(screen.getByText("Primal Path text.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/classes/Barbarian/PHB/at/3", undefined);
  });

  it("says a feature granted at another level is not found at this one", async () => {
    stubFetchByUrl({ "/api/classes/Barbarian/PHB/at/3": barbarianAt3 });
    renderAt("/classes/Barbarian/PHB/features/Rage/PHB/3");

    await dialogNamed("Not found");
    expect(
      screen.getByText(/the class feature Rage \(PHB\) of Barbarian \(PHB\) at level 3/),
    ).toBeInTheDocument();
  });

  it("reads a subclass feature under the short name its tag carries", async () => {
    const berserker = {
      name: "Path of the Berserker",
      source: "PHB",
      shortName: "Berserker",
      className: "Barbarian",
      classSource: "PHB",
      edition: "classic",
      json: { name: "Path of the Berserker", source: "PHB" },
    };
    const list = (items: unknown[]) => ({ items, total: items.length, limit: 200, offset: 0 });
    const fetchMock = stubFetchByUrl({
      "/api/classes/Barbarian/PHB/subclasses?edition=classic&limit=200": list([berserker]),
      "/api/classes/Barbarian/PHB/subclasses?edition=one&limit=200": list([]),
      "/api/classes/Barbarian/PHB/subclasses/Path%20of%20the%20Berserker/PHB/at/3": {
        ...barbarianAt3,
        features: [feature("Frenzy", 3)],
      },
    });
    renderAt("/classes/Barbarian/PHB/subclasses/Berserker/PHB/features/Frenzy/PHB/3");

    await dialogNamed("Frenzy");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/classes/Barbarian/PHB/subclasses/Path%20of%20the%20Berserker/PHB/at/3",
      undefined,
    );
  });

  it("says a subclass short name the class does not have is not found", async () => {
    stubFetchByUrl({
      "/api/classes/Barbarian/PHB/subclasses?edition=classic&limit=200": { items: [] },
      "/api/classes/Barbarian/PHB/subclasses?edition=one&limit=200": { items: [] },
    });
    renderAt("/classes/Barbarian/PHB/subclasses/Nope/PHB/features/Frenzy/PHB/3");

    await dialogNamed("Not found");
    expect(
      screen.getByText(/the subclass feature Frenzy \(PHB\) of Nope \(PHB\)/),
    ).toBeInTheDocument();
  });

  it("reads a subrace under its race's pair", async () => {
    const fetchMock = stubFetchByUrl({
      "/api/races/Elf/PHB/subraces/High/PHB": {
        name: "High",
        source: "PHB",
        raceName: "Elf",
        raceSource: "PHB",
        edition: "classic",
        json: { name: "High", source: "PHB", entries: ["A keen mind."] },
      },
    });
    renderAt("/races/Elf/PHB/subraces/High/PHB");

    await screen.findByText("A keen mind.");
    expect(fetchMock).toHaveBeenCalledWith("/api/races/Elf/PHB/subraces/High/PHB", undefined);
  });

  it("says a feature level no class reaches is not found, without asking the API", async () => {
    const fetchMock = stubFetchByUrl({ "/api/characters": [] });
    renderAt("/classes/Barbarian/PHB/features/Rage/PHB/21");

    await dialogNamed("Not found");
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/classes/Barbarian/PHB/features/Rage/PHB/21",
      undefined,
    );
  });

  it("says a row with no rules text of its own has none", async () => {
    stubFetchByUrl({
      "/api/classes/Barbarian/PHB": {
        name: "Barbarian",
        source: "PHB",
        edition: "classic",
        hitDie: 12,
        json: { name: "Barbarian", source: "PHB" },
      },
    });
    renderAt("/classes/Barbarian/PHB");

    await dialogNamed("Barbarian");
    expect(screen.getByText("This row carries no rules text of its own.")).toBeInTheDocument();
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
    renderAt("/homebrew/spells/hb-1");

    await dialogNamed("Frost Nova");
    expect(screen.getByText("Homebrew")).toBeInTheDocument();
  });

  it("renders a magic variant under the name its expansion gives it", async () => {
    stubFetchByUrl({ "/api/items/Longsword/PHB/variants/%2B1%20Weapon/DMG": longsword });
    renderAt("/items/Longsword/PHB/variants/%2B1%20Weapon/DMG");

    await dialogNamed("+1 Longsword");
  });

  it("says an address no target matches is not found, without asking the API", async () => {
    const fetchMock = stubFetchByUrl({});
    renderAt("/monsters/Goblin/MM");

    await dialogNamed("Not found");
    expect(screen.getByText(/Nothing answers to \/monsters\/Goblin\/MM\./)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["the close button", () => fireEvent.click(screen.getByRole("button", { name: "Close" }))],
    ["the backdrop", () => fireEvent.click(screen.getByRole("dialog"))],
    ["Escape", () => fireEvent(screen.getByRole("dialog"), new Event("cancel"))],
  ])("closes by %s", async (_how, close) => {
    stubFetchByUrl({ "/api/spells/Fireball/PHB": fireball });
    const onClose = renderAt("/spells/Fireball/PHB");
    await dialogNamed("Fireball");

    close();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("stays open for a click inside its content", async () => {
    stubFetchByUrl({ "/api/spells/Fireball/PHB": fireball });
    const onClose = renderAt("/spells/Fireball/PHB");
    await dialogNamed("Fireball");

    fireEvent.click(screen.getByText("More dice."));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("says what a stale link looked for", async () => {
    stubFetchByUrl({});
    renderAt("/spells/Fireball/XPHB");

    await dialogNamed("Not found");
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
    renderAt(url.replace("/api", ""));

    expect(await screen.findByRole("alert")).toHaveTextContent("Not a sword");
  });
});
