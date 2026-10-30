import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { creationForm } from "./creationForm.ts";
import { useIdentityDone } from "./useIdentityDone.ts";
import { useIncreaseOptions } from "./useIncreaseOptions.ts";
import { useToolTally } from "./useToolTally.ts";

const page = (items: unknown[]) => ({ items, total: items.length, limit: 200, offset: 0 });
const homebrew = (json: object) => ({
  id: "hb_1",
  name: "Stoneborn",
  edition: "classic",
  json: { name: "Stoneborn", source: "Homebrew", ...json },
  createdAt: "2026-01-01T00:00:00.000Z",
});

type Reply = { status: number; body: unknown };

function stub(races: Reply) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const { status, body } =
        url === "/api/homebrew/races"
          ? races
          : url.startsWith("/api/backgrounds?") || url.startsWith("/api/search?")
            ? { status: 200, body: page([]) }
            : { status: 404, body: { error: url } };
      return new Response(JSON.stringify(body), { status });
    }),
  );
}

function draft(values: object) {
  localStorage.setItem(
    "draft:creation",
    JSON.stringify({ edition: "classic", race: { homebrewId: "hb_1" }, ...values }),
  );
}

let client: QueryClient;

async function settled() {
  await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/homebrew/races", undefined));
  await waitFor(() => expect(client.isFetching()).toBe(0));
}

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={client}>
      <creationForm.FormShell onSubmit={() => {}}>{() => children}</creationForm.FormShell>
    </QueryClientProvider>
  );
}

describe("a homebrew race in creation", () => {
  beforeEach(() => {
    localStorage.clear();
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("grants the tools its row names", async () => {
    stub({
      status: 200,
      body: [homebrew({ toolProficiencies: [{ "thieves' tools": true }] })],
    });
    draft({});

    const { result } = renderHook(() => useToolTally(), { wrapper });

    await waitFor(() =>
      expect(result.current?.granted).toEqual([{ name: "Thieves' Tools", by: "Race" }]),
    );
  });

  it("offers the increases its row names, under its own name", async () => {
    stub({
      status: 200,
      body: [homebrew({ ability: [{ choose: { from: ["int", "wis"], count: 1 } }] })],
    });
    draft({});

    const { result } = renderHook(() => useIncreaseOptions(), { wrapper });

    await waitFor(() => expect(result.current).toBeDefined());
    const race = result.current?.find((source) => source.grantedBy === "race");
    expect(race?.name).toBe("Stoneborn");
    expect(race?.alternatives).toHaveLength(1);
  });

  it("offers no increases while the homebrew list has not loaded, or failed", async () => {
    stub({ status: 500, body: { error: "down" } });
    draft({});

    const { result } = renderHook(() => useIncreaseOptions(), { wrapper });

    await settled();
    expect(result.current).toBeUndefined();
  });

  describe("identity", () => {
    const named = { name: "Ada", background: { name: "Sage", source: "PHB" } };
    const sized = homebrew({
      size: ["S", "M"],
      speed: 30,
      resist: [{ choose: { from: ["cold", "fire"] } }],
    });

    it("is done once the size and resistance its row offers are picked", async () => {
      stub({ status: 200, body: [sized] });
      draft({ ...named, size: "medium", raceResistance: "fire" });

      const { result } = renderHook(() => useIdentityDone(), { wrapper });

      await waitFor(() => expect(result.current).toBe(true));
    });

    it.each([{ size: "medium" }, { size: "large", raceResistance: "fire" }])(
      "is held by a pick its row offers left open: %j",
      async (picked) => {
        stub({ status: 200, body: [sized] });
        draft({ ...named, ...picked });

        const { result } = renderHook(() => useIdentityDone(), { wrapper });

        await settled();
        expect(result.current).toBe(false);
      },
    );

    it("is held while the row has not loaded", () => {
      stub({ status: 200, body: [sized] });
      draft({ ...named, size: "medium", raceResistance: "fire" });

      const { result } = renderHook(() => useIdentityDone(), { wrapper });

      expect(result.current).toBe(false);
    });

    it("is held by a failed fetch", async () => {
      stub({ status: 500, body: { error: "down" } });
      draft({ ...named, size: "medium", raceResistance: "fire" });

      const { result } = renderHook(() => useIdentityDone(), { wrapper });

      await settled();
      expect(result.current).toBe(false);
    });
  });
});
