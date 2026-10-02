import type { CharacterDerived } from "@dnd/character";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { derivedRecord } from "../../../../test/records.ts";
import { Defenses } from "./Defenses.tsx";

function renderDefenses(defenses: Partial<CharacterDerived["defenses"]["computed"]> = {}) {
  const derived = derivedRecord();
  const computed = { ...derived.defenses.computed, ...defenses };
  render(<Defenses derived={{ ...derived, defenses: { ...derived.defenses, computed } }} />);
  return screen.getByRole("region", { name: "Resistances & Immunities" });
}

describe("Defenses", () => {
  it("reads None. in both rows when nothing grants a defense", () => {
    const card = renderDefenses();

    expect(within(card).getByRole("heading", { name: "Resistances" })).toBeInTheDocument();
    expect(within(card).getByRole("heading", { name: "Immunities" })).toBeInTheDocument();
    expect(within(card).getAllByText("None.")).toHaveLength(2);
  });

  it("lists damage and condition immunities in one row", () => {
    const card = renderDefenses({
      resistances: [{ name: "poison", from: ["Dwarf (Hill)"] }],
      damageImmunities: [{ name: "fire", from: ["Efreeti Chain"] }],
      conditionImmunities: [{ name: "poisoned", from: ["Periapt of Proof against Poison"] }],
    });

    expect(
      within(card)
        .getAllByRole("button")
        .map((chip) => chip.textContent),
    ).toEqual(["PoisonPoison Resistance", "FireFire Immunity", "PoisonedPoisoned Immunity"]);
    expect(within(card).getByRole("button", { name: "Fire Immunity" })).toBeInTheDocument();
    expect(within(card).queryByText("None.")).not.toBeInTheDocument();
  });

  it("names every source that grants a chip", () => {
    renderDefenses({
      resistances: [{ name: "poison", from: ["Dwarf (Hill)", "Ring of Poison Resistance"] }],
    });

    fireEvent.click(screen.getByRole("button", { name: "Poison Resistance" }));
    const dialog = screen.getByRole("dialog", { name: "Poison Resistance" });
    expect(dialog).toHaveTextContent("From Dwarf (Hill) and Ring of Poison Resistance");
    expect(dialog).toHaveTextContent("You take half poison damage, rounded down.");
  });
});
