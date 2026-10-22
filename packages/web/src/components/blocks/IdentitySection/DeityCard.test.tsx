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

/** Answers search with Oghma of two pantheons, and a write with the record. */
function stubServer() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) =>
    String(input).startsWith("/api/search")
      ? new Response(
          JSON.stringify({
            items: [oghma("Celtic"), oghma("Forgotten Realms")],
            total: 2,
            limit: 20,
            offset: 0,
          }),
        )
      : new Response(JSON.stringify(identityRecord())),
  );
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
  render(
    <QueryClientProvider client={client}>
      <DeityCard character={character} />
    </QueryClientProvider>,
  );
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

    await waitFor(() => expect(written(fetchMock)).not.toBeNull());
    const { deity: _cleared, ...rest } = record.definition;
    expect(written(fetchMock)).toEqual(rest);
  });

  it("offers no clear button where no deity is held", () => {
    stubServer();
    renderCard(identityRecord());
    expect(screen.queryByRole("button", { name: /Clear deity/ })).toBeNull();
  });
});
