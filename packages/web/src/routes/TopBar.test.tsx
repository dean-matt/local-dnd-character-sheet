import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stubFetchByUrl } from "../test/stubFetch.ts";
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
    ["/characters", "character"],
    ["/characters/7", "character"],
    ["/characters/7/p/combat", "character"],
    ["/settings", "settings"],
    ["/", null],
    ["/catalog/spells", null],
  ])("on %s marks %s as the current section", (path, section) => {
    stubFetchByUrl(noCharacters);
    renderTopBar(path);

    const character = screen.getByRole("button", { name: /character/i });
    const settings = screen.getByRole("link", { name: /settings/i });
    for (const [name, el] of [
      ["character", character],
      ["settings", settings],
    ] as const) {
      if (name === section) {
        expect(el).toHaveAttribute("aria-current", "page");
        expect(el).toHaveClass("text-accent", "font-bold");
        expect(el).not.toHaveClass("bg-subtle");
      } else {
        expect(el).not.toHaveAttribute("aria-current");
        expect(el).toHaveClass("text-secondary");
      }
    }
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
