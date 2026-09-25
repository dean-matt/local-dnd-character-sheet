import { vi } from "vitest";

/** Stubs global `fetch` to resolve with `response`, for a test that reads `lib/api.ts`. */
export function stubFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/**
 * Stubs global `fetch` to answer each URL in `bodies` with that JSON and a 200, and any
 * other URL with a 404, for a view that makes more than one request.
 */
export function stubFetchByUrl(bodies: Record<string, unknown>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input);
    return url in bodies
      ? new Response(JSON.stringify(bodies[url]), { status: 200 })
      : new Response(JSON.stringify({ error: `nothing at ${url}` }), { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
