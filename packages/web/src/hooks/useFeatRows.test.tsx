import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useFeatRows } from "./useFeatRows.ts";

const CATALOG = [
  { name: "Alert", source: "XPHB", edition: "one", json: { name: "Alert", source: "XPHB" } },
];
const HOMEBREW = [
  {
    id: "hf-1",
    name: "Steady",
    edition: "one",
    json: { name: "Steady", source: "HB" },
    createdAt: "2026-10-28T00:00:00.000Z",
  },
];

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function stub(homebrew: () => Response) {
  vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith("/api/feats?"))
      return new Response(JSON.stringify({ items: CATALOG, total: 1 }));
    if (url === "/api/homebrew/feats") return homebrew();
    return new Response("[]");
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useFeatRows", () => {
  it("joins the catalog and homebrew feats once both load", async () => {
    stub(() => new Response(JSON.stringify(HOMEBREW)));
    const { result } = renderHook(() => useFeatRows("one"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.rows.map((row) => row.name)).toEqual(["Alert", "Steady"]);
  });

  it("keeps the catalog but is not a success when the homebrew read fails", async () => {
    const homebrewRead = vi.fn(
      () => new Response(JSON.stringify({ error: "down" }), { status: 500 }),
    );
    stub(homebrewRead);
    const { result } = renderHook(() => useFeatRows("one"), { wrapper });

    await waitFor(() => expect(result.current.rows.map((row) => row.name)).toEqual(["Alert"]));
    await waitFor(() => expect(homebrewRead).toHaveBeenCalled());
    await act(async () => {});
    expect(result.current.isSuccess).toBe(false);
  });
});
