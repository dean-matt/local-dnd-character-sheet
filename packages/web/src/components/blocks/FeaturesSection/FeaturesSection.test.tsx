import type { CharacterFeatures } from "@dnd/catalog";
import type { CharacterReferences } from "@dnd/character";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterRecord } from "../../../test/records.ts";
import { stubFetch, stubFetchByUrl } from "../../../test/stubFetch.ts";
import { FeaturesSection } from "./FeaturesSection.tsx";

const FEATURES: CharacterFeatures = {
  groups: [
    {
      origin: "class",
      name: "Fighter",
      features: [
        {
          resolved: true,
          name: "Second Wind",
          source: "PHB",
          level: 1,
          entries: ["Regain {@dice 1d10} hit points."],
        },
        {
          resolved: true,
          name: "Ability Score Improvement",
          source: "PHB",
          level: 4,
          entries: ["Raise a score, or take {@feat Alert}."],
        },
      ],
    },
    {
      origin: "race",
      name: "Elf (High)",
      features: [
        {
          resolved: true,
          name: "Darkvision",
          source: "PHB",
          entries: ["You see in the dark, unlike the {@condition blinded}."],
        },
      ],
    },
    {
      origin: "feat",
      features: [{ resolved: false, name: "Lucky", source: "PHB", level: 4 }],
    },
    {
      origin: "optionalFeature",
      features: [
        {
          resolved: true,
          name: "Archery",
          source: "PHB",
          featureType: "FS:F",
          entries: ["+2 to ranged attacks."],
        },
        { resolved: true, name: "Renown", source: "EFA", featureType: "RP", entries: [] },
      ],
    },
  ],
};

const WITH_BACKGROUND: CharacterFeatures = {
  groups: [
    ...FEATURES.groups.slice(0, 1),
    {
      origin: "subclass",
      name: "Champion",
      features: [
        { resolved: true, name: "Improved Critical", source: "PHB", level: 3, entries: [] },
      ],
    },
    ...FEATURES.groups.slice(1, 2),
    {
      origin: "background",
      name: "Acolyte",
      features: [{ resolved: true, name: "Shelter of the Faithful", source: "PHB", entries: [] }],
    },
    ...FEATURES.groups.slice(2),
  ],
};

const card = (title: string) =>
  screen.getByRole("heading", { level: 3, name: title }).closest("section") as HTMLElement;

function renderSection(features: CharacterFeatures = FEATURES, references?: CharacterReferences) {
  stubFetchByUrl({
    "/api/characters/1/features": features,
    ...(references && { "/api/characters/1/references": references }),
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <FeaturesSection character={characterRecord("1", "Vex")} />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("FeaturesSection", () => {
  it("gathers features into Class, Race, Background and Chosen cards", async () => {
    renderSection(WITH_BACKGROUND);

    const headings = await screen.findAllByRole("heading", { level: 3 });
    expect(headings.map((heading) => heading.textContent)).toEqual([
      "Class Features",
      "Race Features",
      "Background Features",
      "Chosen Features",
    ]);
    const cls = card("Class Features");
    expect(within(cls).getByText("Second Wind")).toBeInTheDocument();
    expect(within(cls).getByText("Improved Critical")).toBeInTheDocument();
    const chosen = card("Chosen Features");
    expect(within(chosen).getByText("Lucky")).toBeInTheDocument();
    expect(within(chosen).getByText("Archery")).toBeInTheDocument();
    expect(within(card("Background Features")).getByText("Shelter of the Faithful")).toBeVisible();
  });

  it("leaves out a card with nothing in it", async () => {
    renderSection();

    await screen.findByText("Second Wind");
    expect(screen.queryByRole("heading", { name: "Background Features" })).toBeNull();
  });

  it("chips each row with its grantor or option type and shows its level", async () => {
    renderSection(WITH_BACKGROUND);

    const secondWind = (await screen.findByText("Second Wind")).closest("li") as HTMLElement;
    expect(within(secondWind).getByText("Fighter")).toBeInTheDocument();
    expect(within(secondWind).getByText("Level 1", { selector: ".sr-only" })).toBeInTheDocument();
    expect(within(secondWind).getByText("Lvl 1")).toHaveAttribute("aria-hidden", "true");
    const critical = screen.getByText("Improved Critical").closest("li") as HTMLElement;
    expect(within(critical).getByText("Champion")).toBeInTheDocument();
    const darkvision = screen.getByText("Darkvision").closest("li") as HTMLElement;
    expect(within(darkvision).getByText("Elf (High)")).toBeInTheDocument();
    expect(within(darkvision).queryByText(/Lvl/)).toBeNull();
    const archery = screen.getByText("Archery").closest("li") as HTMLElement;
    expect(within(archery).getByText("Fighting Style (Fighter)")).toBeInTheDocument();
    expect(screen.getByText("RP")).toBeInTheDocument();
  });

  it("renders a feature's text through the token renderer, not as raw markup", async () => {
    renderSection();

    fireEvent.click(await screen.findByRole("button", { name: "Second Wind" }));
    const modal = screen.getByRole("dialog", { name: "Second Wind" });
    expect(modal).toHaveTextContent("Fighter • Level 1");
    expect(modal).toHaveTextContent("Regain 1d10 hit points.");
    expect(modal).not.toHaveTextContent("{@dice");
  });

  it("names a chosen feature's origin and option type in its modal", async () => {
    renderSection();

    fireEvent.click(await screen.findByRole("button", { name: "Archery" }));
    expect(screen.getByRole("dialog", { name: "Archery" })).toHaveTextContent(
      "Optional feature • Fighting Style (Fighter)",
    );
  });

  it("resolves every feature's references in one request for the section", async () => {
    const fetchMock = stubFetchByUrl({
      "/api/characters/1/features": FEATURES,
      "/api/refs/resolve": { refs: [] },
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <FeaturesSection character={characterRecord("1", "Vex")} />
      </QueryClientProvider>,
    );

    await screen.findByText("Second Wind");
    await waitFor(() =>
      expect(fetchMock.mock.calls.filter(([url]) => url === "/api/refs/resolve")).toHaveLength(1),
    );
    const [, init] = fetchMock.mock.calls.find(([url]) => url === "/api/refs/resolve") ?? [];
    expect(JSON.parse(String(init?.body)).refs).toEqual([
      { tag: "feat", name: "Alert" },
      { tag: "condition", name: "blinded" },
    ]);
  });

  it("shows a reference that resolves to nothing by its stored name, marked", async () => {
    renderSection();

    const row = (await screen.findByText("Lucky")).closest("li") as HTMLElement;
    expect(row).toHaveTextContent("PHB");
    expect(row).toHaveTextContent("Not found in the catalog");
    expect(within(row).queryByRole("button")).toBeNull();
  });

  it("names the feat a renamed reference became", async () => {
    renderSection(FEATURES, {
      unresolved: [
        {
          field: "feats[0].ref",
          kind: "feat",
          ref: { name: "Lucky", source: "PHB" },
          renamedTo: { name: "Lucky", source: "XPHB" },
        },
      ],
    });

    const row = (await screen.findByText("Lucky")).closest("li") as HTMLElement;
    expect(await within(row).findByText("Renamed to Lucky (XPHB)")).toBeInTheDocument();
  });

  it("says a missing homebrew reference is missing from homebrew, not the catalog", async () => {
    renderSection({
      groups: [{ origin: "feat", features: [{ resolved: false, name: "Moonlit Oath", level: 4 }] }],
    });

    const row = (await screen.findByText("Moonlit Oath")).closest("li") as HTMLElement;
    expect(row).toHaveTextContent("Homebrew");
    expect(row).toHaveTextContent("Not found in homebrew");
  });

  it("narrows every card to the features whose name matches the search", async () => {
    renderSection();

    await screen.findByText("Second Wind");
    const search = screen.getByRole("searchbox", { name: "Search features" });
    expect(search).toHaveAttribute("placeholder", "Search features…");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();

    fireEvent.change(search, { target: { value: "dark" } });
    expect(screen.getByText("Darkvision")).toBeInTheDocument();
    expect(screen.queryByText("Second Wind")).toBeNull();
    expect(within(card("Class Features")).getByText("No class features match “dark”.")).toHaveClass(
      "italic",
    );
    expect(screen.getByRole("status")).toBeEmptyDOMElement();

    fireEvent.change(search, { target: { value: "zzz" } });
    expect(screen.getByRole("status")).toHaveTextContent("No feature matches “zzz”.");
    expect(within(card("Race Features")).getByText("No race features match “zzz”.")).toBeVisible();
  });

  it("says so when the character has gained nothing", async () => {
    renderSection({ groups: [] });

    expect(await screen.findByText("Vex has no features yet.")).toBeInTheDocument();
  });

  it("reports a failed read", async () => {
    stubFetch(
      new Response(JSON.stringify({ error: "No character with that id" }), { status: 404 }),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <FeaturesSection character={characterRecord("1", "Vex")} />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("No character with that id");
  });

  it("waits on the character before it asks for anything", () => {
    const fetchMock = stubFetch(new Response("{}"));
    render(
      <QueryClientProvider client={new QueryClient()}>
        <FeaturesSection character={undefined} />
      </QueryClientProvider>,
    );

    expect(screen.getByText("Features isn't available yet.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
