import type { CharacterRecord } from "@dnd/character";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { avatarColor } from "../lib/avatarColor.ts";
import { characterRecord } from "../test/records.ts";
import { CharacterHeader, characterSubtitle, PrintTitle } from "./CharacterHeader.tsx";

const WARLOCK = { name: "Warlock", source: "XPHB" };
const WIZARD = { name: "Wizard", source: "XPHB" };
const FIEND = { name: "Fiend Patron", source: "XPHB" };

function warlock(): CharacterRecord {
  const record = characterRecord("1", "Vex");
  return {
    ...record,
    level: 3,
    definition: {
      ...record.definition,
      levels: [{ class: WARLOCK }, { class: WARLOCK }, { class: WARLOCK, subclass: FIEND }],
    },
  };
}

describe("characterSubtitle", () => {
  it("reads race, class with level and subclass, then background", () => {
    expect(characterSubtitle(warlock())).toBe("Half-Elf Warlock 3 (Fiend Patron) • Charlatan");
  });

  it("joins a multiclass character's classes", () => {
    const record = warlock();
    const levels = [{ class: WARLOCK }, { class: WIZARD }];
    expect(characterSubtitle({ ...record, definition: { ...record.definition, levels } })).toBe(
      "Half-Elf Warlock 1 / Wizard 1 • Charlatan",
    );
  });

  it("leaves out the class segment for a character with no levels", () => {
    const record = warlock();
    const definition = { ...record.definition, levels: [] };
    expect(characterSubtitle({ ...record, definition })).toBe("Half-Elf • Charlatan");
  });

  it("adds an alignment and a deity, the deity with its pantheon, once they are set", () => {
    const record = warlock();
    const definition = {
      ...record.definition,
      alignment: "Chaotic Good" as const,
      deity: { name: "Oghma", source: "PHB", pantheon: "Celtic" },
    };
    expect(characterSubtitle({ ...record, definition })).toBe(
      "Half-Elf Warlock 3 (Fiend Patron) • Charlatan • Chaotic Good • Oghma (Celtic)",
    );

    const realms = { ...definition, deity: { ...definition.deity, pantheon: "Forgotten Realms" } };
    expect(characterSubtitle({ ...record, definition: realms })).toContain(
      "Oghma (Forgotten Realms)",
    );
  });
});

describe("CharacterHeader", () => {
  it("capitalizes the initial of a lowercase name and keeps a whole astral character", () => {
    const { container, rerender } = render(
      <CharacterHeader character={{ ...warlock(), name: "vex" }} />,
    );
    expect(container.querySelector("[aria-hidden='true']")).toHaveTextContent("V");

    rerender(<CharacterHeader character={{ ...warlock(), name: "\u{1D504}nna" }} />);
    expect(container.querySelector("[aria-hidden='true']")).toHaveTextContent("\u{1D504}");
  });

  it("titles the page with the character's name above their subtitle", () => {
    render(<CharacterHeader character={warlock()} />);

    expect(screen.getByRole("heading", { level: 1, name: "Vex" })).toBeInTheDocument();
    expect(screen.getByText(/^Half-Elf Warlock 3/)).toBeInTheDocument();
  });

  it("draws the initial in a color derived from the id, hidden from a screen reader", () => {
    const { container } = render(<CharacterHeader character={warlock()} />);

    const avatar = container.querySelector<HTMLElement>("[aria-hidden='true']");
    expect(avatar).toHaveTextContent("V");
    expect(avatar).toHaveStyle({ background: avatarColor("1") });
  });

  it("carries the full name and subtitle on hover, for when they truncate", () => {
    render(<CharacterHeader character={warlock()} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveAttribute("title", "Vex");
    expect(screen.getByText(/^Half-Elf Warlock 3/)).toHaveAttribute(
      "title",
      characterSubtitle(warlock()),
    );
  });

  it("names the character's edition as its year's rules", () => {
    const { rerender } = render(<CharacterHeader character={warlock()} />);
    const year = screen.getByTitle("This character uses the 2024 rules");
    expect(year).toHaveTextContent(/^2024$/);
    expect(year).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("2024 rules")).toHaveClass("sr-only");

    rerender(<CharacterHeader character={{ ...warlock(), edition: "classic" }} />);
    expect(screen.getByTitle("This character uses the 2014 rules")).toHaveTextContent(/^2014$/);
    expect(screen.getByText("2014 rules")).toHaveClass("sr-only");
  });

  it("leaves the printed page to the print title", () => {
    const { container } = render(<CharacterHeader character={warlock()} />);
    expect(container.firstElementChild).toHaveClass("print:hidden");
  });
});

describe("PrintTitle", () => {
  it("carries the name and subtitle with no avatar", () => {
    const { container } = render(<PrintTitle character={warlock()} />);

    expect(within(container).getByText("Vex")).toBeInTheDocument();
    expect(within(container).getByText(/^Half-Elf Warlock 3/)).toBeInTheDocument();
    expect(container.querySelector("[aria-hidden]")).toBeNull();
  });
});
