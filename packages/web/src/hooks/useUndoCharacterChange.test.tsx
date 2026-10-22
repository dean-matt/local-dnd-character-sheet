import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterRecord } from "../test/records.ts";
import { stubFetch } from "../test/stubFetch.ts";
import { characterKey, characterUndoKey } from "./characterKeys.ts";
import { useUndoCharacterChange } from "./useUndoCharacterChange.ts";

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useUndoCharacterChange", () => {
  it("writes the restored character into the cache and drops the undone entry at once", async () => {
    const restored = characterRecord("1", "Vex");
    const fetchMock = stubFetch(new Response(JSON.stringify(restored), { status: 200 }));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const entry = (id: number) => ({
      id,
      describedAs: `Change ${id}`,
      changedAt: "2026-01-01T00:00:00.000Z",
    });
    queryClient.setQueryData(characterUndoKey("1"), [entry(2), entry(1)]);

    const { result } = renderHook(() => useUndoCharacterChange("1"), {
      wrapper: wrapper(queryClient),
    });

    result.current.mutate();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/characters/1/undo",
      expect.objectContaining({ method: "POST" }),
    );
    expect(queryClient.getQueryData(characterKey("1"))).toEqual(restored);
    expect(queryClient.getQueryData(characterUndoKey("1"))).toEqual([entry(1)]);
    expect(queryClient.getQueryState(characterUndoKey("1"))?.isInvalidated).toBe(true);
  });

  it("drops every entry back to the target, and sends what the caller last read", async () => {
    const restored = characterRecord("1", "Vex");
    const fetchMock = stubFetch(new Response(JSON.stringify(restored), { status: 200 }));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const entry = (id: number) => ({ id, describedAs: `Change ${id}` });
    queryClient.setQueryData(characterUndoKey("1"), [entry(3), entry(2), entry(1)]);

    const { result } = renderHook(() => useUndoCharacterChange("1"), {
      wrapper: wrapper(queryClient),
    });

    const readAt = "2026-01-01T00:00:00.000Z";
    result.current.mutate({ to: 2, newest: 3, readAt });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ to: 2, newest: 3 });
    expect(new Headers(init.headers).get("If-Unmodified-Since")).toBe(
      new Date(readAt).toUTCString(),
    );
    expect(queryClient.getQueryData(characterUndoKey("1"))).toEqual([entry(1)]);
  });

  it("refetches the character and its undo log on a failure, since either may have moved on", async () => {
    stubFetch(new Response(JSON.stringify({ error: "Cannot restore" }), { status: 422 }));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(characterUndoKey("1"), []);
    queryClient.setQueryData(characterKey("1"), characterRecord("1", "Vex"));

    const { result } = renderHook(() => useUndoCharacterChange("1"), {
      wrapper: wrapper(queryClient),
    });

    result.current.mutate();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(queryClient.getQueryState(characterUndoKey("1"))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(characterKey("1"))?.isInvalidated).toBe(true);
  });
});
