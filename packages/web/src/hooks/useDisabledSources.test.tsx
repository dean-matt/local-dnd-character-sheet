import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SheetSourcesProvider } from "../components/SheetSourcesProvider.tsx";
import { setDisabledSources } from "../lib/disabledSources.ts";
import { identityRecord } from "../test/records.ts";
import { stubFetchByUrl } from "../test/stubFetch.ts";
import { charactersKey } from "./characterKeys.ts";
import { useDisabledSources } from "./useDisabledSources.ts";

const own = (excludedSources?: string[]) => {
  const record = identityRecord();
  return { ...record, definition: { ...record.definition, excludedSources } };
};

function render(path: string, characters: unknown[]) {
  stubFetchByUrl({ "/api/characters": characters });
  const client = new QueryClient();
  const hook = renderHook(() => useDisabledSources(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[path]}>
          <SheetSourcesProvider>{children}</SheetSourcesProvider>
        </MemoryRouter>
      </QueryClientProvider>
    ),
  });
  const loaded = () => waitFor(() => expect(client.getQueryData(charactersKey)).toBeDefined());
  return { ...hook, loaded };
}

afterEach(() => {
  vi.unstubAllGlobals();
  setDisabledSources([]);
});

describe("useDisabledSources", () => {
  it("adds the open sheet's own list to Settings'", async () => {
    setDisabledSources(["VGM"]);
    const { result } = render("/characters/1", [own(["SCAG"])]);

    await waitFor(() => expect(result.current).toEqual(["SCAG", "VGM"]));
  });

  it("follows Settings alone for a character with no list of its own", async () => {
    setDisabledSources(["VGM"]);
    const { result, loaded } = render("/characters/1", [own()]);

    await loaded();
    expect(result.current).toEqual(["VGM"]);
  });

  it("leaves a source Settings turned off off, however the character's list reads", async () => {
    setDisabledSources(["VGM"]);
    const { result } = render("/characters/1", [own(["VGM", "SCAG"])]);

    await waitFor(() => expect(result.current).toEqual(["SCAG", "VGM"]));
  });

  it("applies a character's list to a search opened from its sheet", async () => {
    const { result } = render("/search?for=1", [own(["SCAG"])]);

    await waitFor(() => expect(result.current).toEqual(["SCAG"]));
  });

  it("applies nothing outside a sheet", async () => {
    setDisabledSources(["VGM"]);
    const { result, loaded } = render("/search", [own(["SCAG"])]);

    await loaded();
    expect(result.current).toEqual(["VGM"]);
  });
});
