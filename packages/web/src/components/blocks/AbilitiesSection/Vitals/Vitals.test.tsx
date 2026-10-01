import type { CharacterDerived, CharacterState } from "@dnd/character";
import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { derivedRecord, stateRecord } from "../../../../test/records.ts";
import { renderWithClient } from "../../../../test/renderWithClient.tsx";
import { stubFetch, stubFetchByUrl } from "../../../../test/stubFetch.ts";
import { Vitals } from "./Vitals.tsx";

/** `derivedRecord`'s Warlock with a second pool, so each die reads apart. */
function derived(): CharacterDerived {
  const base = derivedRecord();
  return {
    ...base,
    hitPointMaximum: { computed: 20, manual: null, terms: [] },
    hitDice: [
      { die: 8, total: { computed: 3, manual: null, terms: [] } },
      { die: 10, total: { computed: 2, manual: null, terms: [] } },
    ],
  };
}

function renderVitals(state: Partial<CharacterState>, derivedBlock = derived()) {
  const record = stateRecord();
  stubFetchByUrl({
    "/api/characters/1/state": { ...record, state: { ...record.state, ...state } },
  });
  renderWithClient(<Vitals characterId="1" derived={derivedBlock} />);
}

const card = async (name: string) => within(await screen.findByRole("region", { name }));

const bar = (hp: HTMLElement) => hp.querySelector("[aria-hidden='true'] > div") as HTMLElement;

afterEach(() => vi.unstubAllGlobals());

describe("Vitals", () => {
  it("reads current over maximum, and each die's remaining over its total", async () => {
    renderVitals({
      hitPoints: { current: 12, temporary: 0 },
      hitDice: [{ die: 8, total: 3, remaining: 1 }],
    });

    const hp = await card("Hit Points");
    expect(hp.getByText("12")).toBeInTheDocument();
    expect(hp.getByText("20")).toBeInTheDocument();
    expect(hp.getByText(/Hit Dice/)).toHaveTextContent("Hit Dice 1/3 d8, 2/2 d10");
    expect(hp.queryByText(/temp/)).not.toBeInTheDocument();
    expect(bar(screen.getByRole("region", { name: "Hit Points" })).style.width).toBe("60%");
  });

  it("reads a new character at its maximum, with a full bar", async () => {
    renderVitals({});

    const hp = await card("Hit Points");
    expect(hp.getAllByText("20")).toHaveLength(2);
    expect(bar(screen.getByRole("region", { name: "Hit Points" })).style.width).toBe("100%");
  });

  it("shows temporary hit points only when there are some", async () => {
    renderVitals({ hitPoints: { current: 20, temporary: 5 } });

    expect((await card("Hit Points")).getByText("+5 temp")).toHaveClass("text-positive");
  });

  it("keeps the bar inside its track when current leaves the range", async () => {
    renderVitals({ hitPoints: { current: -3, temporary: 0 } });
    await card("Hit Points");
    expect(bar(screen.getByRole("region", { name: "Hit Points" })).style.width).toBe("0%");
  });

  it("marks a maximum the user typed over", async () => {
    renderVitals(
      { hitPoints: { current: 20, temporary: 0 } },
      { ...derived(), hitPointMaximum: { computed: 20, manual: 25, terms: [] } },
    );

    expect((await card("Hit Points")).getByText(", overridden from 20")).toBeInTheDocument();
  });

  it("says so when no condition is active", async () => {
    renderVitals({});

    expect((await card("Status Effects")).getByText("No active conditions.")).toBeInTheDocument();
  });

  it("lists each condition once, then exhaustion at its level", async () => {
    const poisoned = { name: "Poisoned", source: "XPHB" };
    renderVitals({
      conditions: [poisoned, { name: "Prone", source: "XPHB" }, { ...poisoned, source: "PHB" }],
      exhaustion: 2,
    });

    const chips = (await card("Status Effects")).getAllByRole("listitem");
    expect(chips.map((chip) => chip.textContent)).toEqual(["Poisoned", "Prone", "Exhaustion 2"]);
  });

  it("reports a state the API could not answer", async () => {
    stubFetch(new Response(JSON.stringify({ error: "Character not found" }), { status: 404 }));
    renderWithClient(<Vitals characterId="1" derived={derived()} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Character not found");
  });
});
