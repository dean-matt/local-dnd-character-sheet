import { characterDefinitionSchema } from "@dnd/character";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { charactersKey } from "../hooks/characterKeys.ts";
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

function renderPage(
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
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

  it("drops the count when a refetch fails over a list it already holds", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(charactersKey, [characterRecord("1", "vex")]);
    stubFetch(new Response(JSON.stringify({ error: "no data dir" }), { status: 500 }));
    renderPage(queryClient);

    expect(await screen.findByRole("alert")).toHaveTextContent("no data dir");
    expect(screen.queryByText("1 character")).not.toBeInTheDocument();
  });

  it("shows the empty state when the list resolves with no characters", async () => {
    stubFetch(new Response(JSON.stringify([]), { status: 200 }));
    renderPage();

    expect(await screen.findByText("No characters yet")).toBeInTheDocument();
    expect(screen.getByText("0 characters")).toBeInTheDocument();
    expect(screen.queryByText(/POST/)).not.toBeInTheDocument();
  });

  it("shows each character as a tile linking to its page, named first and chipped with its edition", async () => {
    stubFetch(
      new Response(
        JSON.stringify([
          characterRecord("1", "vex"),
          { ...characterRecord("2", "Nyx"), edition: "classic", raceSummary: "" },
        ]),
        { status: 200 },
      ),
    );
    renderPage();

    const links = await screen.findAllByRole("link");
    expect(links[0]).toHaveAttribute("href", "/characters/1");
    expect(links[0]).toHaveAccessibleName("vex Half-Elf Warlock • Lvl 1 2024");
    expect(links[1]).toHaveAttribute("href", "/characters/2");
    expect(links[1]).toHaveAccessibleName("Nyx Warlock • Lvl 1 2014");
    expect(links[0]?.querySelector("[aria-hidden]")).toHaveTextContent("V");
    expect(screen.getByText("2 characters")).toBeInTheDocument();
  });

  it("counts a lone character in the singular", async () => {
    stubFetch(new Response(JSON.stringify([characterRecord("1", "vex")]), { status: 200 }));
    renderPage();

    expect(await screen.findByText("1 character")).toBeInTheDocument();
  });
});
