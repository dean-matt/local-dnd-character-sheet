import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Swords, Trash2 } from "lucide-react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { Sidebar } from "./Sidebar.tsx";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function renderSidebar(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar
        label="Kinds"
        items={[{ to: "/k/items", label: "Items", icon: Swords }]}
        footerItems={[{ to: "/k/deleted", label: "Recently deleted", icon: Trash2 }]}
      />
    </MemoryRouter>,
  );
}

describe("Sidebar footer items", () => {
  it("lists them apart from the items, below them", () => {
    renderSidebar("/k/items");

    const items = screen.getByRole("navigation", { name: "Kinds" });
    const footer = screen.getByRole("navigation", { name: "Kinds footer" });
    expect(within(items).queryByText("Recently deleted")).toBeNull();
    expect(within(footer).getByRole("link", { name: "Recently deleted" })).toHaveAttribute(
      "href",
      "/k/deleted",
    );
    expect(items.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("marks the open one and keeps its icon when collapsed", () => {
    renderSidebar("/k/deleted");
    const link = screen.getByRole("link", { name: "Recently deleted" });
    expect(link).toHaveAttribute("aria-current", "page");

    fireEvent.click(screen.getByRole("button", { name: /collapse/i }));

    const collapsed = screen.getByRole("link", { name: "Recently deleted" });
    expect(collapsed.querySelector("svg")).not.toBeNull();
    expect(collapsed).not.toHaveTextContent("Recently deleted");
  });
});
