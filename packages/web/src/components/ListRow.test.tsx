import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ListRow } from "./ListRow.tsx";
import { Tag } from "./Tag.tsx";

function renderRow() {
  render(
    <ul>
      <ListRow
        name="Longsword"
        chips={<Tag>Martial</Tag>}
        value="15 gp"
        preview="A versatile blade."
        detail={{ meta: "Weapon", children: <p>Full rules text.</p> }}
      />
    </ul>,
  );
}

const nativeShowModal = HTMLDialogElement.prototype.showModal;

afterEach(() => {
  HTMLDialogElement.prototype.showModal = nativeShowModal;
});

describe("ListRow", () => {
  it("shows the chips, the value and a preview of the text, with no modal", () => {
    renderRow();

    const row = screen.getByRole("listitem");
    expect(row).toHaveTextContent("Martial");
    expect(row).toHaveTextContent("15 gp");
    expect(row).toHaveTextContent("A versatile blade.");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps the preview off the printed page", () => {
    renderRow();

    expect(screen.getByText("A versatile blade.")).toHaveClass("print:hidden");
  });

  it("opens the detail from the name, with the title, meta line and full text", () => {
    renderRow();

    fireEvent.click(screen.getByRole("button", { name: "Longsword" }));

    const modal = within(screen.getByRole("dialog", { name: "Longsword" }));
    expect(modal.getByRole("heading", { level: 2, name: "Longsword" })).toBeInTheDocument();
    expect(modal.getByText("Weapon")).toBeInTheDocument();
    expect(modal.getByText("Full rules text.")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveClass("print:hidden");
  });

  it("closes on ×, then returns focus to the name", async () => {
    renderRow();
    const name = screen.getByRole("button", { name: "Longsword" });
    fireEvent.click(name);

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(name).toHaveFocus());
  });

  it("closes on Escape, then returns focus to the name", async () => {
    renderRow();
    const name = screen.getByRole("button", { name: "Longsword" });
    fireEvent.click(name);

    const cancel = new Event("cancel", { cancelable: true });
    fireEvent(screen.getByRole("dialog"), cancel);

    expect(cancel.defaultPrevented).toBe(true);
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(name).toHaveFocus());
  });

  it("opens the dialog as a modal so the browser traps focus", () => {
    const showModal = vi.fn();
    HTMLDialogElement.prototype.showModal = showModal;
    renderRow();

    fireEvent.click(screen.getByRole("button", { name: "Longsword" }));

    expect(showModal).toHaveBeenCalledOnce();
  });

  it("is plain text where there is no detail to open", () => {
    render(
      <ul>
        <ListRow name="Net (PHB)" chips={<Tag>Not found in the catalog</Tag>} />
      </ul>,
    );

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Net (PHB)")).toBeInTheDocument();
  });
});
