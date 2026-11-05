import type { CharacterDerived, CharacterRecord, CharacterState } from "@dnd/character";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterRecord, derivedRecord, stateRecord } from "../../../../test/records.ts";
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
  renderWithClient(<Vitals character={characterRecord("1", "Vex")} derived={derivedBlock} />);
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
    renderWithClient(<Vitals character={characterRecord("1", "Vex")} derived={derived()} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Character not found");
  });
});

describe("a rest", () => {
  const spent = (): Partial<CharacterState> => ({
    hitPoints: { current: 12, temporary: 3 },
    hitDice: [{ die: 8, total: 3, remaining: 1 }],
    pactSlots: { level: 1, total: 1, expended: 1 },
    resources: [{ name: "Ki", current: 0, maximum: 2, resetsOn: "short" }],
    exhaustion: 1,
  });

  /**
   * Renders the cards over a stand-in API that keeps what each state write sends, so a rest
   * lands on the sheet as it would. `fail` answers every write with a 500; `hold` keeps each
   * write in flight until it settles.
   */
  function renderLive(
    state: Partial<CharacterState>,
    {
      character = characterRecord("1", "Vex") as CharacterRecord,
      derivedBlock = derived(),
      fail = false,
      hold = Promise.resolve(),
    } = {},
  ) {
    let stored = { ...stateRecord(), state: { ...stateRecord().state, ...state } };
    const writes: CharacterState[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === "PUT") {
          await hold;
          if (fail) return new Response(JSON.stringify({ error: "Disk full" }), { status: 500 });
          const written = JSON.parse(String(init.body));
          writes.push(written);
          stored = { ...stored, state: written };
        }
        return new Response(JSON.stringify(stored), { status: 200 });
      }),
    );
    renderWithClient(<Vitals character={character} derived={derivedBlock} />);
    return writes;
  }

  const classic = (): CharacterRecord => {
    const character = characterRecord("1", "Vex");
    return {
      ...character,
      edition: "classic",
      definition: { ...character.definition, edition: "classic" },
    };
  };

  const open = async (name: string) => {
    fireEvent.click((await card("Hit Points")).getByRole("button", { name }));
    return within(screen.getByRole("dialog", { name }));
  };

  const listed = (dialog: ReturnType<typeof within>): string[] =>
    dialog
      .queryAllByRole("term")
      .map((term: HTMLElement) => `${term.textContent}: ${term.nextSibling?.textContent}`);

  it("offers a short and a long rest on the Hit Points card", async () => {
    renderLive({});
    const hp = await card("Hit Points");
    expect(hp.getByRole("button", { name: "Short rest" })).toHaveAttribute(
      "aria-haspopup",
      "dialog",
    );
    expect(hp.getByRole("button", { name: "Long rest" })).toBeInTheDocument();
  });

  it("lists what a long rest changes, before and after, writing nothing", async () => {
    const writes = renderLive(spent());
    const dialog = await open("Long rest");
    expect(listed(dialog)).toEqual([
      "Hit points: 12 → 20",
      "Temporary hit points: 3 → 0",
      "d8 Hit Dice: 1/3 → 3/3",
      "Pact Magic 1st Level slots: 0/1 → 1/1",
      "Ki: 0/2 → 2/2",
      "Exhaustion: 1 → 0",
    ]);
    expect(writes).toEqual([]);
  });

  it("lists only what a short rest resets", async () => {
    renderLive({
      ...spent(),
      hitDice: [
        { die: 8, total: 3, remaining: 1 },
        { die: 10, total: 2, remaining: 2 },
      ],
    });
    expect(listed(await open("Short rest"))).toEqual([
      "Pact Magic 1st Level slots: 0/1 → 1/1",
      "Ki: 0/2 → 2/2",
    ]);
  });

  it("says so when a rest changes nothing", async () => {
    renderLive({});
    expect((await open("Short rest")).getByText("This rest changes nothing.")).toBeInTheDocument();
  });

  it("lists each spent spell slot level a long rest restores, by its level", async () => {
    const slots = (...levels: [number, number][]) =>
      levels.map(([level, total]) => ({
        level,
        total: { computed: total, manual: null, terms: [] },
      }));
    renderLive(
      {
        spellSlots: [
          { level: 2, total: 3, expended: 2 },
          { level: 3, total: 2, expended: 2 },
        ],
      },
      { derivedBlock: { ...derived(), spellSlots: slots([1, 4], [2, 3], [3, 2]) } },
    );
    expect(listed(await open("Long rest"))).toEqual([
      "2nd Level slots: 1/3 → 3/3",
      "3rd Level slots: 0/2 → 2/2",
    ]);
  });

  it("asks which sizes a classic long rest recovers, refusing more than return", async () => {
    renderLive(
      {
        hitDice: [
          { die: 8, total: 3, remaining: 0 },
          { die: 10, total: 2, remaining: 0 },
        ],
      },
      { character: classic() },
    );
    const dialog = await open("Long rest");
    const d8 = dialog.getByRole("spinbutton", { name: "d8, 3 spent" });
    const d10 = dialog.getByRole("spinbutton", { name: "d10, 2 spent" });
    expect([d8, d10].map((field) => (field as HTMLInputElement).value)).toEqual(["0", "2"]);
    expect(listed(dialog)).toContain("d10 Hit Dice: 0/2 → 2/2");

    fireEvent.change(d8, { target: { value: "3" } });
    expect(dialog.getByText("Only 2 hit dice return; 5 are picked.")).toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "Take the long rest" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );

    fireEvent.change(d8, { target: { value: "1" } });
    fireEvent.change(d10, { target: { value: "1" } });
    expect(listed(dialog).filter((row) => row.includes("Hit Dice"))).toEqual([
      "d8 Hit Dice: 0/3 → 1/3",
      "d10 Hit Dice: 0/2 → 1/2",
    ]);
  });

  it("returns the most dice of the one size spent without asking", async () => {
    renderLive({ hitDice: [{ die: 8, total: 3, remaining: 0 }] }, { character: classic() });
    const dialog = await open("Long rest");
    expect(dialog.queryByRole("spinbutton")).not.toBeInTheDocument();
    expect(listed(dialog)).toContain("d8 Hit Dice: 0/3 → 2/3");
  });

  it("writes the rest once, shows the listed values and announces them", async () => {
    const writes = renderLive(spent());
    const dialog = await open("Long rest");
    fireEvent.click(dialog.getByRole("button", { name: "Take the long rest" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({
      hitPoints: { current: null, temporary: 0 },
      hitDice: [
        { die: 8, total: 3, remaining: 3 },
        { die: 10, total: 2, remaining: 2 },
      ],
      pactSlots: { level: 1, total: 1, expended: 0 },
      resources: [{ name: "Ki", current: 2 }],
      exhaustion: 0,
    });
    const hp = await card("Hit Points");
    expect(hp.getByText(/^Hit Dice/)).toHaveTextContent("Hit Dice 3/3 d8, 2/2 d10");
    expect(hp.getByRole("status")).toHaveTextContent(/^Long rest applied\. Hit points 20, /);
    expect(hp.getByRole("button", { name: "Long rest" })).toHaveFocus();
  });

  it("writes nothing on cancel, and returns focus to the control", async () => {
    const writes = renderLive(spent());
    fireEvent.click((await open("Short rest")).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(writes).toEqual([]);
    expect((await card("Hit Points")).getByRole("button", { name: "Short rest" })).toHaveFocus();
  });

  it("stays open through a write in flight, ignoring Cancel and Escape", async () => {
    let settle = () => {};
    const writes = renderLive(spent(), { hold: new Promise<void>((done) => (settle = done)) });
    const dialog = await open("Long rest");
    fireEvent.click(dialog.getByRole("button", { name: "Take the long rest" }));
    const cancel = await dialog.findByRole("button", { name: "Cancel" });
    await waitFor(() => expect(cancel).toHaveAttribute("aria-disabled", "true"));

    fireEvent.click(cancel);
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    settle();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(writes).toHaveLength(1);
    expect((await card("Hit Points")).getByRole("status")).toHaveTextContent(/^Long rest applied/);
  });

  it("keeps the sheet as it was and says so when the write fails", async () => {
    renderLive(spent(), { fail: true });
    const dialog = await open("Long rest");
    fireEvent.click(dialog.getByRole("button", { name: "Take the long rest" }));

    expect(await dialog.findByRole("alert")).toHaveTextContent("The rest was not applied");
    const hp = await card("Hit Points");
    expect(hp.getByText("12")).toBeInTheDocument();
    expect(hp.getByText(/^Hit Dice/)).toHaveTextContent("Hit Dice 1/3 d8, 2/2 d10");
  });
});
