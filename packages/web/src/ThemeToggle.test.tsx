import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ThemeToggle } from "./ThemeToggle.tsx";

describe("ThemeToggle", () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it("labels the control and each option", () => {
    render(<ThemeToggle />);

    expect(screen.getByRole("group", { name: "Theme" })).toBeInTheDocument();
    for (const label of ["Light", "Dark", "System"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it("marks system pressed by default", () => {
    render(<ThemeToggle />);

    expect(screen.getByRole("button", { name: "System" })).toHaveAttribute("aria-pressed", "true");
  });

  it("persists and applies the chosen override on click", () => {
    render(<ThemeToggle />);

    fireEvent.click(screen.getByRole("button", { name: "Dark" }));

    expect(screen.getByRole("button", { name: "Dark" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "System" })).toHaveAttribute("aria-pressed", "false");
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("describes what the chosen option does", () => {
    render(<ThemeToggle />);
    const group = screen.getByRole("group", { name: "Theme" });

    expect(group).toHaveAccessibleDescription("Follows your device’s light/dark setting.");

    fireEvent.click(screen.getByRole("button", { name: "Light" }));

    expect(group).toHaveAccessibleDescription("Overrides your device setting.");
  });
});
