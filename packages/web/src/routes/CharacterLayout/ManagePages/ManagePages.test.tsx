import type { CharacterPageRecord } from "@dnd/character";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { routeConfig } from "../../../router.tsx";
import { characterRecord, presetPageRecords } from "../../../test/records.ts";

const GRAPPLE: CharacterPageRecord = {
  slug: "grapple",
  title: "Grapple",
  hidden: false,
  preset: false,
  blocks: [],
};

/** The presets after the first four, which every reorder here leaves in place. */
const LATER = presetPageRecords().slice(4);
const LATER_SLUGS = LATER.map((page) => page.slug);
const LATER_TITLES = LATER.map((page) => page.title);

/**
 * A fake of the pages routes: a `PUT` stores the list, marking a page preset by its slug,
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
      const presets = new Set(presetPageRecords().map((page) => page.slug));
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

const status = () => document.querySelector("dialog p[aria-live='polite']");

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ManagePages", () => {
  it("opens from a button that declares it opens a dialog", async () => {
    stubServer(presetPageRecords());
    await renderManaging();

    expect(screen.getByRole("button", { name: "Manage pages" })).toHaveAttribute(
      "aria-haspopup",
      "dialog",
    );
  });

  it("returns focus to the Manage button when closed with ×", async () => {
    stubServer(presetPageRecords());
    await renderManaging();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Manage pages" })).toHaveFocus();
    });
    expect(
      screen.queryByRole("heading", { level: 2, name: "Manage pages" }),
    ).not.toBeInTheDocument();
  });

  it("moves a page, persists the order and announces where it went", async () => {
    const server = stubServer(presetPageRecords());
    await renderManaging();

    fireEvent.click(screen.getByRole("button", { name: "Move Stats down" }));

    await waitFor(() =>
      expect(navTitles()).toEqual(["Spells", "Stats", "Inventory", "Features", ...LATER_TITLES]),
    );
    expect(status()).toHaveTextContent("Stats moved to position 2 of 8.");
    await waitFor(() =>
      expect(server.stored().map((page) => page.slug)).toEqual([
        "spells",
        "stats",
        "inventory",
        "features",
        ...LATER_SLUGS,
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
      ...LATER_SLUGS,
    ]);
    expect(navTitles()).toEqual(["Spells", "Inventory", "Stats", "Features", ...LATER_TITLES]);
  });

  it("refuses a move past either end, keeping the button focusable", async () => {
    const server = stubServer(presetPageRecords());
    await renderManaging();

    const up = screen.getByRole("button", { name: "Move Stats up" });
    expect(up).toHaveAttribute("aria-disabled", "true");
    expect(up).toBeEnabled();
    fireEvent.click(up);
    fireEvent.click(screen.getByRole("button", { name: "Move Notes down" }));

    expect(server.puts).toHaveLength(0);
  });

  it("hides a page from the nav, and a hidden page is still reachable by URL", async () => {
    stubServer(presetPageRecords());
    const router = await renderManaging();

    fireEvent.click(screen.getByRole("button", { name: "Hide Spells" }));

    await waitFor(() =>
      expect(navTitles()).toEqual(["Stats", "Inventory", "Features", ...LATER_TITLES]),
    );
    expect(status()).toHaveTextContent("Spells hidden.");
    await router.navigate("/characters/abc/p/spells");
    expect(await screen.findByRole("region", { name: "Spells" })).toBeInTheDocument();
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

    await waitFor(() =>
      expect(navTitles()).toEqual(["Stats", "Spells", "Inventory", "Features", ...LATER_TITLES]),
    );
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
    expect(hide).toHaveAccessibleDescription("The last visible page cannot be hidden or deleted.");
    fireEvent.click(hide);

    expect(server.puts).toHaveLength(0);
    expect(navTitles()).toEqual(["Stats"]);
  });

  it("creates a page under a fresh slug behind the dialog, its title focused for renaming", async () => {
    const server = stubServer([...presetPageRecords(), { ...GRAPPLE, slug: "new-page" }]);
    const router = await renderManaging();

    fireEvent.click(screen.getByRole("button", { name: "New page" }));

    await waitFor(() => expect(server.puts).toHaveLength(1));
    expect(server.stored().at(-1)).toEqual({
      slug: "new-page-2",
      title: "New page",
      hidden: false,
      preset: false,
      blocks: [],
    });
    expect(router.state.location.pathname).toBe("/characters/abc/p/new-page-2");
    expect(router.state.location.search).toBe("");
    expect(screen.getByRole("heading", { level: 2, name: "Manage pages" })).toBeInTheDocument();
    expect(status()).toHaveTextContent("New page added.");
    const created = screen.getByRole("textbox", { name: "Rename New page" });
    await waitFor(() => expect(created).toHaveFocus());
    expect(created.closest("[data-page]")).toHaveAttribute("data-page", "new-page-2");
  });

  it("undoes a page's creation, leaving it for the first visible page", async () => {
    const server = stubServer(presetPageRecords());
    const router = await renderManaging();

    fireEvent.click(screen.getByRole("button", { name: "New page" }));
    await waitFor(() => expect(server.puts).toHaveLength(1));
    fireEvent.click(screen.getByRole("button", { name: "Undo page change" }));

    await waitFor(() => expect(server.puts).toHaveLength(2));
    expect(server.stored().map((page) => page.slug)).not.toContain("new-page");
    expect(router.state.location.pathname).toBe("/characters/abc/p/stats");
  });

  it("renames a page the user wrote in its row, keeping its slug", async () => {
    const server = stubServer([GRAPPLE, ...presetPageRecords()]);
    await renderManaging();

    const field = screen.getByRole("textbox", { name: "Rename Grapple" });
    fireEvent.change(field, { target: { value: "Shove" } });
    fireEvent.blur(field);

    await waitFor(() => expect(server.puts).toHaveLength(1));
    expect(server.stored()[0]).toMatchObject({ slug: "grapple", title: "Shove" });
    expect(await screen.findByRole("textbox", { name: "Rename Shove" })).toHaveValue("Shove");
  });

  it("renames a preset in its row, and restoring the defaults puts its title back", async () => {
    const server = stubServer(presetPageRecords());
    await renderManaging();

    const field = screen.getByRole("textbox", { name: "Rename Stats" });
    fireEvent.change(field, { target: { value: "Numbers" } });
    fireEvent.blur(field);
    await waitFor(() =>
      expect(server.stored()[0]).toMatchObject({ slug: "stats", title: "Numbers" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Restore defaults" }));
    await waitFor(() =>
      expect(server.stored()[0]).toMatchObject({ slug: "stats", title: "Stats" }),
    );
    expect(await screen.findByRole("textbox", { name: "Rename Stats" })).toHaveValue("Stats");
  });

  it("deletes a page the user wrote, and leaves the page it was on", async () => {
    const server = stubServer([GRAPPLE, ...presetPageRecords()]);
    const router = await renderManaging("/characters/abc/p/grapple");

    fireEvent.click(screen.getByRole("button", { name: "Delete Grapple" }));

    await waitFor(() => expect(server.puts).toHaveLength(1));
    expect(server.stored().map((page) => page.slug)).not.toContain("grapple");
    expect(status()).toHaveTextContent("Grapple deleted.");
    expect(router.state.location.pathname).toBe("/characters/abc/p/stats");
  });

  it("deletes a preset as it deletes any page, and an undo writes it back in place", async () => {
    const server = stubServer(presetPageRecords());
    const router = await renderManaging("/characters/abc/p/stats");

    fireEvent.click(screen.getByRole("button", { name: "Delete Stats" }));

    await waitFor(() => expect(server.puts).toHaveLength(1));
    expect(server.stored().map((page) => page.slug)).not.toContain("stats");
    expect(status()).toHaveTextContent("Stats deleted.");
    expect(router.state.location.pathname).toBe("/characters/abc/p/spells");
    await waitFor(() => expect(navTitles()).not.toContain("Stats"));

    fireEvent.click(screen.getByRole("button", { name: "Undo page change" }));
    await waitFor(() => expect(server.puts).toHaveLength(2));
    expect(server.puts[1]).toEqual(presetPageRecords().map(({ preset: _, ...page }) => page));
  });

  it("refuses to delete the last visible page", async () => {
    const [stats, ...rest] = presetPageRecords();
    const server = stubServer([
      stats as CharacterPageRecord,
      ...rest.map((page) => ({ ...page, hidden: true })),
    ]);
    await renderManaging();

    const remove = screen.getByRole("button", { name: "Delete Stats" });
    expect(remove).toHaveAttribute("aria-disabled", "true");
    expect(remove).toHaveAccessibleDescription(
      "The last visible page cannot be hidden or deleted.",
    );
    fireEvent.click(remove);

    expect(server.puts).toHaveLength(0);
  });

  it("undoes a delete, writing back the list before it", async () => {
    const server = stubServer([GRAPPLE, ...presetPageRecords()]);
    await renderManaging();
    const undo = screen.getByRole("button", { name: "Undo page change" });
    expect(undo).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(screen.getByRole("button", { name: "Delete Grapple" }));
    await waitFor(() => expect(server.puts).toHaveLength(1));
    fireEvent.click(undo);

    await waitFor(() => expect(server.puts).toHaveLength(2));
    expect(server.stored().map((page) => page.slug)[0]).toBe("grapple");
    expect(status()).toHaveTextContent("Undid the last page change.");
    expect(undo).toHaveAttribute("aria-disabled", "true");
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

  it("undoes a restore, writing back the list before it", async () => {
    const before = [GRAPPLE, ...presetPageRecords().reverse()];
    const server = stubServer(before);
    await renderManaging();

    fireEvent.click(screen.getByRole("button", { name: "Restore defaults" }));
    await waitFor(() => expect(status()).toHaveTextContent("Default pages restored."));
    fireEvent.click(screen.getByRole("button", { name: "Undo page change" }));

    await waitFor(() => expect(server.puts).toHaveLength(1));
    expect(server.puts[0]).toEqual(before.map(({ preset: _, ...page }) => page));
  });
});
