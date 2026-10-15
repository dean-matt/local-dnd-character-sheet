import type { CharacterDefinition, CharacterRecord } from "@dnd/character";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterKey } from "../../hooks/characterKeys.ts";
import { useCharacter } from "../../hooks/useCharacter.ts";
import { characterRecord, identityRecord } from "../../test/records.ts";
import { NotesSection } from "./NotesSection.tsx";

type Notes = CharacterDefinition["notes"];

/**
 * Renders the section over a stand-in API that keeps what each write sends, so a write
 * lands on the sheet as it would, and returns every definition written.
 */
function renderLive(notes: Notes) {
  let stored: CharacterRecord = characterRecord("1", "Vex");
  stored.definition.notes = notes;
  const writes: CharacterDefinition[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "PUT") {
        const definition = JSON.parse(String(init.body));
        writes.push(definition);
        stored = { ...stored, definition };
      }
      return new Response(JSON.stringify(stored), { status: 200 });
    }),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(characterKey(stored.id), stored);
  function Live() {
    return <NotesSection character={useCharacter("1").data} />;
  }
  render(
    <QueryClientProvider client={client}>
      <Live />
    </QueryClientProvider>,
  );
  return writes;
}

const quests = (): Notes => [
  {
    id: "quests",
    title: "Quests",
    notes: [
      { id: "a", text: "Find the ferryman." },
      { id: "b", text: "Return the ledger." },
    ],
  },
];

function renderStatic(character: CharacterRecord) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <NotesSection character={character} />
    </QueryClientProvider>,
  );
}

const section = (name: string) => screen.getByRole("region", { name });

afterEach(() => vi.unstubAllGlobals());

describe("NotesSection", () => {
  it("shows each section's title and its notes as written, line breaks kept, or that there are none", () => {
    const { unmount } = renderStatic(identityRecord());
    const debts = section("Debts");
    expect(within(debts).getByRole("textbox", { name: "Section title" })).toHaveValue("Debts");
    expect(within(debts).getByRole("textbox", { name: "Note 1" })).toHaveValue(
      "Owes Sarth 10 gp.\nDo not trust the ferryman.",
    );
    unmount();

    renderStatic(characterRecord("1", "Vex"));
    expect(screen.getByText("No notes yet.")).toBeInTheDocument();
  });

  it("saves a retitled section and an edited note, leaving the rest as they were", async () => {
    const writes = renderLive(quests());

    const title = within(section("Quests")).getByRole("textbox", { name: "Section title" });
    fireEvent.change(title, { target: { value: "Errands" } });
    fireEvent.blur(title);
    await waitFor(() => expect(writes).toHaveLength(1));

    const note = within(section("Errands")).getByRole("textbox", { name: "Note 2" });
    fireEvent.change(note, { target: { value: "Burn the ledger.\nTell no one." } });
    fireEvent.blur(note);
    await waitFor(() => expect(writes).toHaveLength(2));

    expect(writes[1]?.notes).toEqual([
      {
        id: "quests",
        title: "Errands",
        notes: [
          { id: "a", text: "Find the ferryman." },
          { id: "b", text: "Burn the ledger.\nTell no one." },
        ],
      },
    ]);
  });

  it("adds a section and a note, each focused once it lands", async () => {
    const writes = renderLive([]);

    fireEvent.click(screen.getByRole("button", { name: "Add section" }));
    const title = await screen.findByRole("textbox", { name: "Section title" });
    await waitFor(() => expect(title).toHaveFocus());
    expect(title).toHaveValue("New section");

    fireEvent.click(within(section("New section")).getByRole("button", { name: "Add note" }));
    const note = await screen.findByRole("textbox", { name: "Note 1" });
    await waitFor(() => expect(note).toHaveFocus());

    expect(writes.at(-1)?.notes).toEqual([
      {
        id: expect.any(String),
        title: "New section",
        notes: [{ id: expect.any(String), text: "" }],
      },
    ]);
  });

  it("removes a note and then its section, moving focus to the button that adds one back", async () => {
    const writes = renderLive(quests());

    fireEvent.click(within(section("Quests")).getByRole("button", { name: "Remove note 1" }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]?.notes[0]?.notes).toEqual([{ id: "b", text: "Return the ledger." }]);
    expect(within(section("Quests")).getByRole("button", { name: "Add note" })).toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: "Remove section Quests" }));
    await waitFor(() => expect(writes).toHaveLength(2));
    expect(writes[1]?.notes).toEqual([]);
    expect(await screen.findByText("No notes yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add section" })).toHaveFocus();
  });

  it("sets Add note in the same type and icon size as Add section, hidden in print", () => {
    renderStatic(identityRecord());
    const addSection = screen.getByRole("button", { name: "Add section" });
    const addNote = within(section("Debts")).getByRole("button", { name: "Add note" });
    for (const button of [addSection, addNote]) {
      expect(button).toHaveClass("text-label", "print:hidden");
      expect(button.querySelector("svg")).toHaveAttribute("width", "12");
    }
  });

  it("lists what the character holds off the rules, and draws nothing where it holds nothing", () => {
    const record = characterRecord("1", "Vex");
    const departure = { field: "abilityScores.str", note: "20 at level 1" };
    const { unmount } = renderStatic({
      ...record,
      definition: { ...record.definition, departures: [departure] },
    });
    const offBook = screen.getByRole("region", { name: "Off the rules" });
    expect(within(offBook).getByRole("listitem")).toHaveTextContent(
      "Ability scores — 20 at level 1",
    );
    unmount();

    renderStatic(record);
    expect(screen.queryByRole("region", { name: "Off the rules" })).not.toBeInTheDocument();
  });
});
