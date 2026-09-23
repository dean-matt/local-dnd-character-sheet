import { vi } from "vitest";

/** Stubs global `fetch` to resolve with `response`, for a test that reads `lib/api.ts`. */
export function stubFetch(response: Response) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
