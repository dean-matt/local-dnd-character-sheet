import type { CharacterRecord } from "@dnd/character";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterKey } from "../../hooks/characterKeys.ts";
import { setDisabledSources } from "../../lib/disabledSources.ts";
import { identityRecord } from "../../test/records.ts";
import { type stubFetch, stubFetchByUrl } from "../../test/stubFetch.ts";
import { SourcesCard } from "./SourcesCard.tsx";

const withExcluded = (excludedSources?: string[]): CharacterRecord => {
  const record = identityRecord();
  return { ...record, definition: { ...record.definition, excludedSources } };
};

function renderCard(record: CharacterRecord) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  client.setQueryData(characterKey(record.id), record);
  render(
    <QueryClientProvider client={client}>
      <SourcesCard character={record} />
    </QueryClientProvider>,
  );
  return within(screen.getByRole("region", { name: "Sources" }));
}

const written = (fetchMock: ReturnType<typeof stubFetch>) => {
  const put = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
  return put && JSON.parse(String(put[1]?.body));
};

const sources = { "/api/search/sources": { sources: ["PHB", "XPHB", "SCAG"] } };

afterEach(() => {
  vi.unstubAllGlobals();
  setDisabledSources([]);
});

describe("SourcesCard", () => {
  it("reads a character with no list as following Settings", async () => {
    stubFetchByUrl(sources);
    const card = renderCard(withExcluded());

    expect(card.getByText("Following the sources turned on in Settings.")).toBeVisible();
    expect(await card.findByRole("switch", { name: /^PHB/ })).toBeChecked();
    expect(card.queryByRole("button", { name: "Follow Settings" })).toBeNull();
  });

  it("turns a source off for the character, storing the list beside the rest", async () => {
    const fetchMock = stubFetchByUrl(sources);
    const card = renderCard(withExcluded());

    fireEvent.click(await card.findByRole("switch", { name: /^SCAG/ }));

    await waitFor(() => expect(written(fetchMock)?.excludedSources).toEqual(["SCAG"]));
  });

  it("stores nothing once the last source is back on", async () => {
    const fetchMock = stubFetchByUrl(sources);
    const card = renderCard(withExcluded(["SCAG"]));

    fireEvent.click(await card.findByRole("switch", { name: /^SCAG/ }));

    await waitFor(() => expect(written(fetchMock)).toBeDefined());
    expect(written(fetchMock)).not.toHaveProperty("excludedSources");
  });

  it("locks a source Settings turned off, so the character cannot turn it back on", async () => {
    setDisabledSources(["PHB"]);
    const fetchMock = stubFetchByUrl(sources);
    const card = renderCard(withExcluded());
    const phb = await card.findByRole("switch", { name: /^PHB/ });

    fireEvent.click(phb);

    expect(phb).not.toBeChecked();
    expect(phb).toHaveAttribute("aria-disabled", "true");
    expect(card.getByText("Off in Settings")).toBeVisible();
    expect(written(fetchMock)).toBeUndefined();
  });

  it("returns to following Settings in one step", async () => {
    const fetchMock = stubFetchByUrl(sources);
    const card = renderCard(withExcluded(["SCAG", "XPHB"]));

    fireEvent.click(card.getByRole("button", { name: "Follow Settings" }));

    await waitFor(() => expect(written(fetchMock)).toBeDefined());
    expect(written(fetchMock)).not.toHaveProperty("excludedSources");
  });
});
