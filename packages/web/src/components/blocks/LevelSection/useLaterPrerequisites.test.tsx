import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { characterRecord } from "../../../test/records.ts";
import { stubFetchByUrl } from "../../../test/stubFetch.ts";
import { useLaterPrerequisites } from "./useLaterPrerequisites.ts";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

afterEach(() => vi.unstubAllGlobals());

it("reads a homebrew class cited by name and source without asking the catalog for its row", async () => {
  const fetchMock = stubFetchByUrl({});
  const base = characterRecord("1", "Vex").definition;
  const definition = { ...base, levels: [{ class: { name: "Warden", source: "HB" } }] };
  const { result } = renderHook(() => useLaterPrerequisites(definition, definition), { wrapper });

  await waitFor(() => expect(result.current.read).toBe(true));
  expect(result.current.failed).toBe(false);
  expect(fetchMock.mock.calls.map(([url]) => String(url))).not.toContain("/api/classes/Warden/HB");
});
