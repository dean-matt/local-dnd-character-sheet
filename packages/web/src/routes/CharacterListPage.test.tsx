import { characterDefinitionSchema } from "@dnd/character";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stubFetch } from "../test/stubFetch.ts";
import { CharacterListPage } from "./CharacterListPage.tsx";

function characterRecord(id: string, name: string) {
  return {
    id,
    name,
    edition: "one" as const,
    level: 1,
    raceSummary: "Half-Elf",
    classSummary: "Warlock",
    definition: characterDefinitionSchema.parse({
      name,
      edition: "one",
      levels: [{ class: { name: "Warlock", source: "XPHB" } }],
      race: { name: "Half-Elf", source: "XPHB" },
      background: { name: "Charlatan", source: "XPHB" },
      abilityScores: { str: 8, dex: 16, con: 14, int: 10, wis: 12, cha: 17 },
      proficiencies: {
        savingThrows: [],
        skills: [],
        armor: [],
        weapons: [],
        tools: [],
        languages: [],
      },
      inventory: [],
      spells: [],
    }),
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CharacterListPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CharacterListPage", () => {
  it("shows a loading state while the list is in flight", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));
    renderPage();

    expect(screen.getByRole("status")).toHaveTextContent("Loading characters…");
  });

  it("shows an error state when the request fails", async () => {
    stubFetch(new Response(JSON.stringify({ error: "no data dir" }), { status: 500 }));
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("no data dir");
  });

  it("shows the empty state when the list resolves with no characters, saying how to add one", async () => {
    stubFetch(new Response(JSON.stringify([]), { status: 200 }));
    renderPage();

    expect(
      await screen.findByText("No characters yet. POST a definition to /characters to add one."),
    ).toBeInTheDocument();
  });

  it("lists each character as a link to its page, with its name, level, edition and summaries", async () => {
    stubFetch(
      new Response(JSON.stringify([characterRecord("1", "Vex"), characterRecord("2", "Nyx")]), {
        status: 200,
      }),
    );
    renderPage();

    const links = await screen.findAllByRole("link");
    expect(links[0]).toHaveAttribute("href", "/characters/1");
    expect(links[0]).toHaveTextContent("Vex");
    expect(links[0]).toHaveTextContent("Half-Elf Warlock");
    expect(links[0]).toHaveTextContent("Level 1");
    expect(links[0]).toHaveTextContent("One");
    expect(links[1]).toHaveAttribute("href", "/characters/2");
    expect(links[1]).toHaveTextContent("Nyx");
  });
});
