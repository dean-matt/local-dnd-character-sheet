import type { CharacterPageRecord } from "@dnd/character";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { routeConfig } from "../router.tsx";
import { characterRecord, presetPageRecords } from "../test/records.ts";

const GRAPPLE: CharacterPageRecord = {
  slug: "grapple",
  title: "Grapple",
  hidden: false,
  preset: false,
  blocks: [],
};

/**
 * A fake of the pages routes: a `PUT` stores the list with each preset flag carried over,
 * and restoring resets the presets to seeded order in the slots presets hold.
 */
function stubServer(initial: CharacterPageRecord[]) {
  let stored = initial;
  const puts: unknown[] = [];
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/characters/abc") return json(characterRecord("abc", "Vex"));
    if (url === "/api/characters/abc/pages" && init?.method === "PUT") {
      const body = JSON.parse(String(init.body)) as Omit<CharacterPageRecord, "preset">[];
      puts.push(body);
      const presets = new Set(stored.filter((page) => page.preset).map((page) => page.slug));
      stored = body.map((page) => ({ ...page, preset: presets.has(page.slug) }));
      return json(stored);
    }
    if (url === "/api/characters/abc/pages") return json(stored);
    if (url === "/api/characters/abc/pages/restore-defaults") {
      const seeded = presetPageRecords();
      let next = 0;
      stored = stored.map((page) => (page.preset ? (seeded[next++] as CharacterPageRecord) : page));
      return json(stored);
    }
    return new Response(JSON.stringify({ error: `nothing at ${url}` }), { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return { puts, stored: () => stored };
}

async function renderManaging(path = "/characters/abc/p/stats") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(routeConfig, { initialEntries: [path] });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Manage pages" }));
  await screen.findByRole("heading", { level: 2, name: "Manage pages" });
  return router;
}

const navTitles = () =>
  within(screen.getByRole("navigation", { name: "Character pages" }))
    .queryAllByRole("link")
    .map((link) => link.textContent);

const status = () => document.querySelector("[aria-live='polite']");

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ManagePages", () => {
  it("opens from a disclosure button that reports its state", async () => {
    stubServer(presetPageRecords());
    await renderManaging();

    expect(screen.getByRole("button", { name: "Manage pages" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("moves a page, persists the order and announces where it went", async () => {
    const server = stubServer(presetPageRecords());
    await renderManaging();

    fireEvent.click(screen.getByRole("button", { name: "Move Stats down" }));

    await waitFor(() => expect(navTitles()).toEqual(["Spells", "Stats", "Inventory", "Features"]));
    expect(status()).toHaveTextContent("Stats moved to position 2 of 4.");
    await waitFor(() =>
      expect(server.stored().map((page) => page.slug)).toEqual([
        "spells",
        "stats",
        "inventory",
        "features",
      ]),
    );
    expect(server.puts[0]).toEqual(server.stored().map(({ preset: _preset, ...page }) => page));
  });

  it("builds a second press on the first, before either renders or returns", async () => {
    const server = stubServer(presetPageRecords());
    await renderManaging();

    const down = screen.getByRole("button", { name: "Move Stats down" });
    act(() => {
      down.click();
      down.click();
    });

    await waitFor(() => expect(server.puts).toHaveLength(2));
    expect(server.stored().map((page) => page.slug)).toEqual([
      "spells",
      "inventory",
      "stats",
      "features",
    ]);
    expect(navTitles()).toEqual(["Spells", "Inventory", "Stats", "Features"]);
  });

  it("refuses a move past either end, keeping the button focusable", async () => {
    const server = stubServer(presetPageRecords());
    await renderManaging();

    const up = screen.getByRole("button", { name: "Move Stats up" });
    expect(up).toHaveAttribute("aria-disabled", "true");
    expect(up).toBeEnabled();
    fireEvent.click(up);
    fireEvent.click(screen.getByRole("button", { name: "Move Features down" }));

    expect(server.puts).toHaveLength(0);
  });

  it("hides a page from the nav, and a hidden page is still reachable by URL", async () => {
    stubServer(presetPageRecords());
    const router = await renderManaging();

    fireEvent.click(screen.getByRole("button", { name: "Hide Spells" }));

    await waitFor(() => expect(navTitles()).toEqual(["Stats", "Inventory", "Features"]));
    expect(status()).toHaveTextContent("Spells hidden.");
    await router.navigate("/characters/abc/p/spells");
    expect(await screen.findByRole("heading", { level: 1, name: "Spells" })).toBeInTheDocument();
  });

  it("shows a hidden page again", async () => {
    const [stats, spells, ...rest] = presetPageRecords();
    stubServer([
      stats as CharacterPageRecord,
      { ...(spells as CharacterPageRecord), hidden: true },
      ...rest,
    ]);
    await renderManaging();

    fireEvent.click(screen.getByRole("button", { name: "Show Spells" }));

    await waitFor(() => expect(navTitles()).toEqual(["Stats", "Spells", "Inventory", "Features"]));
    expect(status()).toHaveTextContent("Spells shown.");
  });

  it("moves off the page it hides, onto the first page still visible", async () => {
    stubServer(presetPageRecords());
    const router = await renderManaging("/characters/abc/p/stats");

    fireEvent.click(screen.getByRole("button", { name: "Hide Stats" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/characters/abc/p/spells"));
  });

  it("refuses to hide the last visible page", async () => {
    const [stats, ...rest] = presetPageRecords();
    const server = stubServer([
      stats as CharacterPageRecord,
      ...rest.map((page) => ({ ...page, hidden: true })),
    ]);
    await renderManaging();

    const hide = screen.getByRole("button", { name: "Hide Stats" });
    expect(hide).toHaveAttribute("aria-disabled", "true");
    expect(hide).toHaveAccessibleDescription("The last visible page cannot be hidden.");
    fireEvent.click(hide);

    expect(server.puts).toHaveLength(0);
    expect(navTitles()).toEqual(["Stats"]);
  });

  it("restores the presets' seeded order and visibility, leaving a written page alone", async () => {
    const [stats, spells, inventory, features] = presetPageRecords() as CharacterPageRecord[];
    const server = stubServer([
      GRAPPLE,
      { ...(features as CharacterPageRecord), hidden: true },
      stats as CharacterPageRecord,
      spells as CharacterPageRecord,
      inventory as CharacterPageRecord,
    ]);
    await renderManaging();

    fireEvent.click(screen.getByRole("button", { name: "Restore defaults" }));

    await waitFor(() =>
      expect(navTitles()).toEqual(["Grapple", "Stats", "Spells", "Inventory", "Features"]),
    );
    expect(server.stored()[0]).toEqual(GRAPPLE);
    expect(status()).toHaveTextContent("Default pages restored.");
  });
});
