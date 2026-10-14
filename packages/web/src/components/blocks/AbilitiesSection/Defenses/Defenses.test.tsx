import type { CharacterDefinition, CharacterDerived, CharacterRecord } from "@dnd/character";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterKey } from "../../../../hooks/characterKeys.ts";
import { characterRecord, derivedRecord } from "../../../../test/records.ts";
import { stubFetch } from "../../../../test/stubFetch.ts";
import { Defenses } from "./Defenses.tsx";

const NONE_ADDED = { resistances: [], damageImmunities: [], conditionImmunities: [] };

function renderDefenses(
  defenses: Partial<CharacterDerived["defenses"]["computed"]> = {},
  addedDefenses: CharacterDefinition["addedDefenses"] = NONE_ADDED,
) {
  const base = characterRecord("1", "Vex");
  const character: CharacterRecord = {
    ...base,
    definition: { ...base.definition, addedDefenses },
  };
  const derived = derivedRecord();
  const computed = { ...derived.defenses.computed, ...defenses };
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  client.setQueryData(characterKey("1"), character);
  render(
    <QueryClientProvider client={client}>
      <Defenses
        character={character}
        derived={{ ...derived, defenses: { ...derived.defenses, computed } }}
      />
    </QueryClientProvider>,
  );
  return screen.getByRole("region", { name: "Resistances & Immunities" });
}

/** The added defenses the one write sent. */
const written = (fetchMock: ReturnType<typeof stubFetch>) =>
  JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)).addedDefenses;

afterEach(() => vi.unstubAllGlobals());

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
        .getAllByRole("button", { name: /Resistance|Immunity/ })
        .map((chip) => chip.textContent),
    ).toEqual(["PoisonPoison Resistance", "FireFire Immunity", "PoisonedPoisoned Immunity"]);
    expect(within(card).getByRole("button", { name: "Fire Immunity" })).toBeInTheDocument();
    expect(within(card).queryByText("None.")).not.toBeInTheDocument();
  });

  it("says a race's choice of resistance is waiting rather than None.", () => {
    const card = renderDefenses({
      resistanceChoice: { from: "Dragonborn", options: ["acid", "cold", "fire"] },
    });

    expect(
      within(card).getByText("Dragonborn offers acid, cold, or fire, not yet chosen."),
    ).toBeInTheDocument();
    expect(within(card).getAllByText("None.")).toHaveLength(1);
  });

  it("adds a Vulnerabilities row only where something grants one", () => {
    expect(within(renderDefenses()).queryByRole("heading", { name: "Vulnerabilities" })).toBeNull();
  });

  it("lists a vulnerability with the item that causes it", () => {
    const card = renderDefenses({
      vulnerabilities: [{ name: "piercing", from: ["Armor of Vulnerability"] }],
    });

    expect(within(card).getByRole("heading", { name: "Vulnerabilities" })).toBeInTheDocument();
    fireEvent.click(within(card).getByRole("button", { name: "Piercing Vulnerability" }));
    const dialog = screen.getByRole("dialog", { name: "Piercing Vulnerability" });
    expect(dialog).toHaveTextContent("From Armor of Vulnerability");
    expect(dialog).toHaveTextContent("You take double piercing damage.");
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

  it("lists what the player added after what is granted, each with ×", () => {
    const card = renderDefenses(
      { resistances: [{ name: "poison", from: ["Dwarf (Hill)"] }] },
      { resistances: ["fire"], damageImmunities: [], conditionImmunities: ["charmed"] },
    );

    expect(within(card).getByRole("button", { name: "Poison Resistance" })).toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: "Remove Poison resistance" })).toBeNull();
    expect(
      within(card).getByRole("button", { name: "Remove Fire resistance" }),
    ).toBeInTheDocument();
    expect(
      within(card).getByRole("button", { name: "Remove Charmed immunity" }),
    ).toBeInTheDocument();
    expect(within(card).queryByText("None.")).not.toBeInTheDocument();
  });

  it("adds a resistance by hand, offering only a type not yet added", async () => {
    const fetchMock = stubFetch(new Response(JSON.stringify(characterRecord("1", "Vex"))));
    const card = renderDefenses({}, { ...NONE_ADDED, resistances: ["acid"] });

    fireEvent.click(within(card).getByRole("combobox", { name: "Add resistance" }));
    expect(screen.queryByRole("option", { name: "Acid" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: "Fire" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(written(fetchMock)).toEqual({ ...NONE_ADDED, resistances: ["acid", "fire"] });
  });

  it("removes an added immunity and leaves the rest", async () => {
    const fetchMock = stubFetch(new Response(JSON.stringify(characterRecord("1", "Vex"))));
    const card = renderDefenses(
      {},
      { resistances: ["fire"], damageImmunities: ["poison"], conditionImmunities: ["charmed"] },
    );

    fireEvent.click(within(card).getByRole("button", { name: "Remove Charmed immunity" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(written(fetchMock)).toEqual({
      resistances: ["fire"],
      damageImmunities: ["poison"],
      conditionImmunities: [],
    });
  });
});
