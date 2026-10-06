import type { CharacterDefinition } from "@dnd/character";
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
    const updated = characterRecord("1", "Nyx");
    const fetchMock = stubFetch(new Response(JSON.stringify(updated), { status: 200 }));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(characterKey("1"), characterRecord("1", "Vex"));
    queryClient.setQueryData(charactersKey, [characterRecord("1", "Vex")]);

    const { result } = renderHook(() => useUpdateCharacterDefinition("1"), {
      wrapper: wrapper(queryClient),
    });

    result.current.mutate((definition) => ({ ...definition, name: "Nyx" }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body).name).toBe("Nyx");
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

    result.current.mutate((definition) => ({ ...definition, name: "Nyx" }));
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe("invalid definition");
    expect(queryClient.getQueryData(characterKey("1"))).toEqual(original);
  });

  it("runs a second edit on the first one's result, so neither write lands over the other", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(characterKey("1"), characterRecord("1", "Vex"));
    const sent: CharacterDefinition[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const definition = JSON.parse(String(init?.body)) as CharacterDefinition;
        sent.push(definition);
        const record = { ...characterRecord("1", definition.name), definition };
        return new Response(JSON.stringify(record), { status: 200 });
      }),
    );

    const { result } = renderHook(() => useUpdateCharacterDefinition("1"), {
      wrapper: wrapper(queryClient),
    });

    const first = result.current.mutateAsync((definition) => ({ ...definition, name: "Nyx" }));
    const second = result.current.mutateAsync((definition) => ({
      ...definition,
      alignment: "Chaotic Good",
    }));
    await Promise.all([first, second]);

    expect(sent[1]).toMatchObject({ name: "Nyx", alignment: "Chaotic Good" });
  });
});
