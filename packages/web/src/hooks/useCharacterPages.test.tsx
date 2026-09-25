import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { presetPageRecords } from "../test/records.ts";
import { stubFetch } from "../test/stubFetch.ts";
import { useCharacterPages, useReplaceCharacterPages } from "./useCharacterPages.ts";

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

function deferred() {
  let resolve: (response: Response) => void = () => {};
  const promise = new Promise<Response>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useCharacterPages", () => {
  it("resolves the character's pages the API returns, in order", async () => {
    const fetchMock = stubFetch(new Response(JSON.stringify(presetPageRecords()), { status: 200 }));

    const { result } = renderHook(() => useCharacterPages("1"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(presetPageRecords());
    expect(fetchMock).toHaveBeenCalledWith("/api/characters/1/pages", undefined);
  });

  it("sends writes one at a time, and keeps the last list when an earlier reply lands", async () => {
    const presets = presetPageRecords();
    const first = presets.map((page) => ({ ...page, hidden: page.slug === "spells" }));
    const second = [...presets].reverse();
    const replies = [deferred(), deferred()];
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method !== "PUT") return new Response(JSON.stringify(presets), { status: 200 });
      return (replies[fetchMock.mock.calls.length - 2] ?? deferred()).promise;
    });
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(
      () => ({ pages: useCharacterPages("1"), replace: useReplaceCharacterPages("1") }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.pages.isSuccess).toBe(true));

    act(() => {
      result.current.replace.write(first);
      result.current.replace.write(second);
    });
    expect(result.current.replace.current()).toEqual(second);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await new Promise((settle) => setTimeout(settle, 20));
    expect(fetchMock).toHaveBeenCalledTimes(2);

    replies[0]?.resolve(new Response(JSON.stringify(first), { status: 200 }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(result.current.replace.current()).toEqual(second);

    replies[1]?.resolve(new Response(JSON.stringify(second), { status: 200 }));
    await waitFor(() => expect(result.current.replace.isPending).toBe(false));
    expect(result.current.pages.data).toEqual(second);
  });
});
