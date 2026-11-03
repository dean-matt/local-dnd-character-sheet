import type { CharacterRecord } from "@dnd/character";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterKey } from "../../../hooks/characterKeys.ts";
import { identityRecord } from "../../../test/records.ts";
import { DeityCard } from "./DeityCard.tsx";

const oghma = (qualifier: string) => ({
  type: "deity",
  name: "Oghma",
  source: "PHB",
  edition: "classic",
  qualifier,
});

const homebrewOghma = (id: string, qualifier: string) => ({
  type: "deity",
  id,
  name: "Oghma",
  edition: null,
  qualifier,
});

const deityRecord = (id: string, pantheon: string) => ({
  id,
  name: "Oghma",
  pantheon,
  json: { name: "Oghma", source: "HB", pantheon },
  createdAt: "2026-01-01T00:00:00.000Z",
});

/**
 * Answers search with Oghma of two catalog pantheons and two homebrew ones, the homebrew
 * list with `homebrew`, and a write with the record.
 */
function stubServer(homebrew = [deityRecord("hb-1", "Starfall"), deityRecord("hb-2", "Duskmere")]) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith("/api/search")) {
      return new Response(
        JSON.stringify({
          items: [
            oghma("Celtic"),
            oghma("Forgotten Realms"),
            homebrewOghma("hb-1", "Starfall"),
            homebrewOghma("hb-2", "Duskmere"),
          ],
          total: 4,
          limit: 20,
          offset: 0,
        }),
      );
    }
    if (url === "/api/homebrew/deities") return new Response(JSON.stringify(homebrew));
    return new Response(JSON.stringify(identityRecord()));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const written = (fetchMock: ReturnType<typeof stubServer>) =>
  JSON.parse(
    String(fetchMock.mock.calls.find(([, init]) => init?.method === "PUT")?.[1]?.body ?? "null"),
  );

function renderCard(character: CharacterRecord) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  client.setQueryData(characterKey(character.id), character);
  const tree = (shown: CharacterRecord) => (
    <QueryClientProvider client={client}>
      <DeityCard character={shown} />
    </QueryClientProvider>
  );
  const { rerender } = render(tree(character));
  return { client, rerender: (shown: CharacterRecord) => rerender(tree(shown)) };
}

afterEach(() => vi.unstubAllGlobals());

describe("DeityCard", () => {
  it("saves a picked deity with its pantheon", async () => {
    const fetchMock = stubServer();
    renderCard(identityRecord());

    fireEvent.click(screen.getByRole("button", { name: "Change deity, None" }));
    fireEvent.click(await screen.findByRole("option", { name: /Oghma · Celtic/ }));

    await waitFor(() => expect(written(fetchMock)).not.toBeNull());
    expect(written(fetchMock).deity).toEqual({ name: "Oghma", source: "PHB", pantheon: "Celtic" });
  });

  it("clears a held deity, leaving the rest of the definition", async () => {
    const fetchMock = stubServer();
    const record = identityRecord();
    record.definition.deity = { name: "Oghma", source: "PHB", pantheon: "Celtic" };
    renderCard(record);

    fireEvent.click(screen.getByRole("button", { name: "Clear deity, Oghma · Celtic" }));
    expect(screen.getByRole("button", { name: "Change deity, Oghma · Celtic" })).toHaveFocus();

    await waitFor(() => expect(written(fetchMock)).not.toBeNull());
    const { deity: _cleared, ...rest } = record.definition;
    expect(written(fetchMock)).toEqual(rest);
  });

  it("moves focus to Change once a pick made in place is cleared", async () => {
    stubServer();
    const record = identityRecord();
    const { rerender } = renderCard(record);

    fireEvent.click(screen.getByRole("button", { name: "Change deity, None" }));
    fireEvent.click(await screen.findByRole("option", { name: /Oghma · Celtic/ }));
    const held = {
      ...record,
      definition: {
        ...record.definition,
        deity: { name: "Oghma", source: "PHB", pantheon: "Celtic" },
      },
    };
    rerender(held);
    fireEvent.click(screen.getByRole("button", { name: "Clear deity, Oghma · Celtic" }));

    expect(screen.getByRole("button", { name: /Change deity/ })).toHaveFocus();
  });

  it("lists homebrew deities beside the catalog's, each told apart by its pantheon", async () => {
    stubServer();
    renderCard(identityRecord());

    fireEvent.click(screen.getByRole("button", { name: "Change deity, None" }));
    const options = await screen.findAllByRole("option", { name: /^Oghma · / });
    expect(options.map((option) => option.textContent)).toEqual([
      expect.stringMatching(/^Oghma · Celtic/),
      expect.stringMatching(/^Oghma · Forgotten Realms/),
      expect.stringMatching(/^Oghma · StarfallHomebrew/),
      expect.stringMatching(/^Oghma · DuskmereHomebrew/),
    ]);
    for (const option of options) expect(option).not.toHaveAttribute("aria-disabled");
  });

  it.each([
    ["Starfall", "hb-1"],
    ["Duskmere", "hb-2"],
  ])("saves the homebrew deity of %s by name, HB and pantheon", async (pantheon) => {
    const fetchMock = stubServer();
    renderCard(identityRecord());

    fireEvent.click(screen.getByRole("button", { name: "Change deity, None" }));
    fireEvent.click(await screen.findByRole("option", { name: new RegExp(`Oghma · ${pantheon}`) }));

    await waitFor(() => expect(written(fetchMock)).not.toBeNull());
    expect(written(fetchMock).deity).toEqual({ name: "Oghma", source: "HB", pantheon });
  });

  it("shows a held homebrew deity with its pantheon, and no not-found tag while it exists", async () => {
    stubServer();
    const record = identityRecord();
    record.definition.deity = { name: "oghma", source: "HB", pantheon: "starfall" };
    const { client } = renderCard(record);

    expect(screen.getByRole("button", { name: "Change deity, oghma · starfall" })).toBeVisible();
    await waitFor(() =>
      expect(client.getQueryState(["homebrew", "deities"])?.status).toBe("success"),
    );
    expect(screen.queryByText("Not found in homebrew")).toBeNull();
  });

  it("tags a held homebrew deity the homebrew list lacks as not found", async () => {
    stubServer([deityRecord("hb-2", "Duskmere")]);
    const record = identityRecord();
    record.definition.deity = { name: "Oghma", source: "HB", pantheon: "Starfall" };
    renderCard(record);

    expect(await screen.findByText("Not found in homebrew")).toBeVisible();
  });

  it("never reads the homebrew list for a catalog deity", () => {
    const fetchMock = stubServer();
    const record = identityRecord();
    record.definition.deity = { name: "Oghma", source: "PHB", pantheon: "Celtic" };
    renderCard(record);

    expect(fetchMock.mock.calls.some(([url]) => url === "/api/homebrew/deities")).toBe(false);
  });

  it("offers no clear button where no deity is held", () => {
    stubServer();
    renderCard(identityRecord());
    expect(screen.queryByRole("button", { name: /Clear deity/ })).toBeNull();
  });
});
