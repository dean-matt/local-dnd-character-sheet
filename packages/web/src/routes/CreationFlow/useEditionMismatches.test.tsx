import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { creationForm } from "./creationForm.ts";
import { useEditionMismatches } from "./useEditionMismatches.ts";

const subclass = {
  id: "s1",
  name: "Hearthkeeper",
  edition: "one",
  className: "Fighter",
  classSource: "XPHB",
  json: { name: "Hearthkeeper", source: "HB", className: "Fighter", classSource: "XPHB" },
  createdAt: "2026-01-01T00:00:00.000Z",
};

afterEach(() => vi.unstubAllGlobals());

it("caches the homebrew subclasses as the Homebrew page parses them, parent and all", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) =>
      String(input) === "/api/homebrew/subclasses"
        ? new Response(JSON.stringify([subclass]))
        : new Response(JSON.stringify({ error: String(input) }), { status: 404 }),
    ),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <creationForm.FormShell onSubmit={() => {}}>{() => children}</creationForm.FormShell>
    </QueryClientProvider>
  );

  renderHook(() => useEditionMismatches(), { wrapper });

  await waitFor(() =>
    expect(client.getQueryData(["homebrew", "subclasses"])).toMatchObject([
      { json: { parent: { name: "Fighter", source: "XPHB" } } },
    ]),
  );
});
