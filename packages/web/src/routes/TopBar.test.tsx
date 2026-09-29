import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stubFetchByUrl } from "../test/stubFetch.ts";
import { TopBar } from "./TopBar.tsx";

const noCharacters = { "/api/characters": [] };

function renderTopBar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
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

    fireEvent.click(characterBtn);
    expect(characterBtn).toHaveAttribute("aria-expanded", "false");
  });

  it("Settings links to the Settings page", () => {
    stubFetchByUrl(noCharacters);
    renderTopBar();

    expect(screen.getByRole("link", { name: /settings/i })).toHaveAttribute("href", "/settings");
    expect(screen.getByRole("link", { name: /settings/i })).not.toHaveAttribute("aria-current");
    expect(screen.queryByRole("group", { name: "Theme" })).not.toBeInTheDocument();
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
