import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RulesText } from "../../components/RulesText/RulesText.tsx";
import { characterRecord, derivedRecord, stateRecord, warlockRecord } from "../../test/records.ts";
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

  async function renderSheet(
    rolls: unknown[],
    characters: unknown[] = [warlockRecord(), characterRecord("2", "Mira")],
  ) {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const bodies: Record<string, unknown> = {
        "/api/characters/1": warlockRecord(),
        "/api/characters/1/state": stateRecord(),
        "/api/characters/1/derived": derivedRecord(),
        "/api/characters/1/pages": [],
        "/api/characters/1/undo": [],
        "/api/characters/1/rolls": roll,
        "/api/characters/2": characterRecord("2", "Mira"),
        "/api/characters/2/state": stateRecord(),
        "/api/characters/2/derived": derivedRecord(),
        "/api/characters/2/pages": [],
        "/api/characters": characters,
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
    return router;
  }

  const labels = () =>
    [...document.querySelectorAll("ol > li")].map(
      (item) => item.querySelector(".font-bold")?.textContent,
    );
  async function openFilter() {
    fireEvent.click(screen.getByRole("button", { name: "Roll Log" }));
    await screen.findAllByRole("listitem");
    fireEvent.click(screen.getByRole("button", { name: /^Filter Roll Log/ }));
  }
  async function pickCharacter(option: string) {
    fireEvent.click(screen.getByRole("combobox", { name: "Character" }));
    fireEvent.click(await screen.findByRole("option", { name: option }));
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

  it("lists a roll stored before rolls carried a type beside a typed one", async () => {
    await renderSheet([
      { ...roll, id: 2, label: "Longsword attack", type: "attack" },
      { ...roll, id: 1, label: "Old roll" },
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Roll Log" }));
    const items = await screen.findAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Longsword attack");
    expect(items[1]).toHaveTextContent("Old roll");
  });

  it("tags each roll with its character, another character's included", async () => {
    await renderSheet([
      { ...roll, id: 2, characterId: "2", characterName: "Mira" },
      { ...roll, id: 1, characterName: "Vex" },
    ]);
    await openFilter();
    await pickCharacter("All characters");
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

  describe("roll type filter", () => {
    const LOG = [
      { ...roll, id: 4, label: "Longsword attack", type: "attack" },
      { ...roll, id: 3, label: "Longsword damage", type: "damage" },
      { ...roll, id: 2, label: "Fire Bolt damage", type: "spell-damage" },
      { ...roll, id: 1, label: "Old roll" },
    ];
    async function addType(option: string) {
      fireEvent.click(screen.getByRole("combobox", { name: "Add roll type" }));
      fireEvent.click(await screen.findByRole("option", { name: option }));
    }

    it("offers each roll type a player picks between, showing all until one is picked", async () => {
      await renderSheet(LOG);
      await openFilter();
      expect(screen.getByText("Showing all")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("combobox", { name: "Add roll type" }));
      const options = (await screen.findAllByRole("option")).map((option) => option.textContent);
      expect(options).toEqual([
        "Add roll type…",
        "Attack",
        "Damage",
        "Check",
        "Save",
        "Spell attack",
        "Spell damage",
      ]);
    });

    it("shows a roll of any picked type, hides an untyped roll, and offers a pick no more", async () => {
      await renderSheet(LOG);
      await openFilter();
      await addType("Attack");
      expect(labels()).toEqual(["Longsword attack"]);
      await addType("Spell damage");
      expect(labels()).toEqual(["Longsword attack", "Fire Bolt damage"]);
      expect(
        screen.getByRole("button", { name: "Filter Roll Log (2 active)" }),
      ).toBeInTheDocument();

      fireEvent.click(screen.getByRole("combobox", { name: "Add roll type" }));
      expect(screen.queryByRole("option", { name: "Attack" })).toBeNull();
      fireEvent.keyDown(screen.getByRole("combobox", { name: "Add roll type" }), { key: "Escape" });

      fireEvent.click(screen.getByRole("button", { name: "Remove Attack" }));
      expect(labels()).toEqual(["Fire Bolt damage"]);
      fireEvent.click(screen.getByRole("button", { name: "Remove Spell damage" }));
      expect(screen.getByText("Showing all")).toBeInTheDocument();
      expect(labels()).toHaveLength(4);
    });

    it("resets to the whole log", async () => {
      await renderSheet(LOG);
      await openFilter();
      await addType("Save");
      fireEvent.click(screen.getByRole("button", { name: "Reset" }));
      expect(screen.getByText("Showing all")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Filter Roll Log" })).toBeInTheDocument();
      expect(labels()).toHaveLength(4);
    });

    it("says nothing matches when the filter empties the log, apart from a log with no rolls", async () => {
      await renderSheet(LOG);
      await openFilter();
      await addType("Check");
      expect(screen.getByText("Nothing matches the filter.")).toBeInTheDocument();
      expect(screen.queryByText("No rolls yet.")).toBeNull();
    });

    it("is driven from the keyboard, and Escape returns focus to the Filter button", async () => {
      await renderSheet(LOG);
      fireEvent.click(screen.getByRole("button", { name: "Roll Log" }));
      await screen.findAllByRole("listitem");
      const button = screen.getByRole("button", { name: "Filter Roll Log (1 active)" });
      button.focus();
      fireEvent.click(button);
      const select = screen.getByRole("combobox", { name: "Add roll type" });
      select.focus();
      fireEvent.keyDown(select, { key: "ArrowDown" });
      fireEvent.keyDown(select, { key: "ArrowDown" });
      fireEvent.keyDown(select, { key: "Enter" });
      expect(labels()).toEqual(["Longsword attack"]);

      fireEvent.keyDown(screen.getByRole("button", { name: "Remove Attack" }), { key: "Escape" });
      expect(screen.queryByRole("group", { name: "Roll Log filter" })).toBeNull();
      expect(screen.getByRole("button", { name: "Filter Roll Log (2 active)" })).toHaveFocus();
    });

    it("shows the whole log after a remount", async () => {
      await renderSheet(LOG);
      await openFilter();
      await addType("Attack");
      expect(labels()).toHaveLength(1);

      cleanup();
      await renderSheet(LOG);
      fireEvent.click(screen.getByRole("button", { name: "Roll Log" }));
      await screen.findAllByRole("listitem");
      expect(labels()).toHaveLength(4);
      expect(
        screen.getByRole("button", { name: "Filter Roll Log (1 active)" }),
      ).toBeInTheDocument();
    });
  });

  describe("character filter", () => {
    const LOG = [
      {
        ...roll,
        id: 4,
        label: "Mira attack",
        type: "attack",
        characterId: "2",
        characterName: "Mira",
      },
      { ...roll, id: 3, label: "Mira save", type: "save", characterId: "2", characterName: "Mira" },
      { ...roll, id: 2, label: "Vex attack", type: "attack" },
      { ...roll, id: 1, label: "Vex save", type: "save" },
    ];

    it("offers every character and All characters, set to the open character", async () => {
      await renderSheet(LOG);
      await openFilter();
      const select = screen.getByRole("combobox", { name: "Character" });
      expect(select).toHaveTextContent("Vex");
      expect(labels()).toEqual(["Vex attack", "Vex save"]);
      fireEvent.click(select);
      const options = (await screen.findAllByRole("option")).map((option) => option.textContent);
      expect(options).toEqual(["All characters", "Vex", "Mira"]);
    });

    it("lists one character's rolls, or every character's", async () => {
      await renderSheet(LOG);
      await openFilter();
      await pickCharacter("Mira");
      expect(labels()).toEqual(["Mira attack", "Mira save"]);
      await pickCharacter("All characters");
      expect(labels()).toEqual(["Mira attack", "Mira save", "Vex attack", "Vex save"]);
      expect(screen.getByRole("button", { name: "Filter Roll Log" })).toBeInTheDocument();
    });

    it("shows a roll only where it matches both the character and the roll type", async () => {
      await renderSheet(LOG);
      await openFilter();
      fireEvent.click(screen.getByRole("combobox", { name: "Add roll type" }));
      fireEvent.click(await screen.findByRole("option", { name: "Attack" }));
      expect(labels()).toEqual(["Vex attack"]);
      await pickCharacter("Mira");
      expect(labels()).toEqual(["Mira attack"]);
    });

    it("re-sets to the newly open character, replacing the choice made for the last", async () => {
      const router = await renderSheet(LOG);
      await openFilter();
      await pickCharacter("All characters");
      expect(labels()).toHaveLength(4);

      await router.navigate("/characters/2");
      await screen.findByRole("heading", { level: 1, name: "Mira" });
      await waitFor(() => expect(labels()).toEqual(["Mira attack", "Mira save"]));
      expect(screen.getByRole("combobox", { name: "Character" })).toHaveTextContent("Mira");
    });

    it("offers the characters that exist now", async () => {
      await renderSheet(LOG, [warlockRecord(), characterRecord("3", "Thorn")]);
      await openFilter();
      fireEvent.click(screen.getByRole("combobox", { name: "Character" }));
      const options = (await screen.findAllByRole("option")).map((option) => option.textContent);
      expect(options).toEqual(["All characters", "Vex", "Thorn"]);
    });

    it("starts back at the open character after a remount", async () => {
      await renderSheet(LOG);
      await openFilter();
      await pickCharacter("All characters");

      cleanup();
      await renderSheet(LOG);
      await openFilter();
      expect(screen.getByRole("combobox", { name: "Character" })).toHaveTextContent("Vex");
      expect(labels()).toEqual(["Vex attack", "Vex save"]);
    });
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
