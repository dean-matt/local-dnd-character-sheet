import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterRecord, derivedRecord, stateRecord } from "../../../test/records.ts";
import { renderWithClient } from "../../../test/renderWithClient.tsx";
import { AbilitiesSection } from "../AbilitiesSection/AbilitiesSection.tsx";
import { CombatSection } from "./CombatSection.tsx";

const COMBAT_CARDS = ["Encounter", "Turn Economy", "Actions", "Attacks & Spellcasting"];

afterEach(() => vi.unstubAllGlobals());

function stubReads() {
  const reads: Record<string, unknown> = {
    "/api/characters/1/state": stateRecord(),
    "/api/characters/1/inventory": { items: [] },
    "/api/characters/1/features": { groups: [] },
  };
  vi.stubGlobal(
    "fetch",
    async (url: RequestInfo | URL) => new Response(JSON.stringify(reads[String(url)] ?? [])),
  );
}

describe("CombatSection", () => {
  it("waits for the character and its derived block", () => {
    renderWithClient(<CombatSection character={characterRecord("1", "Vex")} derived={undefined} />);
    expect(screen.getByText("Combat isn't available yet.")).toBeInTheDocument();
  });

  it("holds the in-combat cards, which the Abilities section no longer shows", async () => {
    stubReads();
    const character = characterRecord("1", "Vex");
    const derived = derivedRecord(character.definition);
    const { unmount } = renderWithClient(<CombatSection character={character} derived={derived} />);
    for (const name of COMBAT_CARDS) {
      expect(await screen.findByRole("region", { name })).toBeInTheDocument();
    }
    unmount();

    renderWithClient(<AbilitiesSection character={character} derived={derived} />);
    for (const name of COMBAT_CARDS) {
      expect(screen.queryByRole("region", { name })).not.toBeInTheDocument();
    }
    expect(screen.getByRole("region", { name: "Saving Throws" })).toBeInTheDocument();
  });
});
