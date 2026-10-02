import { fireEvent, render, screen } from "@testing-library/react";
import { createPortal } from "react-dom";
import { describe, expect, it, vi } from "vitest";
import { Modal } from "./Modal.tsx";

describe("Modal", () => {
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
