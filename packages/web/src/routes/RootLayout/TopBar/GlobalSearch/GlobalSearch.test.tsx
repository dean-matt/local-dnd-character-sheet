import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider, useLocation } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterRecord } from "../../../../test/records.ts";
import { stubFetchByUrl } from "../../../../test/stubFetch.ts";
import { GlobalSearch } from "./GlobalSearch.tsx";

const page = (items: unknown[]) => ({ items, total: items.length, limit: 10, offset: 0 });
const searchUrl = (q: string) => `/api/search?q=${q}&limit=10`;

const fireball = { type: "spell", name: "Fireball", source: "PHB", edition: "classic" };
const fireGiant = {
  type: "monster",
  name: "Fire Giant",
  source: "MM",
  textless: true as const,
  edition: null,
};
const ember = {
  type: "item",
  id: "3",
  name: "Ember Charm",
  edition: "one",
  item: { kinds: ["wondrous"], rarity: "uncommon", category: null },
};
const fireballRecord = {
  name: "Fireball",
  source: "PHB",
  edition: "classic",
  level: 3,
  school: "V",
  concentration: false,
  ritual: false,
  json: { name: "Fireball", source: "PHB", level: 3, school: "V", duration: [{ type: "instant" }] },
};

function Where() {
  return <output aria-label="location">{useLocation().pathname}</output>;
}

function renderSearch(bodies: Record<string, unknown>) {
  const onOpen = vi.fn();
  stubFetchByUrl({ "/api/characters": [characterRecord("7", "Fira")], ...bodies });
  const router = createMemoryRouter(
    [
      {
        path: "*",
        element: (
          <>
            <GlobalSearch onOpen={onOpen} />
            <Where />
          </>
        ),
      },
    ],
    { initialEntries: ["/"] },
  );
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  const input = screen.getByRole("combobox", { name: "Search characters and the compendium" });
  return { input, onOpen };
}

function type(input: HTMLElement, value: string) {
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GlobalSearch", () => {
  it("links to the advanced search with the query, keeping the panel open as focus moves to it", async () => {
    const { input } = renderSearch({
      [searchUrl("fire")]: page([]),
    });
    type(input, " fire ");

    const advanced = screen.getByRole("link", { name: 'Advanced search for "fire" →' });
    expect(advanced).toHaveAttribute("href", "/search?q=fire");
    fireEvent.blur(input, { relatedTarget: advanced });
    expect(advanced).toBeVisible();

    fireEvent.click(advanced);
    expect(screen.getByRole("status", { name: "location" })).toHaveTextContent("/search");
    expect(input).toHaveValue("");
  });

  it("groups characters and compendium hits from both editions, in the order the server ranks them, each with its type", async () => {
    const { input, onOpen } = renderSearch({
      [searchUrl("fir")]: page([fireball, fireGiant, ember]),
    });
    type(input, "fir");
    expect(onOpen).toHaveBeenCalled();

    const compendium = await screen.findByRole("group", { name: "Compendium" });
    const characters = screen.getByRole("group", { name: "Characters" });
    expect(within(characters).getByRole("option")).toHaveTextContent(/Fira.*Character/);
    const options = within(compendium).getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      "FireballPHB20142014 rulesSpell",
      "Fire GiantMMNo page yetMonster",
      "Ember CharmWondrous item • UncommonHomebrew20242024 rulesItem",
    ]);
    expect(options[1]).toHaveAttribute("aria-disabled", "true");
  });

  it("moves through results by arrow and opens one's detail over the page with Enter", async () => {
    const { input } = renderSearch({
      [searchUrl("fir")]: page([fireball]),
      "/api/spells/Fireball/PHB": fireballRecord,
    });
    type(input, "fir");
    await screen.findByRole("option", { name: /Fireball/ });

    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    const active = screen.getByRole("option", { name: /Fireball/ });
    expect(input).toHaveAttribute("aria-activedescendant", active.id);
    expect(active).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(input, { key: "Enter" });
    const dialog = await screen.findByRole("dialog", { name: "Fireball" });
    expect(screen.getByRole("status", { name: "location" })).toHaveTextContent(/^\/$/);

    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(input).toHaveFocus();
    expect(input).toHaveValue("fir");
  });

  it("opens a character from its result", async () => {
    const { input } = renderSearch({
      [searchUrl("fira")]: page([]),
    });
    type(input, "fira");
    fireEvent.click(await screen.findByRole("option", { name: /Fira/ }));
    expect(screen.getByRole("status", { name: "location" })).toHaveTextContent("/characters/7");
    expect(document.querySelector(".bg-scrim")).toBeNull();
  });

  it("leaves a result with no page where it is", async () => {
    const { input } = renderSearch({
      [searchUrl("giant")]: page([fireGiant]),
    });
    type(input, "giant");
    await screen.findByRole("option", { name: /Fire Giant/ });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByRole("status", { name: "location" })).toHaveTextContent(/^\/$/);
  });

  it("says when nothing matches", async () => {
    const { input } = renderSearch({
      [searchUrl("zzz")]: page([]),
    });
    type(input, "zzz");
    await waitFor(() =>
      expect(screen.getByRole("status", { name: "" })).toHaveTextContent('No results for "zzz".'),
    );
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("says it is searching, not that nothing matches, while a new query waits on the last one's empty answer", async () => {
    const { input } = renderSearch({
      [searchUrl("fireballx")]: page([]),
      [searchUrl("fireball")]: page([fireball]),
    });
    type(input, "fireballx");
    await waitFor(() =>
      expect(screen.getByRole("status", { name: "" })).toHaveTextContent(
        'No results for "fireballx".',
      ),
    );

    type(input, "fireball");
    expect(screen.getByRole("status", { name: "" })).toHaveTextContent("Searching…");
    expect(await screen.findByRole("option", { name: /Fireball/ })).toBeInTheDocument();
  });

  it("a click on the scrim closes the results and leaves focus in the pill", async () => {
    const { input } = renderSearch({
      [searchUrl("fir")]: page([fireball]),
    });
    input.focus();
    type(input, "fir");
    await screen.findByRole("option", { name: /Fireball/ });

    const scrim = document.querySelector(".bg-scrim");
    if (!scrim) throw new Error("no scrim while the search is open");
    expect(fireEvent.mouseDown(scrim)).toBe(false);
    fireEvent.click(scrim);
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    expect(document.querySelector(".bg-scrim")).toBeNull();
    expect(input).toHaveValue("fir");
  });

  it("closes on Escape, then clears on a second", async () => {
    const { input } = renderSearch({
      [searchUrl("fir")]: page([fireball]),
    });
    type(input, "fir");
    await screen.findByRole("option", { name: /Fireball/ });

    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    expect(input).toHaveValue("fir");

    fireEvent.keyDown(input, { key: "Escape" });
    expect(input).toHaveValue("");
  });

  it("closes on Escape from the Advanced search link and returns focus to the input", async () => {
    const { input } = renderSearch({ [searchUrl("fir")]: page([fireball]) });
    type(input, "fir");
    await screen.findByRole("option", { name: /Fireball/ });

    const advanced = screen.getByRole("link", { name: /Advanced search/ });
    advanced.focus();
    fireEvent.keyDown(advanced, { key: "Escape" });

    expect(screen.queryByRole("option")).not.toBeInTheDocument();
    expect(input).toHaveFocus();
    expect(input).toHaveValue("fir");
  });
});
