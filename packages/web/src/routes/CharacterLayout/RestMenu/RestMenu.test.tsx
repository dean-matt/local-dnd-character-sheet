import {
  type CharacterDerived,
  type CharacterRecord,
  type CharacterState,
  derivedValue,
} from "@dnd/character";
import { focusManager } from "@tanstack/react-query";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCharacterState } from "../../../hooks/useCharacterState.ts";
import { characterRecord, derivedRecord, stateRecord } from "../../../test/records.ts";
import { renderWithClient } from "../../../test/renderWithClient.tsx";
import { RestMenu } from "./RestMenu.tsx";

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

/** What the sheet reads from the state query: current hit points and each pool's remaining dice. */
function Sheet({ id }: { id: string }) {
  const state = useCharacterState(id).data?.state;
  return (
    <output aria-label="Sheet">
      {state &&
        `${state.hitPoints.current ?? "full"} hp; ${state.hitDice.map((pool) => `${pool.remaining}/${pool.total} d${pool.die}`).join(", ")}`}
    </output>
  );
}

const spent = (): Partial<CharacterState> => ({
  hitPoints: { current: 12, temporary: 3 },
  hitDice: [{ die: 8, total: 3, remaining: 1 }],
  pactSlots: { level: 1, total: 1, expended: 1 },
  resources: [{ name: "Ki", current: 0, maximum: 2, resetsOn: "short" }],
  exhaustion: 1,
});

const rolls: { label: string; notation: string; total: number; modifier: number }[] = [];

let stored = stateRecord();

/** Changes the stored state as another tab would, and refetches it as a window focus does. */
function storeElsewhere(state: Partial<CharacterState>) {
  stored = { ...stored, state: { ...stored.state, ...state } };
  act(() => {
    focusManager.setFocused(false);
    focusManager.setFocused(true);
  });
}

/**
 * Renders the menu beside what the sheet reads, over a stand-in API that keeps what each state
 * write sends, so a rest lands on the sheet as it would. `fail` answers every write with a
 * 500, `failRolls` the first that many roll logs; `hold` keeps each write in flight until it
 * settles.
 */
function renderLive(
  state: Partial<CharacterState>,
  {
    character = characterRecord("1", "Vex") as CharacterRecord,
    derivedBlock = derived(),
    fail = false,
    failRolls = 0,
    hold = Promise.resolve(),
  } = {},
) {
  stored = { ...stateRecord(), state: { ...stateRecord().state, ...state } };
  let rollsToFail = failRolls;
  const writes: CharacterState[] = [];
  rolls.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith("/derived")) {
        return new Response(JSON.stringify(derivedBlock), { status: 200 });
      }
      if (init?.method === "POST" && String(input).endsWith("/rolls")) {
        if (rollsToFail > 0) {
          rollsToFail -= 1;
          return new Response(JSON.stringify({ error: "Disk full" }), { status: 500 });
        }
        const roll = JSON.parse(String(init.body));
        rolls.push(roll);
        return new Response(
          JSON.stringify({
            ...roll,
            id: rolls.length,
            characterId: "1",
            characterName: "Vex",
            rolledAt: "2026-01-01T00:00:00.000Z",
          }),
          { status: 200 },
        );
      }
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
  renderWithClient(
    <>
      <RestMenu character={character} />
      <Sheet id={character.id} />
    </>,
  );
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

const rest = () => screen.getByRole("button", { name: "Rest" });

const openMenu = async () => {
  await waitFor(() => expect(rest()).toHaveAttribute("aria-disabled", "false"));
  fireEvent.click(rest());
};

const open = async (name: string) => {
  await openMenu();
  fireEvent.click(screen.getByRole("button", { name }));
  return within(screen.getByRole("dialog", { name }));
};

const sheet = () => screen.getByRole("status", { name: "Sheet" });

const listed = (dialog: ReturnType<typeof within>): string[] =>
  dialog
    .queryAllByRole("term")
    .map((term: HTMLElement) => `${term.textContent}: ${term.nextSibling?.textContent}`);

afterEach(() => {
  focusManager.setFocused(undefined);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("RestMenu", () => {
  it("offers a short and a long rest, each opening a dialog", async () => {
    renderLive({});
    expect(rest()).toHaveAttribute("aria-expanded", "false");
    await openMenu();

    expect(rest()).toHaveAttribute("aria-expanded", "true");
    const short = screen.getByRole("button", { name: "Short rest" });
    expect(short).toHaveAttribute("aria-haspopup", "dialog");
    expect(short).toHaveAccessibleDescription("Nothing to recover");
    expect(screen.getByRole("button", { name: "Long rest" })).toBeInTheDocument();
  });

  it("names what a short rest would recover for this character", async () => {
    renderLive(spent());
    await openMenu();
    expect(screen.getByRole("button", { name: "Short rest" })).toHaveAccessibleDescription(
      "Recover pact slots and Ki",
    );
  });

  it("closes the menu on Escape, returning focus to the Rest button", async () => {
    renderLive({});
    await openMenu();
    fireEvent.keyDown(screen.getByRole("button", { name: "Short rest" }), { key: "Escape" });

    expect(screen.queryByRole("button", { name: "Short rest" })).not.toBeInTheDocument();
    expect(rest()).toHaveFocus();
  });

  it("closes the menu when focus leaves it", async () => {
    renderLive({});
    await openMenu();
    fireEvent.blur(rest(), { relatedTarget: document.body });

    expect(screen.queryByRole("button", { name: "Short rest" })).not.toBeInTheDocument();
  });

  it("keeps the menu shut until the sheet loads, and names a failed load", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => new Response(JSON.stringify({ error: "Character not found" }), { status: 404 }),
      ),
    );
    renderWithClient(<RestMenu character={characterRecord("1", "Vex")} />);
    expect(rest()).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(rest());
    expect(rest()).toHaveAttribute("aria-expanded", "false");

    await waitFor(() =>
      expect(rest()).toHaveAttribute("title", "A rest is unavailable: Character not found"),
    );
    fireEvent.click(rest());
    expect(screen.queryByRole("button", { name: "Short rest" })).not.toBeInTheDocument();
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
    await waitFor(() => expect(sheet()).toHaveTextContent("full hp; 3/3 d8, 2/2 d10"));
    expect(screen.getByRole("status", { name: "" })).toHaveTextContent(
      /^Long rest applied\. Hit points 20, /,
    );
    expect(rest()).toHaveFocus();
  });

  it("writes nothing on cancel, and returns focus to the Rest button", async () => {
    const writes = renderLive(spent());
    fireEvent.click((await open("Short rest")).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(writes).toEqual([]);
    expect(rest()).toHaveFocus();
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
    expect(screen.getByRole("status", { name: "" })).toHaveTextContent(/^Long rest applied/);
  });

  it("keeps the sheet as it was and says so when the write fails", async () => {
    renderLive(spent(), { fail: true });
    const dialog = await open("Long rest");
    fireEvent.click(dialog.getByRole("button", { name: "Take the long rest" }));

    expect(await dialog.findByRole("alert")).toHaveTextContent("The rest was not applied");
    expect(sheet()).toHaveTextContent("12 hp; 1/3 d8");
  });

  describe("spending hit dice in a short rest", () => {
    const conModifier = derivedValue(derived().abilityModifiers.con);
    const regained = Math.max(0, 5 + conModifier);
    const rollsA = (face: number, faces: number) =>
      vi.spyOn(Math, "random").mockReturnValue((face - 1) / faces + 0.001);
    const openShort = async () => {
      const dialog = await open("Short rest");
      dialog.getByRole("heading", { name: "Spend hit dice" });
      return dialog;
    };
    const announced = (pattern: RegExp) =>
      screen.getAllByRole("status").some((node) => pattern.test(node.textContent ?? ""));

    it("rolls and heals tentatively, writing and logging nothing", async () => {
      rollsA(5, 8);
      const writes = renderLive(spent(), { character: classic() });
      const dialog = await openShort();

      fireEvent.click(dialog.getByRole("button", { name: "Roll d8, 1 of 3 left" }));
      const calculation = `d8: rolled 5 ${conModifier < 0 ? `- ${-conModifier}` : `+ ${conModifier}`} (Con) = ${regained} HP`;
      expect(dialog.getByRole("img", { name: calculation })).toHaveTextContent(`${regained}`);
      expect(dialog.getAllByRole("img", { name: "d8, spent" })).toHaveLength(2);
      expect(dialog.queryByRole("img", { name: "d8, not spent" })).not.toBeInTheDocument();
      expect(dialog.getByText(`+${regained} HP`)).toBeInTheDocument();
      expect(dialog.getByText("d8 · 0 of 3 left")).toBeInTheDocument();
      expect(dialog.getByText(`${12 + regained} / 20`)).toBeInTheDocument();
      expect(announced(new RegExp(`regained ${regained} hit points`))).toBe(true);

      expect(writes).toEqual([]);
      expect(rolls).toEqual([]);
      expect(sheet()).toHaveTextContent("12 hp; 1/3 d8");
    });

    it("lists the dice spent and the hit points they heal with the rest's recovery", async () => {
      rollsA(5, 8);
      renderLive(spent(), { character: classic() });
      const dialog = await openShort();
      fireEvent.click(dialog.getByRole("button", { name: "Roll d8, 1 of 3 left" }));
      expect(listed(dialog)).toEqual([
        `Hit points: 12 → ${12 + regained}`,
        "d8 Hit Dice: 1/3 → 0/3",
        "Pact Magic 1st Level slots: 0/1 → 1/1",
        "Ki: 0/2 → 2/2",
      ]);
    });

    it("writes every spend with the rest in one write, then logs each roll", async () => {
      rollsA(5, 10);
      const writes = renderLive(
        {
          ...spent(),
          hitPoints: { current: 2, temporary: 3 },
          hitDice: [
            { die: 8, total: 3, remaining: 1 },
            { die: 10, total: 2, remaining: 2 },
          ],
        },
        { character: classic() },
      );
      const dialog = await openShort();
      fireEvent.click(dialog.getByRole("button", { name: "Roll d10, 2 of 2 left" }));
      fireEvent.click(dialog.getByRole("button", { name: "Roll d10, 1 of 2 left" }));
      fireEvent.click(dialog.getByRole("button", { name: "Take the short rest" }));

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(writes).toHaveLength(1);
      expect(writes[0]).toMatchObject({
        hitPoints: { current: 2 + 2 * regained, temporary: 3 },
        hitDice: [
          { die: 8, total: 3, remaining: 1 },
          { die: 10, total: 2, remaining: 0 },
        ],
        pactSlots: { level: 1, total: 1, expended: 0 },
      });
      expect(rolls).toHaveLength(2);
      expect(rolls[0]).toMatchObject({ label: "Hit die d10", modifier: conModifier });
      await waitFor(() =>
        expect(sheet()).toHaveTextContent(`${2 + 2 * regained} hp; 1/3 d8, 0/2 d10`),
      );
      expect(screen.getByRole("status", { name: "" })).toHaveTextContent(/^Short rest applied\./);
      expect(rest()).toHaveFocus();
    });

    it.each([
      [
        "Cancel",
        (dialog: ReturnType<typeof within>) =>
          fireEvent.click(dialog.getByRole("button", { name: "Cancel" })),
      ],
      [
        "Escape",
        () => fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true })),
      ],
      [
        "a backdrop click",
        () => {
          fireEvent.pointerDown(screen.getByRole("dialog"));
          fireEvent.click(screen.getByRole("dialog"));
        },
      ],
    ])("discards every spend on %s and says so", async (_, close) => {
      rollsA(5, 8);
      const writes = renderLive(
        {
          ...spent(),
          hitDice: [
            { die: 8, total: 3, remaining: 2 },
            { die: 10, total: 2, remaining: 2 },
          ],
        },
        { character: classic() },
      );
      const dialog = await openShort();
      fireEvent.click(dialog.getByRole("button", { name: "Roll d8, 2 of 3 left" }));
      fireEvent.click(dialog.getByRole("button", { name: "Roll d8, 1 of 3 left" }));
      close(dialog);

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(writes).toEqual([]);
      expect(rolls).toEqual([]);
      expect(sheet()).toHaveTextContent("12 hp; 2/3 d8, 2/2 d10");
      expect(screen.getByRole("status", { name: "" })).toHaveTextContent(
        "Short rest cancelled. The 2 hit dice spent were discarded.",
      );
      expect(rest()).toHaveFocus();
    });

    it("keeps the spends and says the rest was not applied when the write fails", async () => {
      rollsA(5, 8);
      renderLive(spent(), { character: classic(), fail: true });
      const dialog = await openShort();
      fireEvent.click(dialog.getByRole("button", { name: "Roll d8, 1 of 3 left" }));
      fireEvent.click(dialog.getByRole("button", { name: "Take the short rest" }));

      expect(await dialog.findByRole("alert")).toHaveTextContent("The rest was not applied");
      expect(dialog.getByText("d8 · 0 of 3 left")).toBeInTheDocument();
      expect(dialog.getByRole("img", { name: /^d8: rolled 5/ })).toBeInTheDocument();
      expect(sheet()).toHaveTextContent("12 hp; 1/3 d8");
      expect(rolls).toEqual([]);
    });

    it("says so when the rest lands but a roll is not logged", async () => {
      rollsA(5, 8);
      const writes = renderLive(spent(), { character: classic(), failRolls: 1 });
      const dialog = await openShort();
      fireEvent.click(dialog.getByRole("button", { name: "Roll d8, 1 of 3 left" }));
      fireEvent.click(dialog.getByRole("button", { name: "Take the short rest" }));

      expect(await dialog.findByRole("alert")).toHaveTextContent(
        "The hit die rolls were not logged.",
      );
      expect(writes).toHaveLength(1);
      fireEvent.click(dialog.getByRole("button", { name: "Done" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.getByRole("status", { name: "" })).toHaveTextContent(/^Short rest applied\./);
    });

    it("says how many rolls were not logged when only some fail", async () => {
      rollsA(5, 10);
      renderLive(
        {
          ...spent(),
          hitPoints: { current: 2, temporary: 0 },
          hitDice: [{ die: 10, total: 2, remaining: 2 }],
        },
        { character: classic(), failRolls: 1 },
      );
      const dialog = await openShort();
      fireEvent.click(dialog.getByRole("button", { name: "Roll d10, 2 of 2 left" }));
      fireEvent.click(dialog.getByRole("button", { name: "Roll d10, 1 of 2 left" }));
      fireEvent.click(dialog.getByRole("button", { name: "Take the short rest" }));

      expect(await dialog.findByRole("alert")).toHaveTextContent(
        "1 of 2 hit die rolls were not logged.",
      );
      expect(rolls).toHaveLength(1);
    });

    it("drops a spend the stored state no longer allows, and neither writes nor logs it", async () => {
      rollsA(5, 8);
      const writes = renderLive(spent(), { character: classic() });
      const dialog = await openShort();
      fireEvent.click(dialog.getByRole("button", { name: "Roll d8, 1 of 3 left" }));
      expect(dialog.getByText(`+${regained} HP`)).toBeInTheDocument();

      storeElsewhere({ hitDice: [{ die: 8, total: 3, remaining: 0 }] });
      await waitFor(() => expect(sheet()).toHaveTextContent("12 hp; 0/3 d8"));
      expect(dialog.queryByText(`+${regained} HP`)).not.toBeInTheDocument();
      expect(dialog.queryByRole("img", { name: /^d8: rolled/ })).not.toBeInTheDocument();
      expect(dialog.getByRole("button", { name: "Undo the latest hit die spent" })).toHaveAttribute(
        "aria-disabled",
        "true",
      );

      fireEvent.click(dialog.getByRole("button", { name: "Take the short rest" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(writes[0]).toMatchObject({ hitPoints: { current: 12 } });
      expect(rolls).toEqual([]);
    });

    it("undoes the latest spend, one at a time, until none remain", async () => {
      const random = rollsA(5, 8);
      renderLive({ ...spent(), hitPoints: { current: 2, temporary: 0 } }, { character: classic() });
      const dialog = await openShort();
      const undo = dialog.getByRole("button", { name: "Undo the latest hit die spent" });
      expect(undo).toHaveAttribute("aria-disabled", "true");

      fireEvent.click(dialog.getByRole("button", { name: "Roll d8, 1 of 3 left" }));
      expect(undo).toHaveAttribute("aria-disabled", "false");
      random.mockReturnValue(2 / 10 + 0.001);
      fireEvent.click(dialog.getByRole("button", { name: "Roll d10, 2 of 2 left" }));
      const third = Math.max(0, 3 + conModifier);
      expect(dialog.getByText(`${2 + regained + third} / 20`)).toBeInTheDocument();

      fireEvent.click(undo);
      expect(dialog.getByText("d10 · 2 of 2 left")).toBeInTheDocument();
      expect(dialog.getByText("d8 · 0 of 3 left")).toBeInTheDocument();
      expect(dialog.getByText(`${2 + regained} / 20`)).toBeInTheDocument();
      expect(
        announced(
          new RegExp(
            `^Undid the d10 spend: ${third} hit points removed\\. Hit points ${2 + regained} of 20\\.$`,
          ),
        ),
      ).toBe(true);

      fireEvent.click(undo);
      expect(dialog.getByText("d8 · 1 of 3 left")).toBeInTheDocument();
      expect(listed(dialog)).toEqual(["Pact Magic 1st Level slots: 0/1 → 1/1", "Ki: 0/2 → 2/2"]);
      expect(undo).toHaveAttribute("aria-disabled", "true");
      fireEvent.click(undo);
      expect(dialog.getAllByRole("img", { name: "d8, spent" })).toHaveLength(2);
    });

    it("shows the calculation in a tooltip on hover and focus, and Escape dismisses it", async () => {
      rollsA(5, 8);
      renderLive(spent(), { character: classic() });
      const dialog = await openShort();
      fireEvent.click(dialog.getByRole("button", { name: "Roll d8, 1 of 3 left" }));
      const die = dialog.getByRole("img", { name: /^d8: rolled 5/ });
      const calculation = die.getAttribute("aria-label") ?? "";
      expect(dialog.queryByText(calculation)).not.toBeInTheDocument();

      fireEvent.mouseEnter(die);
      expect(dialog.getByText(calculation)).toBeInTheDocument();
      fireEvent.mouseLeave(die);
      expect(dialog.queryByText(calculation)).not.toBeInTheDocument();

      expect(die).toHaveAttribute("tabindex", "0");
      fireEvent.focus(die);
      expect(dialog.getByText(calculation)).toBeInTheDocument();
      expect(fireEvent.keyDown(die, { key: "Escape" })).toBe(false);
      expect(dialog.queryByText(calculation)).not.toBeInTheDocument();
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("says when the heal was capped at the maximum", async () => {
      rollsA(8, 8);
      renderLive(
        { ...spent(), hitPoints: { current: 19, temporary: 0 } },
        { character: classic() },
      );
      const dialog = await openShort();
      fireEvent.click(dialog.getByRole("button", { name: "Roll d8, 1 of 3 left" }));
      const die = dialog.getByRole("img", { name: /capped at max HP/ });
      expect(die).toHaveTextContent("1");
      expect(die).toHaveAccessibleName(/= 1 HP \(capped at max HP\)$/);
      expect(dialog.getByText("Hit points are full.")).toBeInTheDocument();
    });

    it("says when the heal was floored", async () => {
      rollsA(1, 8);
      const base = derived();
      const low = {
        ...base,
        abilityModifiers: {
          ...base.abilityModifiers,
          con: { computed: -3, manual: null, terms: [] },
        },
      };
      renderLive(spent(), { character: classic(), derivedBlock: low });
      const dialog = await openShort();
      fireEvent.click(dialog.getByRole("button", { name: "Roll d8, 1 of 3 left" }));
      expect(
        dialog.getByRole("img", { name: "d8: rolled 1 - 3 (Con) = 0 HP (floored to 0)" }),
      ).toHaveTextContent("0");
    });

    it("makes a pool with none left unavailable", async () => {
      rollsA(5, 8);
      renderLive(
        {
          ...spent(),
          hitDice: [
            { die: 8, total: 3, remaining: 1 },
            { die: 10, total: 2, remaining: 0 },
          ],
        },
        { character: classic() },
      );
      const dialog = await openShort();
      fireEvent.click(dialog.getByRole("button", { name: "Roll d8, 1 of 3 left" }));
      const button = dialog.getByRole("button", { name: "Roll d8, 0 of 3 left" });
      expect(button).toHaveAttribute("aria-disabled", "true");
      fireEvent.click(button);
      expect(dialog.getAllByRole("img", { name: /^d8: rolled/ })).toHaveLength(1);
      expect(dialog.getByText("No hit dice remain.")).toBeInTheDocument();
    });

    it("makes every die unavailable at maximum hit points", async () => {
      renderLive(
        { ...spent(), hitPoints: { current: null, temporary: 0 } },
        { character: classic() },
      );
      const dialog = await openShort();
      expect(dialog.getByText("Hit points are full.")).toBeInTheDocument();
      const button = dialog.getByRole("button", { name: "Roll d8, 1 of 3 left" });
      expect(button).toHaveAttribute("aria-disabled", "true");
      fireEvent.click(button);
      expect(dialog.queryByRole("img", { name: /^d8: rolled/ })).not.toBeInTheDocument();
    });

    it("makes every die unavailable for a dead character", async () => {
      renderLive(
        {
          ...spent(),
          hitPoints: { current: 0, temporary: 0 },
          deathSaves: { successes: 0, failures: 3 },
        },
        { character: classic() },
      );
      const dialog = await openShort();
      expect(dialog.getByText("Vex is dead.")).toBeInTheDocument();
      const button = dialog.getByRole("button", { name: "Roll d8, 1 of 3 left" });
      expect(button).toHaveAttribute("aria-disabled", "true");
      fireEvent.click(button);
      expect(dialog.queryByRole("img", { name: /^d8: rolled/ })).not.toBeInTheDocument();
    });

    it("offers no hit dice in a long rest", async () => {
      renderLive(spent());
      const dialog = await open("Long rest");
      expect(dialog.queryByRole("heading", { name: "Spend hit dice" })).not.toBeInTheDocument();
      expect(dialog.queryByRole("button", { name: /^Undo/ })).not.toBeInTheDocument();
    });
  });
});
