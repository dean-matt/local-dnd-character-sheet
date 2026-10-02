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
});
