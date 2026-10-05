import { fireEvent, render, screen } from "@testing-library/react";
import { createPortal } from "react-dom";
import { describe, expect, it, vi } from "vitest";
import { Modal } from "./Modal.tsx";

describe("Modal", () => {
  it("scrolls the body alone, with the header and footer outside it", () => {
    render(
      <Modal
        title="Fireball"
        badge="Spell"
        meta="PHB"
        footer={<button type="button">Add to…</button>}
        onClose={() => {}}
      >
        <p>Rules text</p>
      </Modal>,
    );

    const dialog = screen.getByRole("dialog", { name: "Fireball" });
    const scrolling = dialog.querySelectorAll(".overflow-auto");
    expect(scrolling).toHaveLength(1);
    const body = screen.getByRole("region", { name: "Fireball" });
    expect(scrolling[0]).toBe(body);
    expect(body).toHaveAttribute("tabindex", "0");
    expect(body).toContainElement(screen.getByText("Rules text"));
    for (const fixed of [
      screen.getByRole("heading", { name: "Fireball" }),
      screen.getByText("Spell"),
      screen.getByText("PHB"),
      screen.getByRole("button", { name: "Close" }),
      screen.getByRole("button", { name: "Add to…" }),
    ]) {
      expect(body).not.toContainElement(fixed);
    }
  });

  it("cancels only the modal Escape lands on, not one it opened over", () => {
    const outer = vi.fn();
    const inner = vi.fn();
    render(
      <Modal title="Outer" onClose={outer}>
        {createPortal(
          <Modal title="Inner" onClose={inner}>
            text
          </Modal>,
          document.body,
        )}
      </Modal>,
    );

    fireEvent(screen.getByRole("dialog", { name: "Inner" }), new Event("cancel"));
    expect(inner).toHaveBeenCalledOnce();
    expect(outer).not.toHaveBeenCalled();
  });
});
