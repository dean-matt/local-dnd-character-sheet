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

  it.each([
    ["hidden", presetPageRecords().map((page) => ({ ...page, hidden: true }))],
    ["deleted", []],
  ])("points a character whose every page is %s at Manage pages", async (_, pages) => {
    stubFetchByUrl({ "/api/characters/abc/pages": pages });
    renderRedirect();

    await screen.findByRole("heading", { level: 1, name: "No pages to show" });
    expect(screen.getByText(/Manage pages, in the sidebar/)).toBeInTheDocument();
  });
});
