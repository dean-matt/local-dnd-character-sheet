import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stubFetch } from "../test/stubFetch.ts";
import { useCharacterUndoLog } from "./useCharacterUndoLog.ts";

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useCharacterUndoLog", () => {
  it("resolves the entries the API lists for the character", async () => {
    const entries = [
      { id: 2, describedAs: "Charisma 17 to 18", changedAt: "2026-01-01T00:00:00.000Z" },
    ];
    const fetchMock = stubFetch(new Response(JSON.stringify(entries), { status: 200 }));

    const { result } = renderHook(() => useCharacterUndoLog("1"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(entries);
    expect(fetchMock).toHaveBeenCalledWith("/api/characters/1/undo", undefined);
  });
});
