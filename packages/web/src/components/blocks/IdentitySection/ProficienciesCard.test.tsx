import type { CharacterRecord } from "@dnd/character";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterKey } from "../../../hooks/characterKeys.ts";
import { identityRecord } from "../../../test/records.ts";
import { ProficienciesCard } from "./ProficienciesCard.tsx";

const item = (name: string) => ({ type: "item", name, source: "XPHB", edition: "one" });

/** Answers a weapon search with Longsword, a tool search with two tools, and a write with the record. */
function stubServer() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input);
    if (!url.startsWith("/api/search")) return new Response(JSON.stringify(identityRecord()));
    const items = url.includes("kind=tool")
      ? [item("Thieves' Tools"), item("Dice Set")]
      : [item("Longsword")];
    return new Response(JSON.stringify({ items, total: items.length, limit: 20, offset: 0 }));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const written = (fetchMock: ReturnType<typeof stubServer>) => {
  const put = fetchMock.mock.calls.find(([url]) => url === "/api/characters/1");
  return put && JSON.parse(String(put[1]?.body)).proficiencies;
};

function renderCard(record: CharacterRecord = identityRecord()) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  client.setQueryData(characterKey(record.id), record);
  render(
    <QueryClientProvider client={client}>
      <ProficienciesCard character={record} />
    </QueryClientProvider>,
  );
  return screen.getByRole("region", { name: "Proficiencies" });
}

afterEach(() => vi.unstubAllGlobals());

describe("ProficienciesCard", () => {
  it("adds an armor category from those not yet held", async () => {
    const fetchMock = stubServer();
    renderCard();

    fireEvent.click(screen.getByRole("combobox", { name: "Add armor" }));
    expect(screen.queryByRole("option", { name: "Light" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: "Heavy" }));

    await waitFor(() => expect(written(fetchMock)).toBeDefined());
    expect(written(fetchMock).armor).toEqual(["Light", "Shield", "Heavy"]);
  });

  it("adds a single weapon through the picker", async () => {
    const fetchMock = stubServer();
    renderCard();

    fireEvent.focus(screen.getByRole("combobox", { name: "Add a weapon" }));
    fireEvent.click(await screen.findByRole("option", { name: /Longsword/ }));

    await waitFor(() => expect(written(fetchMock)).toBeDefined());
    expect(written(fetchMock).weapons).toEqual(["Simple", "Light", "Longsword"]);
  });

  it("removes the weapon × names, leaving the armor category that shares its name", async () => {
    const fetchMock = stubServer();
    const card = renderCard();

    fireEvent.click(within(card).getByRole("button", { name: "Remove Light (weapons)" }));

    await waitFor(() => expect(written(fetchMock)).toBeDefined());
    expect(written(fetchMock).weapons).toEqual(["Simple"]);
    expect(written(fetchMock).armor).toEqual(["Light", "Shield"]);
  });

  it("raises a tool held at none to proficient, and refuses one already proficient", async () => {
    const fetchMock = stubServer();
    renderCard();

    fireEvent.focus(screen.getByRole("combobox", { name: "Add a tool" }));
    expect(await screen.findByRole("option", { name: /Thieves' Tools/ })).toHaveTextContent(
      "Already proficient",
    );
    fireEvent.click(screen.getByRole("option", { name: /Dice Set/ }));

    await waitFor(() => expect(written(fetchMock)).toBeDefined());
    expect(written(fetchMock).tools).toEqual([
      { name: "Thieves' Tools", level: "expertise" },
      { name: "Herbalism Kit", level: "proficient" },
      { name: "Dice Set", level: "proficient" },
    ]);
  });

  it("removes a tool with ×, whatever its level", async () => {
    const fetchMock = stubServer();
    const card = renderCard();

    fireEvent.click(within(card).getByRole("button", { name: "Remove Thieves' Tools" }));

    await waitFor(() => expect(written(fetchMock)).toBeDefined());
    expect(written(fetchMock).tools.map((tool: { name: string }) => tool.name)).toEqual([
      "Herbalism Kit",
      "Dice Set",
    ]);
  });
});
