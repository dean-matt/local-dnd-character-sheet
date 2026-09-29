import { characterDefinitionSchema } from "@dnd/character";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { characterRecord } from "../../test/records.ts";
import {
  AlignmentSection,
  IdentitySection,
  LevelSection,
  NotesSection,
} from "./IdentitySection.tsx";

/** A Warlock 2 / Fighter 1 High Elf, with something in every proficiency list. */
function vex() {
  const base = characterRecord("1", "Vex");
  const warlock = { class: { name: "Warlock", source: "XPHB" } };
  return {
    ...base,
    definition: characterDefinitionSchema.parse({
      ...base.definition,
      levels: [
        warlock,
        { class: { name: "Fighter", source: "XPHB" } },
        { ...warlock, subclass: { name: "Fiend Patron", source: "XPHB" } },
      ],
      race: { name: "Elf", source: "XPHB" },
      subrace: { name: "High", source: "XPHB" },
      proficiencies: {
        ...base.definition.proficiencies,
        armor: ["Light", "Shield"],
        weapons: ["Simple", "Light"],
        tools: [
          { name: "Thieves' Tools", level: "expertise" },
          { name: "Herbalism Kit", level: "proficient" },
          { name: "Dice Set", level: "none" },
        ],
        languages: [
          { name: "Common", source: "XPHB" },
          { name: "Elvish", source: "XPHB" },
        ],
      },
      alignment: "Chaotic Good",
      notes: "Owes Sarth 10 gp.\nDo not trust the ferryman.",
    }),
  };
}

const chips = (card: string) =>
  within(screen.getByRole("region", { name: card }))
    .queryAllByRole("listitem")
    .map((item) => item.textContent);

describe("IdentitySection", () => {
  it("shows race, each class and background as chips, with the total level", () => {
    render(<IdentitySection character={vex()} />);

    expect(screen.getByRole("region", { name: "Name" })).toHaveTextContent("Vex");
    expect(chips("Race")).toEqual(["Elf (High)"]);
    expect(chips("Class")).toEqual(["Warlock 2 (Fiend Patron)", "Fighter 1"]);
    expect(screen.getByRole("region", { name: "Class" })).toHaveTextContent("Total level: 3");
    expect(chips("Background")).toEqual(["Charlatan"]);
  });

  it("shows languages and each proficiency list apart, leaving out a tool held at none", () => {
    render(<IdentitySection character={vex()} />);

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

describe("LevelSection", () => {
  it("shows the total level beside a chip per class", () => {
    render(<LevelSection character={vex()} />);

    const card = screen.getByRole("region", { name: "Level" });
    expect(within(card).getByText("3")).toHaveClass("text-[32px]", "font-bold");
    expect(chips("Level")).toEqual(["Warlock 2 (Fiend Patron)", "Fighter 1"]);
  });
});

describe("AlignmentSection", () => {
  it("shows the alignment, or that none is set", () => {
    const { unmount } = render(<AlignmentSection character={vex()} />);
    expect(screen.getByRole("region", { name: "Alignment" })).toHaveTextContent("Chaotic Good");
    unmount();

    render(<AlignmentSection character={characterRecord("1", "Vex")} />);
    expect(screen.getByText("No alignment set.")).toBeInTheDocument();
  });
});

describe("NotesSection", () => {
  it("shows the notes as written, line breaks kept, or that there are none", () => {
    const { unmount } = render(<NotesSection character={vex()} />);
    const text = within(screen.getByRole("region", { name: "Notes" })).getByText(/Owes Sarth/);
    expect(text.textContent).toBe("Owes Sarth 10 gp.\nDo not trust the ferryman.");
    expect(text).toHaveClass("whitespace-pre-wrap");
    unmount();

    render(<NotesSection character={characterRecord("1", "Vex")} />);
    expect(screen.getByText("No notes yet.")).toBeInTheDocument();
  });
});
