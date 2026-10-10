import type { SearchHit } from "@dnd/catalog";
import type { CharacterDerived, CharacterRecord } from "@dnd/character";
import { QueryClient, QueryClientProvider, skipToken, useQuery } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterKey } from "../../../../hooks/characterKeys.ts";
import { characterRecord, derivedRecord } from "../../../../test/records.ts";
import { WeaponMasteryChoice } from "./WeaponMasteryChoice.tsx";

const LONGSWORD = { name: "Longsword", source: "XPHB" };
const MACE = { name: "Mace", source: "XPHB" };

const hit = (ref: { name: string; source: string }, mastery: boolean): SearchHit => ({
  type: "item",
  ...ref,
  edition: "one",
  item: { kinds: ["melee"], rarity: null, category: "martial", ...(mastery && { mastery: true }) },
});

const holding = (weaponMasteries: { name: string; source: string }[]): CharacterRecord => {
  const record = characterRecord("1", "Vex");
  return { ...record, definition: { ...record.definition, weaponMasteries } };
};

const allowing = (limit: number, manual: number | null = null): CharacterDerived => ({
  ...derivedRecord(),
  weaponMasteryLimit: { computed: limit, manual, terms: [] },
});

function Seeded({ derived }: { derived: CharacterDerived }) {
  const { data } = useQuery<CharacterRecord>({ queryKey: characterKey("1"), queryFn: skipToken });
  return data ? <WeaponMasteryChoice character={data} derived={derived} /> : null;
}

function renderSeeded(character: CharacterRecord, derived: CharacterDerived) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(characterKey("1"), character);
  return render(
    <QueryClientProvider client={client}>
      <Seeded derived={derived} />
    </QueryClientProvider>,
  );
}

/** Answers a search with `hits` and a character write with `saved`. */
function stubServer(hits: SearchHit[], saved: CharacterRecord) {
  const fetchMock = vi.fn(async (url: string, _init?: RequestInit) =>
    String(url).startsWith("/api/search")
      ? new Response(JSON.stringify({ items: hits, total: hits.length, limit: 20, offset: 0 }))
      : new Response(JSON.stringify(saved)),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const written = (fetchMock: ReturnType<typeof stubServer>) => {
  const init = fetchMock.mock.calls.find(([url]) => url === "/api/characters/1")?.[1];
  return init && JSON.parse(String(init.body)).weaponMasteries;
};

afterEach(() => vi.unstubAllGlobals());

describe("WeaponMasteryChoice", () => {
  it("shows nothing for a character whose classes allow none and who chose none", () => {
    const { container } = renderSeeded(holding([]), allowing(0));
    expect(container).toBeEmptyDOMElement();
  });

  it("counts the kinds chosen against the limit, and offers a pick while one is left", () => {
    renderSeeded(holding([LONGSWORD]), allowing(3));

    expect(screen.getByText("1 of 3 chosen")).toBeInTheDocument();
    expect(screen.getByText("Longsword")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Choose a weapon to master" })).toBeInTheDocument();
  });

  it("offers no pick at the limit, and reports a count past it without refusing it", () => {
    renderSeeded(holding([LONGSWORD, MACE]), allowing(1));

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Over the limit: remove 1");
  });

  it("reads the limit a player overrode", () => {
    renderSeeded(holding([LONGSWORD]), allowing(2, 1));
    expect(screen.getByText("1 of 1 chosen")).toBeInTheDocument();
  });

  it("saves a base weapon with a mastery, and refuses one without", async () => {
    const fetchMock = stubServer(
      [hit(LONGSWORD, true), hit({ name: "Net", source: "XPHB" }, false)],
      holding([LONGSWORD]),
    );
    renderSeeded(holding([]), allowing(2));

    fireEvent.focus(screen.getByRole("combobox", { name: "Choose a weapon to master" }));
    fireEvent.click(await screen.findByRole("option", { name: /Net/ }));
    expect(written(fetchMock)).toBeUndefined();
    expect(screen.getByRole("option", { name: /Net/ })).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(screen.getByRole("option", { name: /Longsword/ }));
    await waitFor(() => expect(written(fetchMock)).toEqual([LONGSWORD]));
  });

  it("removes a kind, which is how the choice changes", async () => {
    const fetchMock = stubServer([], holding([MACE]));
    renderSeeded(holding([LONGSWORD, MACE]), allowing(3));

    fireEvent.click(screen.getByRole("button", { name: "Remove Longsword" }));

    await waitFor(() => expect(written(fetchMock)).toEqual([MACE]));
  });

  it("says when a change did not save", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "disk full" }), { status: 500 })),
    );
    renderSeeded(holding([LONGSWORD]), allowing(3));

    fireEvent.click(screen.getByRole("button", { name: "Remove Longsword" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't save the weapon mastery");
  });
});
