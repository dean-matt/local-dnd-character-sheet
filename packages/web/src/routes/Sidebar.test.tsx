import { fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import { presetPageRecords } from "../test/records.ts";
import { CharacterSidebar } from "./Sidebar.tsx";

function renderSidebar() {
  const ref = createRef<HTMLButtonElement>();
  const pages = presetPageRecords().filter((p) => !p.hidden);
  const { unmount } = render(
    <MemoryRouter>
      <CharacterSidebar characterId="abc" pages={pages} onManage={() => {}} manageButtonRef={ref} />
    </MemoryRouter>,
  );
  return unmount;
}

afterEach(() => {
  localStorage.removeItem("sidebar-collapsed");
});

describe("CharacterSidebar", () => {
  it("starts expanded and collapses on click, persisting to localStorage", () => {
    renderSidebar();

    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument();
    expect(screen.getByText("Stats")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));

    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument();
    expect(screen.queryByText("Stats")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Stats" })).toBeInTheDocument();
    expect(localStorage.getItem("sidebar-collapsed")).toBe("true");
  });

  it("starts collapsed when localStorage says so", () => {
    localStorage.setItem("sidebar-collapsed", "true");
    renderSidebar();

    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeInTheDocument();
    expect(screen.queryByText("Stats")).not.toBeInTheDocument();
  });

  it("spans the rail with the collapse button, expanded and collapsed", () => {
    renderSidebar();
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toHaveClass("w-full");

    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toHaveClass("w-full");
  });
});
