import { fireEvent, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RulesText } from "../../components/RulesText/RulesText.tsx";
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
  const row = document.querySelector<HTMLElement>("[data-header-actions]");
  if (!row) throw new Error("header actions row not rendered");
  return row;
}

describe("CharacterLayout header actions", () => {
  it("places History and the Roll Log before Character settings, after Rest", async () => {
    const row = await renderHeaderButtons();
    await waitFor(() => expect(row.querySelectorAll("button, a").length).toBe(5));

    const names = [...row.querySelectorAll("button, a")].map(
      (el) => el.getAttribute("aria-label") ?? el.textContent,
    );
    expect(names[0]).toBe("Inspiration");
    expect(names[1]).toMatch(/Rest/);
    expect(names[2]).toMatch(/Undo Changes/);
    expect(names[3]).toMatch(/Roll Log/);
    expect(names[4]).toBe("Character settings");
  });

  it("puts every action in one non-wrapping row under a single gap", async () => {
    const row = await renderHeaderButtons();

    expect(row).toHaveClass("gap-2");
    expect(row).not.toHaveClass("flex-wrap");
    expect(row.querySelector(":scope > [data-failed]")).toBeNull();
    const spaced = [...row.children].filter((el) =>
      /(^|\s)-?m[xlr]?-/.test(el.getAttribute("class") ?? ""),
    );
    expect(spaced).toHaveLength(0);
  });

  it("leaves tab order to the document order, which is the visual order", async () => {
    const row = await renderHeaderButtons();

    const reordered = [...row.querySelectorAll("*")].filter(
      (el) => el.hasAttribute("tabindex") || /(^|\s)order-/.test(el.getAttribute("class") ?? ""),
    );
    expect(reordered).toHaveLength(0);
  });
});

describe("CharacterLayout roll log", () => {
  const roll = {
    id: 1,
    characterId: "1",
    characterName: "Vex",
    rolledAt: "2026-01-01T00:00:00.000Z",
    label: "1d4",
    notation: "1d4",
    total: 3,
    dice: [],
    modifier: 0,
    critical: false,
  };

  async function renderSheet(rolls: unknown[]) {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const bodies: Record<string, unknown> = {
        "/api/characters/1": warlockRecord(),
        "/api/characters/1/state": stateRecord(),
        "/api/characters/1/derived": derivedRecord(),
        "/api/characters/1/pages": [],
        "/api/characters/1/undo": [],
        "/api/characters/1/rolls": roll,
        "/api/rolls": rolls,
      };
      return url in bodies
        ? new Response(JSON.stringify(bodies[url]), { status: 200 })
        : new Response("{}", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const router = createMemoryRouter(
      [
        {
          path: "/characters/:id",
          element: <CharacterLayout />,
          children: [{ index: true, element: <RulesText text="{@damage 1d4}" /> }],
        },
      ],
      { initialEntries: ["/characters/1"] },
    );
    renderWithClient(<RouterProvider router={router} />);
    await screen.findByRole("heading", { level: 1, name: "Vex" });
  }

  it("opens from its header button with an empty state, and swaps with History", async () => {
    await renderSheet([]);
    const button = screen.getByRole("button", { name: "Roll Log" });
    expect(button).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(await screen.findByText("No rolls yet.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Undo Changes" }));
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("heading", { name: "Roll Log" })).not.toBeInTheDocument();
  });

  it("lists stored rolls with label, notation and total", async () => {
    await renderSheet([{ ...roll, label: "Fire Bolt", notation: "2d10", total: 14 }]);
    fireEvent.click(screen.getByRole("button", { name: "Roll Log" }));
    const item = await screen.findByRole("listitem");
    expect(item).toHaveTextContent("Fire Bolt");
    expect(item).toHaveTextContent("2d10");
    expect(item).toHaveTextContent("14");
  });

  it("tags each roll with its character, another character's included", async () => {
    await renderSheet([
      { ...roll, id: 2, characterId: "2", characterName: "Mira" },
      { ...roll, id: 1, characterName: "Vex" },
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Roll Log" }));
    const items = await screen.findAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Mira");
    expect(items[1]).toHaveTextContent("Vex");
  });

  it("opens on a rolled tag and announces the roll", async () => {
    await renderSheet([roll]);
    expect(screen.queryByRole("heading", { name: "Roll Log" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Roll 1d4" }));

    expect(await screen.findByRole("heading", { name: "Roll Log" })).toBeInTheDocument();
    expect(await screen.findByText("Rolled 1d4: 3")).toBeInTheDocument();
    expect(await screen.findByRole("listitem")).toHaveTextContent("1d4");
  });

  it("does not announce an old roll when the panel reopens", async () => {
    await renderSheet([roll]);
    fireEvent.click(screen.getByRole("button", { name: "Roll 1d4" }));
    expect(await screen.findByText("Rolled 1d4: 3")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Roll Log" }));
    fireEvent.click(screen.getByRole("button", { name: "Roll Log" }));

    expect(await screen.findByRole("heading", { name: "Roll Log" })).toHaveFocus();
    expect(screen.queryByText("Rolled 1d4: 3")).not.toBeInTheDocument();
  });

  it("leaves focus on the rolled tag when the roll opens the panel", async () => {
    await renderSheet([roll]);
    const tag = screen.getByRole("button", { name: "Roll 1d4" });
    tag.focus();
    fireEvent.click(tag);

    await screen.findByText("Rolled 1d4: 3");
    expect(screen.getByRole("heading", { name: "Roll Log" })).not.toHaveFocus();
  });
});
