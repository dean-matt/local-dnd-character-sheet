import { type CharacterDerived, characterDefinitionSchema } from "@dnd/character";
import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterRecord, derivedRecord } from "../../../../test/records.ts";
import { renderWithClient } from "../../../../test/renderWithClient.tsx";
import { stubFetchByUrl } from "../../../../test/stubFetch.ts";
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
  critThreshold: { computed: 20, manual: null, terms: [] },
  damage: {
    dice: "1d8",
    type: "slashing",
    modifier: { computed: -1, manual: null, terms: [{ label: "Strength", value: -1 }] },
  },
  grip: null,
  mastery: [],
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

  it("shows the lowered critical threshold beside the damage, and nothing at 20", async () => {
    const crits = { computed: 19, manual: null, terms: [] };
    renderAttacks({
      ...derivedRecord(),
      attacks: [{ ...attack(0, 5), critThreshold: crits }, attack(1, 2)],
    });

    expect(await screen.findByRole("rowheader", { name: "Longsword" })).toBeInTheDocument();
    expect(rows().map((row) => row.textContent)).toContain(
      "Longsword+51d8-1 slashing · Crit 19–20",
    );
  });

  it("notes the advantage or disadvantage an item grants on attack rolls beside each attack", async () => {
    renderAttacks({
      ...derivedRecord(),
      attacks: [attack(0, 5)],
      rollEffects: {
        computed: [
          {
            item: "Oathbow",
            mode: "disadvantage",
            roll: "attack",
            condition: "with all other weapons",
          },
          { item: "Boots of Elvenkind", mode: "advantage", roll: "skill", target: "Stealth" },
        ],
        manual: null,
        terms: [],
      },
    });

    const header = await screen.findByRole("rowheader", { name: /^Longsword/ });
    expect(header).toHaveTextContent("Disadvantage with all other weapons (Oathbow)");
    expect(header).not.toHaveTextContent("Boots of Elvenkind");
    expect(screen.getByRole("rowheader", { name: /^Warlock spell attack/ })).toHaveTextContent(
      "Disadvantage with all other weapons (Oathbow)",
    );
  });

  it("opens a weapon's attack terms from its bonus", async () => {
    renderAttacks({ ...derivedRecord(), attacks: [attack(0, 5)] });

    fireEvent.click(await screen.findByRole("button", { name: "Longsword attack bonus +5" }));
    expect(screen.getByRole("group", { name: "Longsword attack bonus" })).toHaveTextContent(
      "Strength5",
    );
  });

  it("names the mastery a chosen weapon has, linked to its rules text", async () => {
    const topple = { name: "Topple", source: "XPHB" };
    const fetchMock = stubFetchByUrl({
      "/api/characters/1/inventory": { items: [{ name: "Longsword" }, { name: "Dagger" }] },
      "/api/refs/resolve": {
        refs: [
          {
            ...topple,
            entries: ["Push the target over."],
            path: "/catalog/itemMastery/Topple/XPHB",
          },
        ],
      },
    });
    renderWithClient(
      <Attacks
        character={vex()}
        derived={{ ...derivedRecord(), attacks: [{ ...attack(0, 5), mastery: [topple] }] }}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Topple" }));
    expect(screen.getByRole("rowheader", { name: /Mastery: Topple/ })).toBeInTheDocument();
    expect(
      JSON.parse(
        String(fetchMock.mock.calls.find(([url]) => url === "/api/refs/resolve")?.[1]?.body),
      ).refs,
    ).toEqual([{ tag: "itemMastery", name: "Topple", source: "XPHB" }]);
    expect(screen.getByText("Push the target over.")).toBeInTheDocument();
  });

  it("names no mastery on a weapon that has none", async () => {
    renderAttacks({ ...derivedRecord(), attacks: [attack(0, 5)] });

    expect(await screen.findByRole("rowheader", { name: "Longsword" })).toBeInTheDocument();
    expect(screen.queryByText(/Mastery/)).not.toBeInTheDocument();
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
