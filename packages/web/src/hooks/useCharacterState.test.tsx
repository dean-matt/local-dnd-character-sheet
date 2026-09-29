import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stateRecord } from "../test/records.ts";
import { stubFetch } from "../test/stubFetch.ts";
import { useCharacterState } from "./useCharacterState.ts";

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useCharacterState", () => {
  it("resolves the state the API stores for the character", async () => {
    const fetchMock = stubFetch(new Response(JSON.stringify(stateRecord()), { status: 200 }));

    const { result } = renderHook(() => useCharacterState("1"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(stateRecord());
    expect(fetchMock).toHaveBeenCalledWith("/api/characters/1/state", undefined);
  });

  it("reports a 404 without retrying it", async () => {
    const fetchMock = stubFetch(
      new Response(JSON.stringify({ error: "Character not found" }), { status: 404 }),
    );

    const { result } = renderHook(() => useCharacterState("1"), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Character not found");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
