import type { CharacterRecord } from "@dnd/character";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterKey } from "../../../hooks/characterKeys.ts";
import { identityRecord } from "../../../test/records.ts";
import { BackgroundCard } from "./BackgroundCard.tsx";

const charlatan = {
  name: "Charlatan",
  source: "XPHB",
  edition: "one",
  json: {
    name: "Charlatan",
    source: "XPHB",
    ability: [
      { choose: { weighted: { from: ["dex", "con", "cha"], weights: [2, 1] } } },
      { choose: { weighted: { from: ["dex", "con", "cha"], weights: [1, 1, 1] } } },
    ],
  },
};

/** Renders the card over a server that holds Charlatan and answers a write with `record`. */
function renderWithCharlatan(record: CharacterRecord) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) =>
    String(input).startsWith("/api/backgrounds")
      ? new Response(JSON.stringify({ items: [charlatan], total: 1, limit: 200, offset: 0 }))
      : new Response(JSON.stringify(record)),
  );
  vi.stubGlobal("fetch", fetchMock);
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  client.setQueryData(characterKey(record.id), record);
  render(
    <QueryClientProvider client={client}>
      <BackgroundCard character={record} />
    </QueryClientProvider>,
  );
  return () => {
    const put = fetchMock.mock.calls.find(([url]) => url === "/api/characters/1");
    return put ? JSON.parse(String(put[1]?.body)) : null;
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("BackgroundCard", () => {
  it("saves a picked background as a reference and leaves the rest of the definition", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) =>
      String(input).startsWith("/api/search")
        ? new Response(
            JSON.stringify({
              items: [{ type: "background", name: "Sage", source: "XPHB", edition: "one" }],
              total: 1,
              limit: 20,
              offset: 0,
            }),
          )
        : new Response(JSON.stringify(identityRecord())),
    );
    vi.stubGlobal("fetch", fetchMock);
    const record = identityRecord();
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    client.setQueryData(characterKey(record.id), record);
    render(
      <QueryClientProvider client={client}>
        <BackgroundCard character={record} />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Change background, Charlatan" }));
    fireEvent.click(await screen.findByRole("option", { name: /Sage/ }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/characters/1", expect.anything()),
    );
    const put = fetchMock.mock.calls.find(([url]) => url === "/api/characters/1");
    expect(JSON.parse(String(put?.[1]?.body))).toEqual({
      ...record.definition,
      background: { name: "Sage", source: "XPHB" },
    });
  });

  it("places the background's increases", async () => {
    const written = renderWithCharlatan(identityRecord());

    const slot = await screen.findByRole("group", { name: /^Background \+2/ });
    fireEvent.click(within(slot).getByRole("button", { name: "Charisma" }));

    await waitFor(() => expect(written()).not.toBeNull());
    expect(written().abilityIncreases).toEqual([
      { ability: "cha", amount: 2, grantedBy: "background" },
    ]);
  });

  it("names background increases that do not match the row and removes them", async () => {
    const record = identityRecord();
    record.definition.abilityIncreases = [
      { ability: "str", amount: 2, grantedBy: "background" },
      { ability: "dex", amount: 2, grantedBy: "race" },
    ];
    const written = renderWithCharlatan(record);

    expect(
      await screen.findByText(/\+2 Strength is kept from before and does not match Charlatan's/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove it" }));

    await waitFor(() => expect(written()).not.toBeNull());
    expect(written().abilityIncreases).toEqual([{ ability: "dex", amount: 2, grantedBy: "race" }]);
  });
});
