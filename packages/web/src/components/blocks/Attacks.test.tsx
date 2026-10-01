import { type CharacterDerived, characterDefinitionSchema } from "@dnd/character";
import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterRecord, derivedRecord } from "../../test/records.ts";
import { renderWithClient } from "../../test/renderWithClient.tsx";
import { stubFetchByUrl } from "../../test/stubFetch.ts";
import { Attacks } from "./Attacks.tsx";

/** Vex with a longsword in hand and a dagger in the pack. */
function vex() {
  const record = characterRecord("1", "Vex");
  const definition = characterDefinitionSchema.parse({
    ...record.definition,
    inventory: [
      { ref: { name: "Longsword", source: "PHB" }, equipped: true },
      { ref: { name: "Dagger", source: "PHB" } },
    ],
  });
  return { ...record, definition };
}

const attack = (entry: number, bonus: number): CharacterDerived["attacks"][number] => ({
  entry,
  ability: "str",
  attackBonus: { computed: bonus, manual: null, terms: [{ label: "Strength", value: bonus }] },
  damage: {
    dice: "1d8",
    type: "slashing",
    modifier: { computed: -1, manual: null, terms: [{ label: "Strength", value: -1 }] },
  },
  grip: null,
});

function renderAttacks(derived: CharacterDerived) {
  stubFetchByUrl({
    "/api/characters/1/inventory": {
      items: [{ name: "Longsword" }, { name: "Dagger" }],
    },
  });
  renderWithClient(<Attacks character={vex()} derived={derived} />);
}

const rows = () =>
  within(screen.getByRole("region", { name: "Attacks & Spellcasting" })).getAllByRole("row");

afterEach(() => vi.unstubAllGlobals());

describe("Attacks", () => {
  it("lists each equipped weapon's bonus and damage, then each class's spell attack", async () => {
    renderAttacks({ ...derivedRecord(), attacks: [attack(0, 5), attack(1, 2)] });

    expect(await screen.findByRole("rowheader", { name: "Longsword" })).toBeInTheDocument();
    expect(rows().map((row) => row.textContent)).toEqual([
      "NameBonusDamage / Type",
      "Longsword+51d8-1 slashing",
      "Warlock spell attack+5—None",
    ]);
  });

  it("opens a weapon's attack terms from its bonus", async () => {
    renderAttacks({ ...derivedRecord(), attacks: [attack(0, 5)] });

    fireEvent.click(await screen.findByRole("button", { name: "Longsword attack bonus +5" }));
    expect(screen.getByRole("group", { name: "Longsword attack bonus" })).toHaveTextContent(
      "Strength5",
    );
  });

  it("opens a class's spell attack terms from its bonus", async () => {
    renderAttacks(derivedRecord());

    fireEvent.click(await screen.findByRole("button", { name: "Warlock spell attack bonus +5" }));
    expect(screen.getByRole("group", { name: "Warlock spell attack bonus" })).toHaveTextContent(
      "Charisma3Proficiency2",
    );
  });

  it("says so when nothing is equipped and nothing casts", () => {
    renderAttacks({ ...derivedRecord(), spellcasting: [], attacks: [attack(1, 2)] });

    expect(screen.getByText("No weapon equipped.")).toBeInTheDocument();
  });
});
