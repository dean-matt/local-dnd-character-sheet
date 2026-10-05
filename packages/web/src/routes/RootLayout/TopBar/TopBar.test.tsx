import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterRecord } from "../../../test/records.ts";
import { stubFetchByUrl } from "../../../test/stubFetch.ts";
import { TopBar } from "./TopBar.tsx";

const noCharacters = { "/api/characters": [] };

function renderTopBar(path = "/") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <TopBar />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("TopBar", () => {
  it("Character button toggles its menu", async () => {
    stubFetchByUrl(noCharacters);
    renderTopBar();

    const characterBtn = screen.getByRole("button", { name: /character/i });
    expect(characterBtn).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(characterBtn);
    expect(characterBtn).toHaveAttribute("aria-expanded", "true");
    expect(characterBtn).toHaveClass("bg-subtle");

    fireEvent.click(characterBtn);
    expect(characterBtn).toHaveAttribute("aria-expanded", "false");
  });

  it("the app name links to the homepage", () => {
    stubFetchByUrl(noCharacters);
    renderTopBar();

    expect(screen.getByRole("link", { name: "Local D&D" })).toHaveAttribute("href", "/");
  });

  it("See all characters links to the character list", () => {
    stubFetchByUrl(noCharacters);
    renderTopBar();

    fireEvent.click(screen.getByRole("button", { name: /character/i }));
    expect(screen.getByRole("link", { name: /see all characters/i })).toHaveAttribute(
      "href",
      "/characters",
    );
  });

  it("Settings links to the Settings page", () => {
    stubFetchByUrl(noCharacters);
    renderTopBar();

    expect(screen.getByRole("link", { name: /settings/i })).toHaveAttribute("href", "/settings");
    expect(screen.getByRole("link", { name: /settings/i })).not.toHaveAttribute("aria-current");
    expect(screen.queryByRole("group", { name: "Theme" })).not.toBeInTheDocument();
  });

  it.each([
    ["/characters", "character", "/characters"],
    ["/characters/7", "character", "/characters/7"],
    ["/characters/7/p/combat", "character", "/characters/7"],
    ["/settings", "settings", null],
    ["/", null, null],
    ["/this/goes/nowhere", null, null],
  ])("on %s marks %s as the current section", async (path, section, currentLink) => {
    stubFetchByUrl({ "/api/characters": [characterRecord("7", "Vex")] });
    renderTopBar(path);

    const character = screen.getByRole("button", { name: /character/i });
    const settings = screen.getByRole("link", { name: /settings/i });
    for (const [name, el] of [
      ["character", character],
      ["settings", settings],
    ] as const) {
      if (name === section) {
        expect(el).toHaveClass("text-accent-text", "font-bold");
        expect(el.querySelector("svg")).not.toHaveClass("text-muted");
        expect(el).not.toHaveClass("bg-subtle");
      } else {
        expect(el).toHaveClass("text-secondary");
        expect(el.querySelector("svg")).toHaveClass("text-muted");
      }
    }
    expect(character).not.toHaveAttribute("aria-current");
    if (section === "settings") expect(settings).toHaveAttribute("aria-current", "page");
    else expect(settings).not.toHaveAttribute("aria-current");

    fireEvent.click(character);
    await screen.findByRole("link", { name: /vex/i });
    const menuLinks = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("href")?.startsWith("/characters"));
    expect(menuLinks.map((link) => link.getAttribute("href"))).toEqual([
      "/characters/7",
      "/characters",
    ]);
    for (const link of menuLinks) {
      if (link.getAttribute("href") === currentLink)
        expect(link).toHaveAttribute("aria-current", "page");
      else expect(link).not.toHaveAttribute("aria-current");
    }
  });

  it("the Mechanics menu lists each catalog type, opening the search filtered to it", async () => {
    stubFetchByUrl({ ...noCharacters, "/api/search/types": { types: ["spell", "class"] } });
    renderTopBar();

    const mechanics = screen.getByRole("button", { name: "Mechanics" });
    fireEvent.click(mechanics);
    expect(mechanics).toHaveAttribute("aria-expanded", "true");

    const spells = await screen.findByRole("link", { name: "Spells" });
    expect(spells).toHaveAttribute("href", "/search?type=spell");
    expect(screen.getByRole("link", { name: "Classes" })).toHaveAttribute(
      "href",
      "/search?type=class",
    );
    expect(screen.getByRole("button", { name: /character/i })).toHaveAttribute(
      "aria-expanded",
      "false",
    );

    fireEvent.click(spells);
    expect(mechanics).toHaveAttribute("aria-expanded", "false");
  });

  it("the Mechanics menu offers Weapons and Armor, opening the search filtered to those kinds of item", async () => {
    stubFetchByUrl({ ...noCharacters, "/api/search/types": { types: ["item", "spell"] } });
    renderTopBar();

    fireEvent.click(screen.getByRole("button", { name: "Mechanics" }));

    expect(await screen.findByRole("link", { name: "Weapons" })).toHaveAttribute(
      "href",
      "/search?type=item&kind=melee%2Cranged",
    );
    expect(screen.getByRole("link", { name: "Armor" })).toHaveAttribute(
      "href",
      "/search?type=item&kind=light%2Cmedium%2Cheavy%2Cshield",
    );
  });

  it("marks Mechanics as the current section on the search page", () => {
    stubFetchByUrl(noCharacters);
    renderTopBar("/search");

    expect(screen.getByRole("button", { name: "Mechanics" })).toHaveClass(
      "text-accent-text",
      "font-bold",
    );
  });

  it("focusing the search closes the Character menu", () => {
    stubFetchByUrl(noCharacters);
    renderTopBar();

    const character = screen.getByRole("button", { name: /character/i });
    fireEvent.click(character);
    expect(character).toHaveAttribute("aria-expanded", "true");

    fireEvent.focus(screen.getByRole("combobox"));
    expect(character).toHaveAttribute("aria-expanded", "false");
  });

  it("Escape anywhere in the document closes the open menu", async () => {
    stubFetchByUrl(noCharacters);
    renderTopBar();

    fireEvent.click(screen.getByRole("button", { name: /character/i }));
    expect(screen.getByRole("button", { name: /character/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByRole("button", { name: /character/i })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("focusin outside the container closes the open menu", async () => {
    stubFetchByUrl(noCharacters);
    renderTopBar();

    fireEvent.click(screen.getByRole("button", { name: /character/i }));
    expect(screen.getByRole("button", { name: /character/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    fireEvent.focusIn(document.body);
    expect(screen.getByRole("button", { name: /character/i })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });
});
