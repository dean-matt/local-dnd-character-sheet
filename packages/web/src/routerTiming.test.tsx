import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { expect, it } from "vitest";
import { routeConfig } from "./router.tsx";
import { characterRecord, presetPageRecords } from "./test/records.ts";
import { stubFetchByUrl } from "./test/stubFetch.ts";

async function timeAt(path: string, label: string, name: string, level = 1) {
  const t0 = performance.now();
  const router = createMemoryRouter(routeConfig, { initialEntries: [path] });
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await screen.findByRole("heading", { level, name }, { timeout: 20000 });
  const ms = Math.round(performance.now() - t0);
  process.stdout.write(`TIMING ${label} ${ms}ms\n`);
  return ms;
}

it("measures", async () => {
  stubFetchByUrl({
    "/api/characters": [],
    "/api/characters/abc": characterRecord("abc", "Vex"),
    "/api/characters/abc/pages": presetPageRecords(),
  });
  await timeAt("/settings/homebrew", "homebrew-cold", "Homebrew");
  await timeAt("/settings/homebrew", "homebrew-warm", "Homebrew");
  await timeAt("/characters/abc/p/stats", "sheet-cold", "Vex");
  await timeAt("/characters/abc/p/stats", "sheet-warm", "Vex");
  expect(true).toBe(true);
});
