import type { CharacterDefinition } from "@dnd/character";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stubFetchByUrl } from "../../test/stubFetch.ts";
import { creationForm } from "./creationForm.ts";
import { useClassEntries } from "./useClassEntries.ts";

const WARDEN = {
  id: "hb-warden",
  name: "Warden",
  edition: "classic",
  hitDie: 10,
  json: { name: "Warden", source: "HB", hd: { number: 1, faces: 10 } },
  createdAt: "2026-10-06T00:00:00.000Z",
};

const NO_SUBCLASSES = { items: [], total: 0 };

function entriesFor(levels: CharacterDefinition["levels"]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <creationForm.FormShell
        onSubmit={() => {}}
        defaultValues={{ name: "", edition: "classic", levels, inventory: [], spells: [] }}
      >
        {() => children}
      </creationForm.FormShell>
    </QueryClientProvider>
  );
  return renderHook(() => useClassEntries().entries, { wrapper }).result;
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe("useClassEntries", () => {
  it("reads a homebrew class cited by name and source off its homebrew row", async () => {
    const fetchMock = stubFetchByUrl({
      "/api/homebrew/classes": [WARDEN],
      "/api/homebrew/classes/hb-warden": { ...WARDEN, resources: [] },
      "/api/classes/Warden/HB/subclasses?edition=classic&limit=200": NO_SUBCLASSES,
    });
    const entries = entriesFor([{ class: { name: "Warden", source: "HB" } }]);

    await waitFor(() => expect(entries.current[0]).toMatchObject({ read: true, hitDie: 10 }));
    expect(entries.current[0]).toMatchObject({ catalogClass: undefined, name: "Warden" });
    expect(fetchMock.mock.calls.map(([url]) => String(url))).not.toContain(
      "/api/classes/Warden/HB",
    );
  });

  it("fails a class cited by a name no homebrew class holds", async () => {
    stubFetchByUrl({
      "/api/homebrew/classes": [WARDEN],
      "/api/classes/Nobody/HB/subclasses?edition=classic&limit=200": NO_SUBCLASSES,
    });
    const entries = entriesFor([{ class: { name: "Nobody", source: "HB" } }]);

    await waitFor(() => expect(entries.current[0]?.failed).toBe(true));
    expect(entries.current[0]?.read).toBe(false);
  });
});
