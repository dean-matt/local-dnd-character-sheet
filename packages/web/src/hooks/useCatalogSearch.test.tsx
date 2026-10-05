import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setDisabledSources } from "../lib/disabledSources.ts";
import { stubFetch } from "../test/stubFetch.ts";
import { useCatalogSearch } from "./useCatalogSearch.ts";

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

const body = { items: [], total: 0, limit: 20, offset: 0 };

afterEach(() => {
  vi.unstubAllGlobals();
  setDisabledSources([]);
});

describe("useCatalogSearch", () => {
  it("searches the trimmed query within the edition and type", async () => {
    const fetchMock = stubFetch(new Response(JSON.stringify(body), { status: 200 }));

    const { result } = renderHook(
      () => useCatalogSearch({ edition: "one", type: "feat", query: "  alert ", limit: 20 }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/search?edition=one&q=alert&limit=20&type=feat",
      undefined,
    );
  });

  it("leaves out every source Settings turned off", async () => {
    setDisabledSources(["VGM", "SCAG"]);
    const fetchMock = stubFetch(new Response(JSON.stringify(body), { status: 200 }));

    const { result } = renderHook(
      () => useCatalogSearch({ edition: "classic", query: "elf", limit: 20 }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/search?edition=classic&q=elf&limit=20&exclude=SCAG%2CVGM",
      undefined,
    );
  });

  it("lists every row for a blank query where asked, across both editions and the filters given", async () => {
    const fetchMock = stubFetch(new Response(JSON.stringify(body), { status: 200 }));

    const { result } = renderHook(
      () =>
        useCatalogSearch({
          type: "spell,item",
          query: " ",
          limit: 20,
          offset: 40,
          listAll: true,
          filters: { source: "PHB", school: "V" },
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/search?limit=20&offset=40&type=spell%2Citem&source=PHB&school=V",
      undefined,
    );
  });

  it("fetches nothing for a blank query", () => {
    const fetchMock = stubFetch(new Response(JSON.stringify(body), { status: 200 }));

    const { result } = renderHook(
      () => useCatalogSearch({ edition: "one", type: "feat", query: " ", limit: 20 }),
      { wrapper },
    );

    expect(result.current.fetchStatus).toBe("idle");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps the last page up while the next query loads, only where asked", async () => {
    const page = { ...body, items: [], total: 7 };
    for (const keepPrevious of [true, false]) {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValueOnce(new Response(JSON.stringify(page), { status: 200 }))
          .mockReturnValueOnce(new Promise(() => {})),
      );
      const { result, rerender } = renderHook(
        ({ query }) => useCatalogSearch({ query, limit: 20, keepPrevious }),
        { wrapper, initialProps: { query: "fire" } },
      );
      await waitFor(() => expect(result.current.data?.total).toBe(7));

      rerender({ query: "ice" });
      expect(result.current.data?.total).toBe(keepPrevious ? 7 : undefined);
    }
  });
});
