import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { presetPageRecords } from "../test/records.ts";
import { stubFetch } from "../test/stubFetch.ts";
import { useCharacterPages } from "./useCharacterPages.ts";
import { useReplaceCharacterPages } from "./useReplaceCharacterPages.ts";
import { useRestoreDefaultPages } from "./useRestoreDefaultPages.ts";

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
    // A third request that must not go out has no signal to wait on; 20 ms is many turns of the event loop.
    await new Promise((settle) => setTimeout(settle, 20));
    expect(fetchMock).toHaveBeenCalledTimes(2);

    replies[0]?.resolve(new Response(JSON.stringify(first), { status: 200 }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(result.current.replace.current()).toEqual(second);

    replies[1]?.resolve(new Response(JSON.stringify(second), { status: 200 }));
    await waitFor(() => expect(result.current.replace.isPending).toBe(false));
    expect(result.current.pages.data).toEqual(second);
  });

  it("keeps an undo whose write fails, so the next press retries it", async () => {
    const presets = presetPageRecords();
    const reversed = [...presets].reverse();
    let failNext = false;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method !== "PUT") return new Response(JSON.stringify(presets), { status: 200 });
      if (failNext) return new Response(JSON.stringify({ error: "refused" }), { status: 409 });
      const body = JSON.parse(String(init.body)) as object[];
      return new Response(JSON.stringify(body.map((page) => ({ ...page, preset: true }))), {
        status: 200,
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(
      () => ({ pages: useCharacterPages("1"), replace: useReplaceCharacterPages("1") }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.pages.isSuccess).toBe(true));
    act(() => result.current.replace.write(reversed));
    await waitFor(() => expect(result.current.replace.isSuccess).toBe(true));

    failNext = true;
    act(() => {
      result.current.replace.undo();
    });
    await waitFor(() => expect(result.current.replace.isError).toBe(true));
    expect(result.current.replace.canUndo).toBe(true);

    failNext = false;
    act(() => {
      result.current.replace.undo();
    });
    await waitFor(() => expect(result.current.replace.isSuccess).toBe(true));
    expect(JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body))).toEqual(
      presets.map(({ preset: _, ...page }) => page),
    );
    expect(result.current.replace.canUndo).toBe(false);
  });

  it("drops the undo a failed save opened, since it would undo to what the server holds", async () => {
    const presets = presetPageRecords();
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method !== "PUT") return new Response(JSON.stringify(presets), { status: 200 });
      return new Response(JSON.stringify({ error: "refused" }), { status: 409 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(
      () => ({ pages: useCharacterPages("1"), replace: useReplaceCharacterPages("1") }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.pages.isSuccess).toBe(true));

    act(() => result.current.replace.write([...presets].reverse()));
    expect(result.current.replace.canUndo).toBe(true);
    await waitFor(() => expect(result.current.replace.isError).toBe(true));
    expect(result.current.replace.canUndo).toBe(false);
  });

  it("sends a restore only once a write before it has replied", async () => {
    const presets = presetPageRecords();
    const reply = deferred();
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "PUT") return reply.promise;
      return new Response(JSON.stringify(presets), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(
      () => ({
        pages: useCharacterPages("1"),
        replace: useReplaceCharacterPages("1"),
        restore: useRestoreDefaultPages("1"),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.pages.isSuccess).toBe(true));
    const reversed = [...presets].reverse();

    act(() => {
      result.current.replace.write(reversed);
      result.current.restore.mutate();
    });
    // A restore request that must not go out has no signal to wait on; 20 ms is many turns of the event loop.
    await new Promise((settle) => setTimeout(settle, 20));
    const sent = () => fetchMock.mock.calls.map(([input]) => String(input));
    expect(sent().filter((url) => url.endsWith("/restore-defaults"))).toHaveLength(0);

    reply.resolve(new Response(JSON.stringify(reversed), { status: 200 }));
    await waitFor(() => expect(result.current.restore.isSuccess).toBe(true));
    expect(result.current.pages.data).toEqual(presets);
  });
});
