import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { AccentPicker } from "./AccentPicker.tsx";

const rootAccent = () => document.documentElement.style.getPropertyValue("--accent");

describe("AccentPicker", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("style");
  });

  it("offers the five presets and a custom color, Red pressed by default", () => {
    render(<AccentPicker />);

    expect(screen.getByRole("group", { name: "Accent color" })).toBeInTheDocument();
    for (const name of ["Red", "Orange", "Green", "Blue", "Plum"]) {
      expect(screen.getByRole("button", { name: `${name} accent` })).toBeInTheDocument();
    }
    expect(screen.getByLabelText("Custom accent color")).toHaveValue("#c1272d");
    expect(screen.getByRole("button", { name: "Red accent" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("applies and persists a preset on click", () => {
    render(<AccentPicker />);

    fireEvent.click(screen.getByRole("button", { name: "Plum accent" }));

    expect(screen.getByRole("button", { name: "Plum accent" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(rootAccent()).toBe("#7a3b53");
    expect(JSON.parse(localStorage.getItem("accent") ?? "null")).toMatchObject({
      color: "#7a3b53",
    });
  });

  it("applies a custom color that clears contrast", () => {
    render(<AccentPicker />);

    fireEvent.change(screen.getByLabelText("Custom accent color"), {
      target: { value: "#1b5e20" },
    });

    expect(rootAccent()).toBe("#1b5e20");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("refuses a custom color that fails contrast, keeping the accent and saying why", () => {
    render(<AccentPicker />);
    const input = screen.getByLabelText("Custom accent color");

    fireEvent.change(input, { target: { value: "#ffeb3b" } });

    expect(rootAccent()).toBe("");
    expect(localStorage.getItem("accent")).toBeNull();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(/^Too light for the light theme/);
  });
});
