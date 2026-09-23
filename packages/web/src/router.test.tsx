import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { routeConfig } from "./router.tsx";

function renderAt(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(routeConfig, { initialEntries: [path] });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

describe("routing", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify([]), { status: 200 })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the character list at the root", () => {
    renderAt("/");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "local-dnd-character-sheet",
    );
  });

  it("redirects a character to its first visible page", async () => {
    const router = renderAt("/characters/abc");
    await screen.findByRole("heading", { level: 1, name: "Stats" });
    expect(router.state.location.pathname).toBe("/characters/abc/p/stats");
  });

  it("lists a character's pages in the nav, with the current one marked", async () => {
    renderAt("/characters/abc/p/spells");
    await screen.findByRole("heading", { level: 1, name: "Spells" });

    const nav = screen.getByRole("navigation", { name: "Character pages" });
    expect(nav.querySelectorAll("a")).toHaveLength(4);
    expect(screen.getByRole("link", { name: "Spells" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Stats" })).not.toHaveAttribute("aria-current");
  });

  it("shows the not-found state for a slug that names no page", async () => {
    renderAt("/characters/abc/p/nonsense");
    await screen.findByRole("heading", { level: 1, name: "Page not found" });
    expect(screen.getByRole("navigation", { name: "Character pages" })).toBeInTheDocument();
  });

  it("shows the not-found state for an unmatched route", async () => {
    renderAt("/this/goes/nowhere");
    await screen.findByRole("heading", { level: 1, name: "Page not found" });
  });

  it("renders the catalog route", async () => {
    renderAt("/catalog/spells/fireball/phb");
    await screen.findByRole("heading", { level: 1, name: "Catalog" });
  });

  it("wraps every route in one landmark layout", async () => {
    renderAt("/");
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Skip to main content" })).toHaveAttribute(
      "href",
      "#main-content",
    );
  });
});
