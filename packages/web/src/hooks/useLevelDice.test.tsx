import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stubFetchByUrl } from "../test/stubFetch.ts";
import { useLevelDice } from "./useLevelDice.ts";

const WARDEN = {
  id: "hb_warden",
  name: "Warden",
  edition: "one",
  hitDie: 10,
  json: { name: "Warden", source: "HB", hd: { number: 1, faces: 10 } },
  createdAt: "2026-01-01T00:00:00.000Z",
};

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

afterEach(() => vi.unstubAllGlobals());

describe("useLevelDice", () => {
  it("reads a homebrew class cited by name and source off its homebrew row, not the catalog", async () => {
    const fetchMock = stubFetchByUrl({
      "/api/homebrew/classes": [WARDEN],
      "/api/homebrew/classes/hb_warden": { ...WARDEN, resources: [] },
    });
    const warden = { class: { name: "Warden", source: "HB" } };
    const { result } = renderHook(() => useLevelDice([warden, warden], "one"), { wrapper });

    await waitFor(() => expect(result.current).toEqual([10, 10]));
    expect(fetchMock.mock.calls.map(([url]) => String(url))).not.toContain(
      "/api/classes/Warden/HB",
    );
  });
});
