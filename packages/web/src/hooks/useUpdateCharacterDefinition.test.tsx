import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterRecord } from "../test/records.ts";
import { stubFetch } from "../test/stubFetch.ts";
import { characterKey, charactersKey } from "./characterKeys.ts";
import { useUpdateCharacterDefinition } from "./useUpdateCharacterDefinition.ts";

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useUpdateCharacterDefinition", () => {
  it("writes the response into the detail cache and invalidates the list on success", async () => {
    const updated = characterRecord("1", "Vex");
    stubFetch(new Response(JSON.stringify(updated), { status: 200 }));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(charactersKey, [characterRecord("1", "Vex")]);

    const { result } = renderHook(() => useUpdateCharacterDefinition("1"), {
      wrapper: wrapper(queryClient),
    });

    result.current.mutate(updated.definition);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(queryClient.getQueryData(characterKey("1"))).toEqual(updated);
    expect(queryClient.getQueryState(charactersKey)?.isInvalidated).toBe(true);
  });

  it("leaves the caches untouched and reports the error on a failed write", async () => {
    stubFetch(new Response(JSON.stringify({ error: "invalid definition" }), { status: 422 }));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const original = characterRecord("1", "Vex");
    queryClient.setQueryData(characterKey("1"), original);

    const { result } = renderHook(() => useUpdateCharacterDefinition("1"), {
      wrapper: wrapper(queryClient),
    });

    result.current.mutate(characterRecord("1", "Nyx").definition);
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe("invalid definition");
    expect(queryClient.getQueryData(characterKey("1"))).toEqual(original);
  });
});
