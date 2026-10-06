import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { characterRecord, identityRecord } from "../../test/records.ts";
import { NotesSection } from "./NotesSection.tsx";

describe("NotesSection", () => {
  it("shows the notes as written, line breaks kept, or that there are none", () => {
    const { unmount } = render(<NotesSection character={identityRecord()} />);
    const text = within(screen.getByRole("region", { name: "Notes" })).getByText(/Owes Sarth/);
    expect(text.textContent).toBe("Owes Sarth 10 gp.\nDo not trust the ferryman.");
    expect(text).toHaveClass("whitespace-pre-wrap");
    unmount();

    render(<NotesSection character={characterRecord("1", "Vex")} />);
    expect(screen.getByText("No notes yet.")).toBeInTheDocument();
  });

  it("lists what the character holds off the rules, and draws nothing where it holds nothing", () => {
    const record = characterRecord("1", "Vex");
    const departure = { field: "abilityScores.str", note: "20 at level 1" };
    const { unmount } = render(
      <NotesSection
        character={{ ...record, definition: { ...record.definition, departures: [departure] } }}
      />,
    );
    const offBook = screen.getByRole("region", { name: "Off the rules" });
    expect(within(offBook).getByRole("listitem")).toHaveTextContent(
      "Ability scores — 20 at level 1",
    );
    unmount();

    render(<NotesSection character={record} />);
    expect(screen.queryByRole("region", { name: "Off the rules" })).not.toBeInTheDocument();
  });
});
