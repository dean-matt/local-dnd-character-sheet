import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { derivedRecord } from "../test/records.ts";
import { stubFetch } from "../test/stubFetch.ts";
import { useCharacterDerived } from "./useCharacterDerived.ts";

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useCharacterDerived", () => {
  it("resolves the derived block the API computes for the character", async () => {
    const fetchMock = stubFetch(new Response(JSON.stringify(derivedRecord()), { status: 200 }));

    const { result } = renderHook(() => useCharacterDerived("1"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(derivedRecord());
    expect(fetchMock).toHaveBeenCalledWith("/api/characters/1/derived", undefined);
  });

  it("reports a 4xx without retrying it", async () => {
    const fetchMock = stubFetch(
      new Response(JSON.stringify({ error: "No class Wizard (PHB)" }), { status: 422 }),
    );

    const { result } = renderHook(() => useCharacterDerived("1"), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("No class Wizard (PHB)");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
