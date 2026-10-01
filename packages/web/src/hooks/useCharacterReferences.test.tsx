import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stubFetch } from "../test/stubFetch.ts";
import { useCharacterReferences } from "./useCharacterReferences.ts";

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useCharacterReferences", () => {
  it("resolves the unresolved references the API reports for the character", async () => {
    const body = {
      unresolved: [
        {
          field: "feats[0].ref",
          kind: "feat",
          ref: { name: "Lucky", source: "PHB" },
          renamedTo: { name: "Lucky", source: "XPHB" },
        },
      ],
    };
    const fetchMock = stubFetch(new Response(JSON.stringify(body), { status: 200 }));

    const { result } = renderHook(() => useCharacterReferences("1"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(body);
    expect(fetchMock).toHaveBeenCalledWith("/api/characters/1/references", undefined);
  });

  it("reports a 404 without retrying it", async () => {
    const fetchMock = stubFetch(
      new Response(JSON.stringify({ error: "No character with that id" }), { status: 404 }),
    );

    const { result } = renderHook(() => useCharacterReferences("1"), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("No character with that id");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
