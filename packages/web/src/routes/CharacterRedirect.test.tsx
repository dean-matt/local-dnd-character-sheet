import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { presetPageRecords } from "../test/records.ts";
import { stubFetchByUrl } from "../test/stubFetch.ts";
import { CharacterRedirect } from "./CharacterRedirect.tsx";

function renderRedirect() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      { path: "/characters/:id", element: <CharacterRedirect /> },
      { path: "/characters/:id/p/:slug", element: <p>landed</p> },
    ],
    { initialEntries: ["/characters/abc"] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CharacterRedirect", () => {
  it("lands on the first page that is not hidden", async () => {
    const [stats, ...rest] = presetPageRecords();
    stubFetchByUrl({ "/api/characters/abc/pages": [{ ...stats, hidden: true }, ...rest] });
    const router = renderRedirect();

    await screen.findByText("landed");
    expect(router.state.location.pathname).toBe("/characters/abc/p/spells");
  });

  it("shows the not-found state for a character with no visible page", async () => {
    stubFetchByUrl({
      "/api/characters/abc/pages": presetPageRecords().map((page) => ({ ...page, hidden: true })),
    });
    renderRedirect();

    await screen.findByRole("heading", { level: 1, name: "Page not found" });
  });
});
