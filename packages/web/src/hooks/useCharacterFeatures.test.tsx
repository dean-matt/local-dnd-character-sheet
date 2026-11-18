import type { CharacterDerived } from "@dnd/character";
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

    const { result } = renderHook(() => useCharacterFeatures("1", undefined), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(body);
    expect(fetchMock).toHaveBeenCalledWith("/api/characters/1/features", undefined);
  });

  it("folds in the uses the derived block counts, matching a class feature at its level", async () => {
    const surge = (level: number) => ({
      resolved: true,
      name: "Action Surge",
      source: "XPHB",
      level,
      entries: [],
    });
    const body = { groups: [{ origin: "class", features: [surge(2), surge(17)] }] };
    stubFetch(new Response(JSON.stringify(body), { status: 200 }));
    const uses = { key: "feature|Fighter|XPHB|||2|XPHB|Action Surge", count: 2, reset: "short" };
    const derived = {
      limitedUses: [{ feature: { name: "Action Surge", source: "XPHB" }, level: 2, ...uses }],
    } as unknown as CharacterDerived;

    const { result } = renderHook(() => useCharacterFeatures("1", derived), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.groups[0]?.features).toEqual([{ ...surge(2), uses }, surge(17)]);
  });

  it("reports a 404 without retrying it", async () => {
    const fetchMock = stubFetch(
      new Response(JSON.stringify({ error: "No character with that id" }), { status: 404 }),
    );

    const { result } = renderHook(() => useCharacterFeatures("1", undefined), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("No character with that id");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
