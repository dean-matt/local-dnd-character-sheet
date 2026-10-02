import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { characterRecord, identityRecord } from "../../../test/records.ts";
import { IdentitySection } from "./IdentitySection.tsx";

const chips = (card: string) =>
  within(screen.getByRole("region", { name: card }))
    .queryAllByRole("listitem")
    .map((item) => item.textContent);

describe("IdentitySection", () => {
  it("shows race, each class and background as chips, with the total level", () => {
    render(<IdentitySection character={identityRecord()} />);

    expect(screen.getByRole("region", { name: "Name" })).toHaveTextContent("Vex");
    expect(chips("Race")).toEqual(["Elf (High)"]);
    expect(chips("Class")).toEqual(["Warlock 2 (Fiend Patron)", "Fighter 1"]);
    expect(screen.getByRole("region", { name: "Class" })).toHaveTextContent("Total level: 3");
    expect(chips("Background")).toEqual(["Charlatan"]);
  });

  it("shows languages and each proficiency list apart, leaving out a tool held at none", () => {
    render(<IdentitySection character={identityRecord()} />);

    expect(chips("Languages")).toEqual(["Common", "Elvish"]);
    expect(chips("Proficiencies")).toEqual([
      "Light",
      "Shield",
      "Simple",
      "Light",
      "Thieves' Tools (expertise)",
      "Herbalism Kit",
    ]);
  });

  it("says so where a list is empty", () => {
    render(<IdentitySection character={characterRecord("1", "Vex")} />);

    expect(screen.getByRole("region", { name: "Languages" })).toHaveTextContent("No languages.");
    const proficiencies = screen.getByRole("region", { name: "Proficiencies" });
    expect(proficiencies).toHaveTextContent("No armor.");
    expect(proficiencies).toHaveTextContent("No weapons.");
    expect(proficiencies).toHaveTextContent("No tools.");
  });

  it("waits on the character", () => {
    render(<IdentitySection character={undefined} />);
    expect(screen.getByText("Identity isn't available yet.")).toBeInTheDocument();
  });
});
