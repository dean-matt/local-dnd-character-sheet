import {
  type CharacterDerived,
  type CharacterRecord,
  deriveCharacter,
  entryKey,
} from "@dnd/character";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { characterRecord } from "../../test/records.ts";
import { AbilitiesSection } from "./AbilitiesSection.tsx";

const WARLOCK = { name: "Warlock", source: "XPHB" };
const STEALTH = { name: "Stealth", source: "XPHB" };
const DECEPTION = { name: "Deception", source: "XPHB" };
const PERCEPTION = { name: "Perception", source: "XPHB" };
const ARCANA = { name: "Arcana", source: "XPHB" };
const FIEND = { name: "Fiend Patron", source: "XPHB" };

/** `characterRecord`'s Warlock at level 3 with a patron, two skills and two saves. */
function warlock(): CharacterRecord {
  const record = characterRecord("1", "Vex");
  return {
    ...record,
    level: 3,
    definition: {
      ...record.definition,
      levels: [{ class: WARLOCK }, { class: WARLOCK }, { class: WARLOCK, subclass: FIEND }],
      proficiencies: {
        ...record.definition.proficiencies,
        savingThrows: ["wis", "cha"],
        skills: [
          { ref: DECEPTION, level: "proficient" },
          { ref: STEALTH, level: "expertise" },
        ],
      },
    },
  };
}

function derivedFor(record: CharacterRecord): CharacterDerived {
  return deriveCharacter(record.definition, {
    hitDice: new Map([[entryKey(WARLOCK), 8]]),
    spellcastingAbilities: new Map([[entryKey(WARLOCK), "cha"]]),
    skills: [
      { ref: STEALTH, ability: "dex" },
      { ref: DECEPTION, ability: "cha" },
      { ref: PERCEPTION, ability: "wis" },
      { ref: ARCANA, ability: "int" },
    ],
    size: "medium",
    speed: { walk: 30, fly: 40 },
    armor: new Map(),
  });
}

function renderSection(record = warlock(), derived = derivedFor(record)) {
  render(<AbilitiesSection character={record} derived={derived} />);
}

/** A row's text with the aria-hidden decoration dropped, as a screen reader reaches it. */
function spoken(element: HTMLElement): string {
  const clone = element.cloneNode(true) as HTMLElement;
  for (const hidden of clone.querySelectorAll("[aria-hidden='true']")) hidden.remove();
  return clone.textContent ?? "";
}

/** One ability's term and value together, found by the full name a screen reader speaks. */
const ability = (name: string) =>
  within(screen.getByRole("region", { name: "Ability Scores" }))
    .getByText(name)
    .closest("div") as HTMLElement;

describe("AbilitiesSection", () => {
  it("degrades until both the character and its derived block have loaded", () => {
    render(<AbilitiesSection character={warlock()} derived={undefined} />);
    expect(screen.getByText("Abilities isn't available yet.")).toBeInTheDocument();
  });

  it("names the character, their class with its subclass, race, background and level", () => {
    renderSection();

    expect(screen.getByRole("heading", { level: 2, name: "Vex" })).toBeInTheDocument();
    expect(screen.getByText("Warlock 3 (Fiend Patron)")).toBeInTheDocument();
    expect(screen.getByText("Half-Elf")).toBeInTheDocument();
    expect(screen.getByText("Charlatan")).toBeInTheDocument();
    expect(screen.getByText("Level").nextElementSibling).toHaveTextContent("3");
  });

  it("renders an unset alignment as absent rather than as an empty cell", () => {
    renderSection();
    expect(spoken(screen.getByText("Alignment").nextElementSibling as HTMLElement)).toBe("None");
  });

  it("shows an alignment once one is chosen", () => {
    const record = warlock();
    renderSection({ ...record, definition: { ...record.definition, alignment: "Chaotic Good" } });
    expect(screen.getByText("Chaotic Good")).toBeInTheDocument();
  });

  it("reads each ability as its name, score and signed modifier", () => {
    renderSection();

    expect(spoken(ability("Strength"))).toBe("Strength8, modifier-1");
    expect(spoken(ability("Charisma"))).toBe("Charisma17, modifier+3");
  });

  it("takes each modifier from the derived block, not from the score", () => {
    const record = warlock();
    const derived = derivedFor(record);
    renderSection(record, {
      ...derived,
      abilityModifiers: {
        ...derived.abilityModifiers,
        dex: { computed: 3, manual: null, terms: [] },
      },
    });

    expect(within(ability("Dexterity")).getByText("+3")).toBeVisible();
  });

  it("marks proficiency and expertise beside the total, for sight and for a screen reader", () => {
    renderSection();

    const saves = within(screen.getByRole("region", { name: "Saving Throws" }));
    expect(spoken(saves.getByText("Charisma").closest("li") as HTMLElement)).toBe(
      "Charisma, proficientmodifier+5",
    );
    expect(spoken(saves.getByText("Strength").closest("li") as HTMLElement)).toBe(
      "Strengthmodifier-1",
    );

    const skills = within(screen.getByRole("region", { name: "Skills" }));
    const stealth = skills.getByText("Stealth").closest("li") as HTMLElement;
    expect(spoken(stealth)).toBe("Stealth, expertisemodifier+7");
    expect(within(stealth).getByTitle("Expertise")).toHaveTextContent("◆");
    expect(skills.getByText("Arcana").closest("li")).toHaveTextContent("○Arcanamodifier+0");
  });

  it("lists every skill the derived block scores, alphabetically", () => {
    renderSection();

    const skills = within(screen.getByRole("region", { name: "Skills" }));
    expect(skills.getAllByRole("listitem").map((row) => row.textContent?.slice(1, 6))).toEqual([
      "Arcan",
      "Decep",
      "Perce",
      "Steal",
    ]);
  });

  it("shows a passive score the derived block holds, and an absent one as absent", () => {
    renderSection();

    const passive = within(screen.getByRole("region", { name: "Passive Scores" }));
    expect(passive.getByText("Passive Perception").nextElementSibling).toHaveTextContent("11");
    expect(spoken(passive.getByText("Passive Insight").nextElementSibling as HTMLElement)).toBe(
      "None",
    );
  });

  it("shows the combat numbers, signing the modifiers and naming every speed", () => {
    renderSection();

    const combat = within(screen.getByRole("region", { name: "Combat" }));
    const value = (label: string) => combat.getByText(label).nextElementSibling;
    expect(value("Armor Class")).toHaveTextContent("13");
    expect(value("Initiative")).toHaveTextContent("+3");
    expect(value("Speed")).toHaveTextContent("30 ft., fly 40 ft.");
    expect(value("Proficiency Bonus")).toHaveTextContent("+2");
    expect(value("Hit Point Maximum")).toHaveTextContent("24");
    expect(value("Hit Dice (d8)")).toHaveTextContent("3");
  });

  it("tells an overridden value apart from a computed one", () => {
    const record = warlock();
    const derived = derivedFor(record);
    renderSection(record, { ...derived, armorClass: { ...derived.armorClass, manual: 18 } });

    const armorClass = within(screen.getByRole("region", { name: "Combat" })).getByText(
      "Armor Class",
    ).nextElementSibling as HTMLElement;
    expect(spoken(armorClass)).toBe("18, overridden from 13");
  });

  it("renders every overridable value read-only", () => {
    renderSection();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
