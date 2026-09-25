import type { CharacterFeatures } from "@dnd/catalog";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterRecord } from "../../test/records.ts";
import { stubFetch, stubFetchByUrl } from "../../test/stubFetch.ts";
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
          entries: ["Raise a score."],
        },
      ],
    },
    {
      origin: "race",
      name: "Elf (High)",
      features: [
        { resolved: true, name: "Darkvision", source: "PHB", entries: ["You see in the dark."] },
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

function renderSection(features: CharacterFeatures = FEATURES) {
  stubFetchByUrl({ "/api/characters/1/features": features });
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
  it("heads each group with its grantor and says what kind of grantor it is", async () => {
    renderSection();

    expect(
      await screen.findByRole("heading", { level: 3, name: "Fighter, Class" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Elf (High), Race" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Feats" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "Optional features" }),
    ).toBeInTheDocument();
  });

  it("shows each feature's level and the type an option was taken under", async () => {
    renderSection();

    const fighter = (await screen.findByRole("heading", { name: "Fighter, Class" })).closest(
      "section",
    );
    expect(within(fighter as HTMLElement).getByText("Level 4")).toBeInTheDocument();
    expect(screen.getByText("Fighting Style (Fighter)")).toBeInTheDocument();
    expect(screen.getByText("RP")).toBeInTheDocument();
  });

  it("renders a feature's text through the token renderer, not as raw markup", async () => {
    renderSection();

    const summary = await screen.findByText("Second Wind");
    fireEvent.click(summary);
    const details = summary.closest("details") as HTMLElement;
    expect(details).toHaveAttribute("open");
    await waitFor(() => expect(details).toHaveTextContent("Regain 1d10 hit points."));
    expect(details).not.toHaveTextContent("{@dice");
  });

  it("mounts a feature's text only once it is opened, so a closed one resolves nothing", async () => {
    renderSection();

    const summary = await screen.findByText("Second Wind");
    const details = summary.closest("details") as HTMLElement;
    expect(details).not.toHaveTextContent("Regain");
    fireEvent.click(summary);
    await waitFor(() => expect(details).toHaveTextContent("Regain 1d10 hit points."));
  });

  it("shows a reference that resolves to nothing by its stored name, marked", async () => {
    renderSection();

    const row = (await screen.findByText("Lucky (PHB)")).closest("li") as HTMLElement;
    expect(row).toHaveTextContent("Not found in the catalog");
    expect(row.querySelector("details")).toBeNull();
  });

  it("says a missing homebrew reference is missing from homebrew, not the catalog", async () => {
    renderSection({
      groups: [{ origin: "feat", features: [{ resolved: false, name: "Homebrew", level: 4 }] }],
    });

    const row = (await screen.findByText("Homebrew")).closest("li") as HTMLElement;
    expect(row).toHaveTextContent("Not found in homebrew");
  });

  it("narrows every group to the features whose name matches the filter", async () => {
    renderSection();

    await screen.findByText("Second Wind");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    fireEvent.change(screen.getByLabelText("Find a feature"), {
      target: { value: "dark" },
    });
    expect(screen.getByText("Darkvision")).toBeInTheDocument();
    expect(screen.queryByText("Second Wind")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Fighter, Class" })).toBeNull();

    fireEvent.change(screen.getByLabelText("Find a feature"), { target: { value: "zzz" } });
    expect(screen.getByRole("status")).toHaveTextContent("No feature matches “zzz”.");
    expect(
      screen.getByText("No feature matches “zzz”.", { selector: "[aria-hidden]" }),
    ).toBeVisible();
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
