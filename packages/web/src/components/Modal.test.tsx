import { fireEvent, render, screen } from "@testing-library/react";
import { type ReactNode, useContext } from "react";
import { createPortal } from "react-dom";
import { describe, expect, it, vi } from "vitest";
import { InModal } from "./inModalContext.ts";
import { Modal } from "./Modal.tsx";
import { ModalEntry } from "./ModalEntry.tsx";

describe("Modal", () => {
  it("scrolls the body alone, with the header and footer outside it", () => {
    render(
      <Modal onClose={() => {}}>
        <ModalEntry
          title="Fireball"
          badge="Spell"
          meta="PHB"
          footer={<button type="button">Add to…</button>}
        >
          <p>Rules text</p>
        </ModalEntry>
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
      screen.getByRole("button", { name: "Back" }),
      screen.getByRole("button", { name: "Add to…" }),
    ]) {
      expect(body).not.toContainElement(fixed);
    }
  });

  it("cancels only the modal Escape lands on, not one it opened over", () => {
    const outer = vi.fn();
    const inner = vi.fn();
    render(
      <Modal onClose={outer}>
        <ModalEntry title="Outer">
          {createPortal(
            <Modal onClose={inner}>
              <ModalEntry title="Inner">text</ModalEntry>
            </Modal>,
            document.body,
          )}
        </ModalEntry>
      </Modal>,
    );

    fireEvent(screen.getByRole("dialog", { name: "Inner" }), new Event("cancel"));
    expect(inner).toHaveBeenCalledOnce();
    expect(outer).not.toHaveBeenCalled();
  });

  it("opens an entry from inside it in place of the one showing, and steps back through them", () => {
    const onClose = vi.fn();
    render(
      <Modal onClose={onClose}>
        <ModalEntry title="Wand of Fireballs">
          <OpensEntry title="Fireball">
            <OpensEntry title="Burning">burns</OpensEntry>
          </OpensEntry>
        </ModalEntry>
      </Modal>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open Fireball" }));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByRole("dialog", { name: "Fireball" })).toBeInTheDocument();
    expect(screen.queryByText("Wand of Fireballs")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Open Burning" }));
    expect(screen.getByRole("dialog", { name: "Burning" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Back to Fireball" }));
    expect(screen.getByRole("dialog", { name: "Fireball" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back to Wand of Fireballs" }));
    expect(screen.getByRole("dialog", { name: "Wand of Fireballs" })).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it.each([
    ["the close button", () => fireEvent.click(screen.getByRole("button", { name: "Close" }))],
    ["Escape", () => fireEvent(screen.getByRole("dialog"), new Event("cancel"))],
  ])("closes from a later entry by %s", (_how, close) => {
    const onClose = vi.fn();
    render(
      <Modal onClose={onClose}>
        <ModalEntry title="Wand of Fireballs">
          <OpensEntry title="Fireball">text</OpensEntry>
        </ModalEntry>
      </Modal>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open Fireball" }));

    close();
    expect(onClose).toHaveBeenCalledOnce();
  });
});

/** A link that opens a `title` entry holding `children` in the modal it sits in. */
function OpensEntry({ title, children }: { title: string; children: ReactNode }) {
  const modal = useContext(InModal);
  return (
    <button
      type="button"
      onClick={() => modal?.open(<ModalEntry title={title}>{children}</ModalEntry>)}
    >
      Open {title}
    </button>
  );
}
