import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UndoToHereDialog } from "./UndoToHereDialog.tsx";

const dialog = (undoes: number, onConfirm = vi.fn()) =>
  render(
    <UndoToHereDialog
      describedAs="Name Vex to Nyx"
      newer={0}
      undoes={undoes}
      pending={false}
      error={null}
      onConfirm={onConfirm}
      onClose={() => {}}
    />,
  );

describe("UndoToHereDialog", () => {
  it("names the one entry it undoes and its count", () => {
    dialog(1);
    const shown = screen.getByRole("dialog", { name: "Undo 1 change?" });
    expect(shown).toHaveTextContent("This undoes “Name Vex to Nyx”, 1 change in all");
  });

  it("refuses to confirm once the entry has left the history", () => {
    const onConfirm = vi.fn();
    dialog(0, onConfirm);
    screen.getByRole("dialog", { name: "Change no longer in the history" });

    const undo = screen.getByRole("button", { name: "Undo" });
    expect(undo).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(undo);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
