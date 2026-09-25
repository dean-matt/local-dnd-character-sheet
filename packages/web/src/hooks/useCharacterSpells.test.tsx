import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stubFetch } from "../test/stubFetch.ts";
import { useCharacterSpells } from "./useCharacterSpells.ts";

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useCharacterSpells", () => {
  it("resolves the spells the API lists for the character", async () => {
    const body = { spells: [{ resolved: false, name: "Shield", source: "PHB", prepared: true }] };
    const fetchMock = stubFetch(new Response(JSON.stringify(body), { status: 200 }));

    const { result } = renderHook(() => useCharacterSpells("1"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(body);
    expect(fetchMock).toHaveBeenCalledWith("/api/characters/1/spells", undefined);
  });

  it("reports a 404 without retrying it", async () => {
    const fetchMock = stubFetch(
      new Response(JSON.stringify({ error: "No character with that id" }), { status: 404 }),
    );

    const { result } = renderHook(() => useCharacterSpells("1"), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
