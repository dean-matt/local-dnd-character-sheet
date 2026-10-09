import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { avatarColor } from "../../lib/avatarColor.ts";
import { warlockRecord } from "../../test/records.ts";
import { CharacterHeader } from "./CharacterHeader.tsx";

describe("CharacterHeader", () => {
  it("capitalizes the initial of a lowercase name and keeps a whole astral character", () => {
    const { container, rerender } = render(
      <CharacterHeader character={{ ...warlockRecord(), name: "vex" }} />,
    );
    expect(container.querySelector("[aria-hidden='true']")).toHaveTextContent("V");

    rerender(<CharacterHeader character={{ ...warlockRecord(), name: "\u{1D504}nna" }} />);
    expect(container.querySelector("[aria-hidden='true']")).toHaveTextContent("\u{1D504}");
  });

  it("titles the page with the character's name above their subtitle", () => {
    render(<CharacterHeader character={warlockRecord()} />);

    expect(screen.getByRole("heading", { level: 1, name: "Vex" })).toBeInTheDocument();
    expect(screen.getByText("Lv. 3 · Half-Elf · Warlock")).toBeInTheDocument();
  });

  it("draws the initial in a color derived from the id, hidden from a screen reader", () => {
    const { container } = render(<CharacterHeader character={warlockRecord()} />);

    const avatar = container.querySelector<HTMLElement>("[aria-hidden='true']");
    expect(avatar).toHaveTextContent("V");
    expect(avatar).toHaveStyle({ background: avatarColor("1") });
  });

  it("carries the full name and subtitle on hover, for when they truncate", () => {
    render(<CharacterHeader character={warlockRecord()} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveAttribute("title", "Vex");
    expect(screen.getByText("Lv. 3 · Half-Elf · Warlock")).toHaveAttribute(
      "title",
      "Lv. 3 · Half-Elf · Warlock",
    );
  });

  it("names the character's edition as its year's rules", () => {
    const { rerender } = render(<CharacterHeader character={warlockRecord()} />);
    const year = screen.getByTitle("This character uses the 2024 rules");
    expect(year).toHaveTextContent(/^2024$/);
    expect(year).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("2024 rules")).toHaveClass("sr-only");

    rerender(<CharacterHeader character={{ ...warlockRecord(), edition: "classic" }} />);
    expect(screen.getByTitle("This character uses the 2014 rules")).toHaveTextContent(/^2014$/);
    expect(screen.getByText("2014 rules")).toHaveClass("sr-only");
  });

  it("leaves the printed page to the print title", () => {
    const { container } = render(<CharacterHeader character={warlockRecord()} />);
    expect(container.firstElementChild).toHaveClass("print:hidden");
  });
});
