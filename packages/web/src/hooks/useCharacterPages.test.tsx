import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { presetPageRecords } from "../test/records.ts";
import { stubFetch } from "../test/stubFetch.ts";
import { useCharacterPages } from "./useCharacterPages.ts";

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useCharacterPages", () => {
  it("resolves the character's pages the API returns, in order", async () => {
    const fetchMock = stubFetch(new Response(JSON.stringify(presetPageRecords()), { status: 200 }));

    const { result } = renderHook(() => useCharacterPages("1"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(presetPageRecords());
    expect(fetchMock).toHaveBeenCalledWith("/api/characters/1/pages", undefined);
  });
});
