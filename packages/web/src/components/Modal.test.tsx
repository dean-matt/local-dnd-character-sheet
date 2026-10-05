import { act, fireEvent, render, screen } from "@testing-library/react";
import { createPortal } from "react-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Modal } from "./Modal.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

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
    const [body] = scrolling;
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

  it("grows once the header and footer leave the body less room than they take", () => {
    let resized = () => {};
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          resized = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
    const height = (body: number, chrome: number) => {
      vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(body);
      vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(1000);
      vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(chrome / 2);
    };
    render(
      <Modal title="Fireball" footer="Add to…" width="w-140" onClose={() => {}}>
        text
      </Modal>,
    );
    const dialog = screen.getByRole("dialog", { name: "Fireball" });

    height(200, 150);
    act(() => resized());
    expect(dialog).toHaveClass("w-140");

    height(100, 150);
    act(() => resized());
    expect(dialog).not.toHaveClass("w-140");
    expect(dialog).toHaveClass("w-4xl");
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
