import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterRecord, derivedRecord, presetPageRecords } from "../test/records.ts";
import { stubFetch, stubFetchByUrl } from "../test/stubFetch.ts";
import { CharacterPage } from "./CharacterPage.tsx";

function renderPage(path = "/characters/1/p/stats") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/characters/:id/p/:slug" element={<CharacterPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const stubCharacter = (pages = presetPageRecords()) =>
  stubFetchByUrl({
    "/api/characters/1": characterRecord("1", "Vex"),
    "/api/characters/1/derived": derivedRecord(),
    "/api/characters/1/pages": pages,
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CharacterPage", () => {
  it("shows a loading state while the pages are in flight", () => {
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise(() => {})));
    renderPage();

    expect(screen.getByRole("status")).toHaveTextContent("Loading pages…");
  });

  it("shows an error state when the request fails", async () => {
    stubFetch(new Response(JSON.stringify({ error: "no such character" }), { status: 404 }));
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("no such character");
  });

  it("renders the page's title and its blocks once both resolve", async () => {
    stubCharacter();
    renderPage();

    expect(await screen.findByRole("heading", { level: 1, name: "Stats" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { level: 2, name: "Vex" })).toBeInTheDocument();
  });

  it("renders a value block from the derived block the API computed", async () => {
    stubCharacter([
      {
        slug: "combat",
        title: "Combat",
        hidden: false,
        preset: false,
        blocks: [{ kind: "value", field: "hitPointMaximum" }],
      },
    ]);
    renderPage("/characters/1/p/combat");

    expect(await screen.findByText("10")).toBeInTheDocument();
  });

  it("shows why the derived block is missing, and still renders the page", async () => {
    stubFetchByUrl({
      "/api/characters/1": characterRecord("1", "Vex"),
      "/api/characters/1/pages": presetPageRecords(),
    });
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "nothing at /api/characters/1/derived",
    );
    expect(screen.getByText("Abilities isn't available yet.")).toBeInTheDocument();
  });

  it("shows why the character is missing, and still renders the page", async () => {
    stubFetchByUrl({
      "/api/characters/1/derived": derivedRecord(),
      "/api/characters/1/pages": presetPageRecords(),
    });
    renderPage();

    expect(await screen.findByRole("alert")).toHaveTextContent("nothing at /api/characters/1");
    expect(screen.getByText("Abilities isn't available yet.")).toBeInTheDocument();
  });

  it("reaches a hidden page by its URL", async () => {
    stubCharacter(presetPageRecords().map((page) => ({ ...page, hidden: true })));
    renderPage("/characters/1/p/inventory");

    expect(await screen.findByRole("heading", { level: 1, name: "Inventory" })).toBeInTheDocument();
  });

  it("shows the not-found state for a slug that names no page of this character", async () => {
    stubCharacter();
    renderPage("/characters/1/p/grapple");

    await screen.findByRole("heading", { level: 1, name: "Page not found" });
  });
});
