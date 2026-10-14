import type { CharacterRecord } from "@dnd/character";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterKey } from "../../../hooks/characterKeys.ts";
import { identityRecord } from "../../../test/records.ts";
import { RaceCard } from "./RaceCard.tsx";

const XPHB = (name: string) => ({ name, source: "XPHB" });
const page = (items: unknown[]) => ({ items, total: items.length, limit: 200, offset: 0 });
const subrace = (name: string, race: string) => ({
  ...XPHB(name),
  raceName: race,
  raceSource: "XPHB",
  edition: "one",
  json: { ...XPHB(race), size: ["M"], speed: 30 },
});

/** Answers search with Dwarf and Elf, each race's subraces, and a write with the record. */
function stubServer(saved: CharacterRecord) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith("/api/search")) {
      const items = ["Dwarf", "Elf"].map((name) => ({
        type: "race",
        ...XPHB(name),
        edition: "one",
      }));
      return new Response(JSON.stringify({ items, total: 2, limit: 20, offset: 0 }));
    }
    if (url.startsWith("/api/races/Elf/XPHB/subraces")) {
      return new Response(
        JSON.stringify(page([subrace("", "Elf"), subrace("High", "Elf"), subrace("Wood", "Elf")])),
      );
    }
    if (url.startsWith("/api/races/")) return new Response(JSON.stringify(page([])));
    return new Response(JSON.stringify(saved));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** The definition the one write sent. */
const written = (fetchMock: ReturnType<typeof stubServer>) =>
  JSON.parse(
    String(fetchMock.mock.calls.find(([, init]) => init?.method === "PUT")?.[1]?.body ?? "null"),
  );

function renderCard(character: CharacterRecord) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(characterKey(character.id), character);
  render(
    <QueryClientProvider client={client}>
      <RaceCard character={character} />
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("RaceCard", () => {
  it("swaps the race for the picker and back on Cancel, saving nothing", () => {
    const fetchMock = stubServer(identityRecord());
    renderCard(identityRecord());

    fireEvent.click(screen.getByRole("button", { name: "Change race, Elf (High)" }));
    expect(screen.getByRole("combobox", { name: "Choose a race" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("button", { name: "Change race, Elf (High)" })).toHaveFocus();
    expect(written(fetchMock)).toBeNull();
  });

  it("saves a picked race as a reference, dropping the subrace and a typed race's note", async () => {
    const fetchMock = stubServer(identityRecord());
    const record = identityRecord();
    record.definition.departures = [
      { field: "race", note: "Elf is not a race the catalog holds." },
      { field: "abilityScores.str", note: "Rolled twice." },
    ];
    renderCard(record);

    fireEvent.click(screen.getByRole("button", { name: "Change race, Elf (High)" }));
    fireEvent.click(await screen.findByRole("option", { name: /Dwarf/ }));

    await waitFor(() => expect(written(fetchMock)).not.toBeNull());
    const body = written(fetchMock);
    expect(body.race).toEqual(XPHB("Dwarf"));
    expect(body).not.toHaveProperty("subrace");
    expect(body.departures).toEqual([{ field: "abilityScores.str", note: "Rolled twice." }]);
    expect(body.proficiencies).toEqual(record.definition.proficiencies);
  });

  it("offers the race's subraces, None among them where the race is taken plain", async () => {
    const fetchMock = stubServer(identityRecord());
    renderCard(identityRecord());

    const select = await screen.findByRole("combobox", { name: "Subrace" });
    expect(select).toHaveTextContent("High");
    fireEvent.click(select);
    expect(screen.getByRole("option", { name: "None" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: "Wood" }));

    await waitFor(() => expect(written(fetchMock)).not.toBeNull());
    expect(written(fetchMock).subrace).toEqual(XPHB("Wood"));
  });
});
