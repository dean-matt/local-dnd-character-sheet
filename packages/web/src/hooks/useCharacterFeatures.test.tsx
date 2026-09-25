import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stubFetch } from "../test/stubFetch.ts";
import { useCharacterFeatures } from "./useCharacterFeatures.ts";

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useCharacterFeatures", () => {
  it("resolves the features the API lists for the character", async () => {
    const body = {
      groups: [{ origin: "feat", features: [{ resolved: false, name: "Lucky", source: "PHB" }] }],
    };
    const fetchMock = stubFetch(new Response(JSON.stringify(body), { status: 200 }));

    const { result } = renderHook(() => useCharacterFeatures("1"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(body);
    expect(fetchMock).toHaveBeenCalledWith("/api/characters/1/features", undefined);
  });

  it("reports a 404 without retrying it", async () => {
    const fetchMock = stubFetch(
      new Response(JSON.stringify({ error: "No character with that id" }), { status: 404 }),
    );

    const { result } = renderHook(() => useCharacterFeatures("1"), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("No character with that id");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
