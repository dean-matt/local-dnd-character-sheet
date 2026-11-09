import { screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { derivedRecord, stateRecord, warlockRecord } from "../../test/records.ts";
import { renderWithClient } from "../../test/renderWithClient.tsx";
import { stubFetchByUrl } from "../../test/stubFetch.ts";
import { CharacterLayout } from "./CharacterLayout.tsx";

afterEach(() => vi.unstubAllGlobals());

async function renderHeaderButtons() {
  stubFetchByUrl({
    "/api/characters/1": warlockRecord(),
    "/api/characters/1/state": stateRecord(),
    "/api/characters/1/derived": derivedRecord(),
    "/api/characters/1/pages": [],
  });
  const router = createMemoryRouter(
    [{ path: "/characters/:id", element: <CharacterLayout />, children: [{ index: true }] }],
    { initialEntries: ["/characters/1"] },
  );
  renderWithClient(<RouterProvider router={router} />);
  await screen.findByRole("heading", { level: 1, name: "Vex" });
  return document.querySelector<HTMLElement>("[data-character-header] > div:last-child");
}

describe("CharacterLayout header actions", () => {
  it("places History directly before Character settings, after Rest", async () => {
    const row = await renderHeaderButtons();
    await waitFor(() => expect(row?.querySelectorAll("button, a").length).toBe(4));

    const names = [...(row?.querySelectorAll("button, a") ?? [])].map(
      (el) => el.getAttribute("aria-label") ?? el.textContent,
    );
    expect(names[0]).toBe("Inspiration");
    expect(names[1]).toMatch(/Rest/);
    expect(names[2]).toMatch(/Undo Changes/);
    expect(names[3]).toBe("Character settings");
  });

  it("puts every action in one row under a single gap, so gaps stay equal when it wraps", async () => {
    const row = await renderHeaderButtons();

    expect(row).toHaveClass("flex-wrap", "gap-2");
    const spaced = [...(row?.children ?? [])].filter((el) =>
      /(^|\s)-?m[xlr]?-/.test(el.getAttribute("class") ?? ""),
    );
    expect(spaced).toHaveLength(0);
  });

  it("leaves tab order to the document order, which is the visual order", async () => {
    const row = await renderHeaderButtons();

    const reordered = [...(row?.querySelectorAll("*") ?? [])].filter(
      (el) => el.hasAttribute("tabindex") || /(^|\s)order-/.test(el.getAttribute("class") ?? ""),
    );
    expect(reordered).toHaveLength(0);
  });
});
