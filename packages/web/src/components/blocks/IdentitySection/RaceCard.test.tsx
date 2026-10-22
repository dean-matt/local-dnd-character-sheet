import type { CharacterRecord } from "@dnd/character";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterKey } from "../../../hooks/characterKeys.ts";
import { identityRecord } from "../../../test/records.ts";
import { RaceCard } from "./RaceCard.tsx";

const XPHB = (name: string) => ({ name, source: "XPHB" });
const page = (items: unknown[]) => ({ items, total: items.length, limit: 200, offset: 0 });
const subrace = (name: string, race: string, json: object = {}) => ({
  ...XPHB(name),
  raceName: race,
  raceSource: "XPHB",
  edition: "one",
  json: { ...XPHB(race), size: ["M"], speed: 30, ...json },
});

/**
 * Answers search with Dwarf and Elf, each race's subraces, `answer`'s reply where it gives
 * one, and a write with the record.
 */
function stubServer(saved: CharacterRecord, answer: (url: string) => unknown = () => undefined) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input);
    const answered = answer(url);
    if (answered !== undefined) return new Response(JSON.stringify(answered));
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

describe("RaceCard's open choices", () => {
  const granted = (blocks: string[]) => ({
    spells: [],
    blocks,
    picks: { cantrips: 0, spells: 0, learned: 0, alternatives: false },
  });
  /** Elf (High) whose merged row carries `json`, and the spells it grants offering `blocks`. */
  const highElf =
    (json: object, blocks: string[] = []) =>
    (url: string) => {
      if (url.startsWith("/api/races/Elf/XPHB/subraces"))
        return page([subrace("", "Elf"), subrace("High", "Elf", json)]);
      if (url.startsWith("/api/spells/granted")) return granted(blocks);
      return undefined;
    };

  it("saves the size and the resistance the race leaves open, prompting for each", async () => {
    const fetchMock = stubServer(
      identityRecord(),
      highElf({ size: ["S", "M"], resist: [{ choose: { from: ["fire", "cold"] } }] }),
    );
    renderCard(identityRecord());

    expect(await screen.findByRole("group", { name: "Size — choose one" })).toBeInTheDocument();
    const resistance = screen.getByRole("group", { name: "Damage resistance — choose one" });
    fireEvent.click(within(resistance).getByRole("button", { name: "Cold" }));

    await waitFor(() => expect(written(fetchMock)).not.toBeNull());
    expect(written(fetchMock).raceResistance).toBe("cold");
  });

  it("saves a size pick", async () => {
    const fetchMock = stubServer(identityRecord(), highElf({ size: ["S", "M"] }));
    renderCard(identityRecord());

    const size = await screen.findByRole("group", { name: /^Size/ });
    fireEvent.click(within(size).getByRole("button", { name: "Small" }));
    await waitFor(() => expect(written(fetchMock)?.size).toBe("small"));
  });

  it("names race increases that do not match the row and replaces them with the row's", async () => {
    const fetchMock = stubServer(identityRecord(), highElf({ ability: [{ dex: 2 }] }));
    const record = identityRecord();
    record.definition.abilityIncreases = [
      { ability: "str", amount: 2, grantedBy: "race" },
      { ability: "wis", amount: 1, grantedBy: "background" },
    ];
    renderCard(record);

    expect(
      await screen.findByText(
        /\+2 Strength is kept from before and does not match Elf \(High\)'s increases/,
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Apply Elf (High)'s increases" }));

    await waitFor(() => expect(written(fetchMock)).not.toBeNull());
    expect(written(fetchMock).abilityIncreases).toEqual([
      { ability: "wis", amount: 1, grantedBy: "background" },
      { ability: "dex", amount: 2, grantedBy: "race" },
    ]);
  });

  it("names a fixed increase the row grants that is not stored, and applies it", async () => {
    const fetchMock = stubServer(identityRecord(), highElf({ ability: [{ dex: 2 }] }));
    renderCard(identityRecord());

    expect(await screen.findByText("Elf (High)'s increases are not applied.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Apply Elf (High)'s increases" }));

    await waitFor(() => expect(written(fetchMock)).not.toBeNull());
    expect(written(fetchMock).abilityIncreases).toEqual([
      { ability: "dex", amount: 2, grantedBy: "race" },
    ]);
  });

  it("places an increase the row leaves to the player", async () => {
    const fetchMock = stubServer(
      identityRecord(),
      highElf({ ability: [{ choose: { from: ["int", "wis"] } }] }),
    );
    renderCard(identityRecord());

    const slot = await screen.findByRole("group", { name: /^Race \+1/ });
    fireEvent.click(within(slot).getByRole("button", { name: "Wisdom" }));

    await waitFor(() => expect(written(fetchMock)).not.toBeNull());
    expect(written(fetchMock).abilityIncreases).toEqual([
      { ability: "wis", amount: 1, grantedBy: "race" },
    ]);
  });

  it("chooses which of the subrace's spell blocks applies", async () => {
    const fetchMock = stubServer(identityRecord(), highElf({}, ["Drow", "High Elf"]));
    renderCard(identityRecord());

    const blocks = await screen.findByRole("group", { name: /High: which spells apply/ });
    fireEvent.click(within(blocks).getByRole("button", { name: "High Elf" }));

    await waitFor(() => expect(written(fetchMock)).not.toBeNull());
    expect(written(fetchMock).spellBlocks).toEqual([
      { grantor: { kind: "subrace", ref: XPHB("High"), race: XPHB("Elf") }, block: 1 },
    ]);
  });

  it("names a spell block kept from another race and removes it", async () => {
    const fetchMock = stubServer(identityRecord(), highElf({}));
    const record = identityRecord();
    record.definition.spellBlocks = [{ grantor: { kind: "race", ref: XPHB("Dwarf") }, block: 1 }];
    renderCard(record);

    expect(
      await screen.findByText(
        "The spell choice for Dwarf is kept from before and applies nothing.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove it" }));

    await waitFor(() => expect(written(fetchMock)).not.toBeNull());
    expect(written(fetchMock).spellBlocks).toEqual([]);
  });
});
