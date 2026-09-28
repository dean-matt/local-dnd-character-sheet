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
  it("Character button toggles its menu without opening Settings", async () => {
    stubFetchByUrl(noCharacters);
    renderTopBar();

    const characterBtn = screen.getByRole("button", { name: /character/i });
    expect(characterBtn).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(characterBtn);
    expect(characterBtn).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: /settings/i })).toHaveAttribute(
      "aria-expanded",
      "false",
    );

    fireEvent.click(characterBtn);
    expect(characterBtn).toHaveAttribute("aria-expanded", "false");
  });

  it("Settings button toggles its menu without opening Character", async () => {
    stubFetchByUrl(noCharacters);
    renderTopBar();

    const settingsBtn = screen.getByRole("button", { name: /settings/i });
    fireEvent.click(settingsBtn);
    expect(settingsBtn).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: /character/i })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
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

    fireEvent.click(screen.getByRole("button", { name: /settings/i }));
    expect(screen.getByRole("button", { name: /settings/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    // Simulate focus moving outside the top bar.
    fireEvent.focusIn(document.body);
    expect(screen.getByRole("button", { name: /settings/i })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });
});
