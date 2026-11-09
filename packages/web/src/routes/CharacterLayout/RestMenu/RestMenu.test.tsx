import {
  type CharacterDerived,
  type CharacterRecord,
  type CharacterState,
  derivedValue,
} from "@dnd/character";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
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

/**
 * Renders the menu beside what the sheet reads, over a stand-in API that keeps what each state
 * write sends, so a rest lands on the sheet as it would. `fail` answers every write with a
 * 500; `hold` keeps each write in flight until it settles.
 */
function renderLive(
  state: Partial<CharacterState>,
  {
    character = characterRecord("1", "Vex") as CharacterRecord,
    derivedBlock = derived(),
    fail = false,
    failRolls = false,
    hold = Promise.resolve(),
  } = {},
) {
  let stored = { ...stateRecord(), state: { ...stateRecord().state, ...state } };
  const writes: CharacterState[] = [];
  rolls.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith("/derived")) {
        return new Response(JSON.stringify(derivedBlock), { status: 200 });
      }
      if (init?.method === "POST" && String(input).endsWith("/rolls")) {
        if (failRolls) return new Response(JSON.stringify({ error: "Disk full" }), { status: 500 });
        const roll = JSON.parse(String(init.body));
        rolls.push(roll);
        return new Response(
          JSON.stringify({ ...roll, id: rolls.length, rolledAt: "2026-01-01T00:00:00.000Z" }),
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

  describe("spending hit dice after a short rest", () => {
    const conModifier = derivedValue(derived().abilityModifiers.con);
    const modifierLabel = conModifier < 0 ? `- ${-conModifier}` : `+ ${conModifier}`;
    const rollsA = (face: number, faces: number) =>
      vi.spyOn(Math, "random").mockReturnValue((face - 1) / faces + 0.001);
    const takeShort = async () => {
      const dialog = await open("Short rest");
      fireEvent.click(dialog.getByRole("button", { name: "Take the short rest" }));
      await dialog.findByRole("heading", { name: "Spend hit dice" });
      return dialog;
    };

    it("spends no die when the rest is cancelled", async () => {
      const writes = renderLive(spent());
      fireEvent.click((await open("Short rest")).getByRole("button", { name: "Cancel" }));
      expect(writes).toEqual([]);
      expect(rolls).toEqual([]);
    });

    it("rolls, heals, lowers the pool in one write and logs the roll", async () => {
      rollsA(5, 8);
      const writes = renderLive(spent(), { character: classic() });
      const dialog = await takeShort();
      expect(writes).toHaveLength(1);

      fireEvent.click(dialog.getByRole("button", { name: "Spend a d8, 1 of 3 left" }));
      await waitFor(() => expect(writes).toHaveLength(2));
      expect(writes[1]?.hitPoints).toEqual({
        current: 12 + Math.max(0, 5 + conModifier),
        temporary: 3,
      });
      expect(writes[1]?.hitDice[0]?.remaining).toBe(0);
      await waitFor(() => expect(rolls).toHaveLength(1));
      expect(rolls[0]).toMatchObject({ label: "Hit die d8", modifier: conModifier });
      expect(await dialog.findByRole("listitem")).toHaveTextContent(
        `d8: rolled 5 ${modifierLabel}, regained`,
      );
      expect(
        screen.getAllByRole("status").some((node) => /regained/.test(node.textContent ?? "")),
      ).toBe(true);
    });

    it("makes a pool with none left unavailable", async () => {
      rollsA(5, 8);
      const writes = renderLive(
        {
          ...spent(),
          hitDice: [
            { die: 8, total: 3, remaining: 1 },
            { die: 10, total: 2, remaining: 0 },
          ],
        },
        { character: classic() },
      );
      const dialog = await takeShort();
      const button = dialog.getByRole("button", { name: "Spend a d8, 1 of 3 left" });
      fireEvent.click(button);
      await waitFor(() =>
        expect(dialog.getByRole("button", { name: "Spend a d8, 0 of 3 left" })).toHaveAttribute(
          "aria-disabled",
          "true",
        ),
      );
      fireEvent.click(dialog.getByRole("button", { name: "Spend a d8, 0 of 3 left" }));
      expect(writes).toHaveLength(2);
      expect(dialog.getByText("No hit dice remain.")).toBeInTheDocument();
    });

    it("keeps the sheet as it was and says the die was not spent when the write fails", async () => {
      rollsA(5, 8);
      renderLive(spent(), { character: classic() });
      const dialog = await takeShort();
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(JSON.stringify({ error: "Disk full" }), { status: 500 })),
      );
      fireEvent.click(dialog.getByRole("button", { name: "Spend a d8, 1 of 3 left" }));
      expect(await dialog.findByRole("alert")).toHaveTextContent("The hit die was not spent");
      expect(rolls).toEqual([]);
    });

    it("says so on the page when the roll is not logged", async () => {
      rollsA(5, 8);
      const writes = renderLive(spent(), { character: classic(), failRolls: true });
      const dialog = await takeShort();
      fireEvent.click(dialog.getByRole("button", { name: "Spend a d8, 1 of 3 left" }));
      await waitFor(() => expect(writes).toHaveLength(2));
      expect(await dialog.findByRole("alert")).toHaveTextContent("The roll was not logged.");
      expect(await dialog.findByRole("listitem")).toHaveTextContent("regained");
    });

    it("makes every die unavailable for a dead character", async () => {
      const writes = renderLive(
        {
          ...spent(),
          hitPoints: { current: 0, temporary: 0 },
          deathSaves: { successes: 0, failures: 3 },
        },
        { character: classic() },
      );
      const dialog = await takeShort();
      expect(dialog.getByText("Vex is dead.")).toBeInTheDocument();
      const button = dialog.getByRole("button", { name: "Spend a d8, 1 of 3 left" });
      expect(button).toHaveAttribute("aria-disabled", "true");
      fireEvent.click(button);
      expect(writes).toHaveLength(1);
    });

    it("keeps each roll made when the dialog closes, and returns focus to Rest", async () => {
      rollsA(5, 8);
      const writes = renderLive(spent(), { character: classic() });
      const dialog = await takeShort();
      fireEvent.click(dialog.getByRole("button", { name: "Spend a d8, 1 of 3 left" }));
      await waitFor(() => expect(writes).toHaveLength(2));
      fireEvent.click(dialog.getByRole("button", { name: "Done" }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(rest()).toHaveFocus();
      expect(sheet()).toHaveTextContent(/0\/3 d8/);
    });
  });
});
