import type { CharacterDerived, CharacterState } from "@dnd/character";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterRecord, derivedRecord, stateRecord } from "../../../../test/records.ts";
import { renderWithClient } from "../../../../test/renderWithClient.tsx";
import { stubFetch, stubFetchByUrl } from "../../../../test/stubFetch.ts";
import { OnRolled, RollingFor } from "../../../rollerContext.ts";
import { renderVitals as renderWriting } from "./renderVitals.tsx";
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

/** The Status Effects card's announcer, beside the status line each picker field shows. */
const announced = () =>
  within(screen.getByRole("region", { name: "Status Effects" }))
    .getAllByRole("status")
    .find((region) => region.className === "sr-only");

const ring = async () => (await card("Hit Points")).getByRole("img");

afterEach(() => vi.unstubAllGlobals());

describe("Vitals", () => {
  it("sizes the Hit Points column to its content and gives the rest of the row to the card beside it", async () => {
    renderVitals({});

    const grid = (await card("Hit Points")).getByRole("img").closest(".grid");
    expect(grid).toHaveClass("md:grid-cols-[auto_1fr]");
  });

  it("reads current over maximum, and each die's remaining over its total", async () => {
    renderVitals({
      hitPoints: { current: 12, temporary: 0 },
      hitDice: [{ die: 8, total: 3, remaining: 1 }],
    });

    const hp = await card("Hit Points");
    expect(hp.getByText("12")).toBeInTheDocument();
    expect(hp.getByText("20")).toBeInTheDocument();
    expect(await ring()).toHaveAccessibleName("12 of 20 hit points");
    expect(hp.getByText("12")).not.toHaveClass("text-temporary");
    const pools = (await card("Hit Dice")).getAllByRole("listitem");
    expect(pools[0]).toHaveTextContent("1 / 3 d8");
    expect(pools[1]).toHaveTextContent("2 / 2 d10");
  });

  it("keeps the Hit Dice and their rolls off the Hit Points card", async () => {
    stubFetchByUrl({ "/api/characters/1/state": stateRecord() });
    renderWithClient(
      <RollingFor value="1">
        <Vitals character={characterRecord("1", "Vex")} derived={derived()} />
      </RollingFor>,
    );

    const hp = await card("Hit Points");
    expect(hp.queryByText(/Hit Di/)).not.toBeInTheDocument();
    expect(hp.queryByRole("list")).not.toBeInTheDocument();
    const dice = await card("Hit Dice");
    expect(dice.getByRole("button", { name: "Roll d8 Hit Die" })).toBeInTheDocument();
    expect(dice.getByRole("button", { name: "Roll d10 Hit Die" })).toBeInTheDocument();
  });

  it("drops the Hit Dice card for a character with no hit dice", async () => {
    renderVitals({ hitDice: [] }, { ...derived(), hitDice: [] });

    await card("Hit Points");
    expect(screen.queryByRole("region", { name: "Hit Dice" })).not.toBeInTheDocument();
  });

  it("reads a new character at its maximum", async () => {
    renderVitals({});

    const hp = await card("Hit Points");
    expect(hp.getAllByText("20")).toHaveLength(2);
    expect(await ring()).toHaveAccessibleName("20 of 20 hit points");
  });

  it("counts temporary hit points into the first number, and marks it", async () => {
    renderVitals({ hitPoints: { current: 20, temporary: 5 } });

    expect((await card("Hit Points")).getByText("25")).toHaveClass("text-temporary");
    expect(await ring()).toHaveAccessibleName("20 of 20 hit points, 5 temporary");
  });

  it("names a reduction to the maximum", async () => {
    renderVitals(
      {
        hitPoints: { current: 10, temporary: 0 },
        hitPointMaximumReduction: { amount: 5, clearsOnLongRest: true },
      },
      {
        ...derived(),
        hitPointMaximum: {
          computed: 15,
          manual: null,
          terms: [
            { label: "Hit dice", value: 20 },
            { label: "Maximum reduction", value: -5 },
          ],
        },
      },
    );

    expect(await ring()).toHaveAccessibleName("10 of 15 hit points, maximum reduced by 5");
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

  it("names the active effects beside the conditions, and none when there are none", async () => {
    renderVitals({ activeEffects: [{ name: "Rage" }] });
    expect(
      (await card("Status Effects")).getByText(/Active effects:/).parentElement,
    ).toHaveTextContent("Active effects: Rage");
  });

  it("shows no Active effects line while none is active", async () => {
    renderVitals({});
    await card("Status Effects");
    expect(screen.queryByText(/Active effects/)).toBeNull();
  });

  describe("changing conditions and exhaustion", () => {
    const status = () => within(screen.getByRole("region", { name: "Status Effects" }));
    const findInStatus = async (role: Parameters<typeof screen.getByRole>[0], options: object) =>
      within(await screen.findByRole("region", { name: "Status Effects" })).findByRole(
        role,
        options,
      );
    const chips = () =>
      status()
        .queryAllByRole("listitem")
        .map((chip) => chip.textContent);

    async function addCondition(name: string) {
      fireEvent.change(await screen.findByRole("combobox", { name: "Condition to add" }), {
        target: { value: name },
      });
      fireEvent.click(status().getByRole("button", { name: "Add condition" }));
    }

    it("adds a catalog condition without Exhaustion or a held one, and keeps it after a reload", async () => {
      const { writes, reload } = renderWriting({ conditions: [{ name: "Prone", source: "XPHB" }] });
      fireEvent.click(await screen.findByRole("combobox", { name: "Condition to add" }));
      const offered = (await screen.findAllByRole("option")).map((option) => option.textContent);
      expect(offered).toEqual(["Poisoned", "Stunned", "Unconscious"]);

      await addCondition("Poisoned");
      await waitFor(() => expect(writes).toHaveLength(1));
      expect(writes[0]?.conditions).toEqual([
        { name: "Prone", source: "XPHB" },
        { name: "Poisoned", source: "XPHB" },
      ]);
      await waitFor(() => expect(announced()).toHaveTextContent("Poisoned added"));

      reload();
      await screen.findByRole("combobox", { name: "Condition to add" });
      expect(chips()).toEqual(["Prone", "Poisoned"]);
    });

    it("adds a name outside the catalog as a custom condition, and keeps it after a reload", async () => {
      const { writes, reload } = renderWriting({});
      fireEvent.change(await screen.findByRole("combobox", { name: "Condition to add" }), {
        target: { value: "  Marked " },
      });
      fireEvent.click(status().getByRole("button", { name: "Add custom condition Marked" }));

      await waitFor(() => expect(writes).toHaveLength(1));
      expect(writes[0]?.customConditions).toEqual(["Marked"]);
      expect(writes[0]?.conditions).toEqual([]);
      await waitFor(() => expect(announced()).toHaveTextContent("Marked added"));

      reload();
      await screen.findByRole("combobox", { name: "Condition to add" });
      expect(chips()).toEqual(["Marked"]);
    });

    const atZero = (successes: number, failures: number) => ({
      hitPoints: { current: 0, temporary: 0 },
      deathSaves: { successes, failures },
    });

    it.each([
      ["dying", 0],
      ["stable", 3],
    ])(
      "shows Unconscious from 0 hit points while %s, with no remove control",
      async (_, successes) => {
        renderWriting({ ...atZero(successes, 0), customConditions: ["unconscious"] });
        fireEvent.click(await screen.findByRole("combobox", { name: "Condition to add" }));
        const offered = (await screen.findAllByRole("option")).map((option) => option.textContent);

        expect(chips()).toEqual(["Unconscious from 0 hit points"]);
        expect(status().queryByRole("button", { name: /^Remove/ })).not.toBeInTheDocument();
        expect(offered).not.toContain("Unconscious");
        expect(status().queryByText("No active conditions.")).not.toBeInTheDocument();
      },
    );

    it("drops Unconscious once healing lifts the character above 0", async () => {
      const { writes } = renderWriting(atZero(0, 1));
      expect(await findInStatus("listitem", {})).toHaveTextContent("Unconscious from 0 hit points");

      fireEvent.change(screen.getByRole("spinbutton", { name: "Hit point amount" }), {
        target: { value: "1" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Heal" }));

      await waitFor(() => expect(writes).toHaveLength(1));
      await waitFor(() => expect(chips()).toEqual([]));
      expect(status().getByText("No active conditions.")).toBeInTheDocument();
    });

    it("shows a dead character as dead, not Unconscious", async () => {
      renderWriting({ ...atZero(0, 3), conditions: [{ name: "Unconscious", source: "XPHB" }] });

      expect(await (await card("Death Saves")).findByText("Dead")).toBeInTheDocument();
      expect(chips()).toEqual([]);
    });

    it("removes a custom condition, and it stays gone after a reload", async () => {
      const { writes, reload } = renderWriting({ customConditions: ["Marked", "Cursed"] });
      fireEvent.click(await findInStatus("button", { name: "Remove Marked" }));

      await waitFor(() => expect(writes).toHaveLength(1));
      expect(writes[0]?.customConditions).toEqual(["Cursed"]);
      await waitFor(() => expect(announced()).toHaveTextContent("Marked removed"));

      reload();
      await screen.findByRole("combobox", { name: "Condition to add" });
      expect(chips()).toEqual(["Cursed"]);
    });

    it("offers no custom condition for a held, catalog or Exhaustion name in any case", async () => {
      renderWriting({ customConditions: ["Marked"] });
      for (const typed of ["marked", "PRONE", "exhaustion", "  ", ""]) {
        fireEvent.change(await screen.findByRole("combobox", { name: "Condition to add" }), {
          target: { value: typed },
        });
        expect(
          status().queryByRole("button", { name: /^Add custom condition/ }),
        ).not.toBeInTheDocument();
      }
    });

    it("disables Add condition while the field is empty", async () => {
      const { writes } = renderWriting({});
      fireEvent.change(await screen.findByRole("combobox", { name: "Condition to add" }), {
        target: { value: "" },
      });

      expect(status().getByRole("button", { name: "Add condition" })).toHaveAttribute(
        "aria-disabled",
        "true",
      );
      expect(writes).toHaveLength(0);
    });

    it.each([
      ["still loading", () => new Promise<Response>(() => {})],
      ["failed", async () => new Response("{}", { status: 500 })],
    ])("offers no custom condition while the catalog is %s", async (_, search) => {
      const record = stateRecord();
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: RequestInfo | URL) =>
          String(input).includes("/search")
            ? search()
            : new Response(JSON.stringify(record), { status: 200 }),
        ),
      );
      renderWithClient(<Vitals character={characterRecord("1", "Vex")} derived={derived()} />);
      fireEvent.change(await screen.findByRole("combobox", { name: "Condition to add" }), {
        target: { value: "Prone" },
      });
      expect(
        status().queryByRole("button", { name: /^Add custom condition/ }),
      ).not.toBeInTheDocument();
    });

    it("removes every reference under a name", async () => {
      const poisoned = { name: "Poisoned", source: "XPHB" };
      const { writes } = renderWriting({
        conditions: [poisoned, { name: "Prone", source: "XPHB" }, { ...poisoned, source: "PHB" }],
      });
      fireEvent.click(await findInStatus("button", { name: "Remove Poisoned" }));

      await waitFor(() => expect(writes).toHaveLength(1));
      expect(writes[0]?.conditions).toEqual([{ name: "Prone", source: "XPHB" }]);
      await waitFor(() => expect(announced()).toHaveTextContent("Poisoned removed"));
    });

    it("steps exhaustion by one within 0 to 6", async () => {
      const { writes } = renderWriting({ exhaustion: 5 });
      const raise = await findInStatus("button", { name: "Raise exhaustion" });
      const lower = status().getByRole("button", { name: "Lower exhaustion" });
      fireEvent.click(raise);
      await waitFor(() => expect(writes.at(-1)?.exhaustion).toBe(6));
      await waitFor(() => expect(raise).toHaveAttribute("aria-disabled", "true"));
      expect(chips()).toEqual(["Exhaustion 6"]);
      expect(announced()).toHaveTextContent("Exhaustion 6");

      fireEvent.click(raise);
      expect(writes).toHaveLength(1);

      for (let level = 5; level >= 0; level--) {
        fireEvent.click(lower);
        await waitFor(() => expect(writes.at(-1)?.exhaustion).toBe(level));
      }
      await waitFor(() => expect(lower).toHaveAttribute("aria-disabled", "true"));
      expect(chips()).toEqual([]);
      fireEvent.click(lower);
      expect(writes).toHaveLength(7);
    });

    it("makes each add, remove and step one state write, so one undo entry", async () => {
      const { writes } = renderWriting({ conditions: [{ name: "Prone", source: "XPHB" }] });
      await addCondition("Poisoned");
      await waitFor(() => expect(writes).toHaveLength(1));

      fireEvent.click(await findInStatus("button", { name: "Remove Prone" }));
      await waitFor(() => expect(writes).toHaveLength(2));

      fireEvent.click(await findInStatus("button", { name: "Raise exhaustion" }));
      await waitFor(() => expect(writes).toHaveLength(3));
      expect(writes.map((write) => [write.conditions.length, write.exhaustion])).toEqual([
        [2, 0],
        [1, 0],
        [1, 1],
      ]);
    });

    it("makes each custom add and remove one state write", async () => {
      const { writes } = renderWriting({});
      fireEvent.change(await screen.findByRole("combobox", { name: "Condition to add" }), {
        target: { value: "Marked" },
      });
      fireEvent.click(status().getByRole("button", { name: "Add custom condition Marked" }));
      await waitFor(() => expect(writes).toHaveLength(1));

      fireEvent.click(await findInStatus("button", { name: "Remove Marked" }));
      await waitFor(() => expect(writes).toHaveLength(2));
      expect(writes.map((write) => write.customConditions)).toEqual([["Marked"], []]);
    });

    it("names a failed write for a condition or a step alike", async () => {
      renderWriting({ exhaustion: 1 }, { fail: true });
      fireEvent.click(await findInStatus("button", { name: "Raise exhaustion" }));

      expect(await status().findByRole("alert")).toHaveTextContent(
        "Status effects were not changed: Disk full",
      );
    });
  });

  describe("concentration", () => {
    const status = () => within(screen.getByRole("region", { name: "Status Effects" }));
    const bless = { spell: { name: "Bless", source: "XPHB" }, level: 1 };
    const holdPerson = { name: "Hold Person", source: "XPHB" };
    const heldLine = async () =>
      (
        await within(await screen.findByRole("region", { name: "Status Effects" })).findByText(
          /Concentrating on/,
        )
      ).closest("p");

    async function pickSpell(name: string) {
      fireEvent.focus(await screen.findByRole("combobox", { name: "Concentrate on a spell" }));
      fireEvent.click(await screen.findByRole("option", { name: new RegExp(`^${name}`) }));
    }

    async function chooseLevel(label: string) {
      const level = await status().findByRole("combobox", { name: "Spell level" });
      await waitFor(() => expect(level).toHaveTextContent(/Level|Cantrip/));
      fireEvent.click(level);
      fireEvent.click(screen.getByRole("option", { name: label }));
    }

    it("shows the held spell and its level, and nothing for concentration when none is held", async () => {
      renderWriting({ concentration: { ...bless, level: 3 } });
      await screen.findByRole("region", { name: "Status Effects" });
      expect(await heldLine()).toHaveTextContent("Concentrating on Bless, level 3");

      cleanup();
      renderWriting({});
      await screen.findByRole("region", { name: "Status Effects" });
      await screen.findByRole("combobox", { name: "Concentrate on a spell" });
      expect(status().queryByText(/Concentrating on/)).toBeNull();
      expect(status().queryByRole("button", { name: "End concentration" })).toBeNull();
    });

    it("names a held homebrew spell from its row", async () => {
      renderWriting({ concentration: { spell: { homebrewId: "hb1" }, level: 9 } });
      await screen.findByRole("region", { name: "Status Effects" });
      await waitFor(async () =>
        expect(await heldLine()).toHaveTextContent("Concentrating on Hexing Ward, level 9"),
      );
    });

    it("searches only spells that need concentration", async () => {
      const { searches } = renderWriting({});
      await screen.findByRole("region", { name: "Status Effects" });
      fireEvent.focus(await screen.findByRole("combobox", { name: "Concentrate on a spell" }));
      await screen.findByRole("option", { name: /^Hold Person/ });
      expect(searches.every((url) => url.includes("concentration=true"))).toBe(true);
    });

    it("sets a spell at a chosen level from its own up, its own by default", async () => {
      const { writes, reload } = renderWriting({});
      await screen.findByRole("region", { name: "Status Effects" });
      await pickSpell("Hold Person");
      const level = await status().findByRole("combobox", { name: "Spell level" });
      await waitFor(() => expect(level).toHaveTextContent("Level 2"));
      fireEvent.click(level);
      expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(
        [2, 3, 4, 5, 6, 7, 8, 9].map((each) => `Level ${each}`),
      );
      fireEvent.click(screen.getByRole("option", { name: "Level 4" }));
      fireEvent.click(status().getByRole("button", { name: "Concentrate" }));

      await waitFor(() => expect(writes).toHaveLength(1));
      expect(writes[0]?.concentration).toEqual({ spell: holdPerson, level: 4 });
      await waitFor(() =>
        expect(announced()).toHaveTextContent("Concentrating on Hold Person at level 4"),
      );
      await waitFor(() =>
        expect(status().getByRole("button", { name: "End concentration" })).toHaveFocus(),
      );

      reload();
      expect(await heldLine()).toHaveTextContent("Concentrating on Hold Person, level 4");
    });

    it("sets a homebrew spell by its id at its own level", async () => {
      const { writes } = renderWriting({});
      await screen.findByRole("region", { name: "Status Effects" });
      await pickSpell("Hexing Ward");
      await chooseLevel("Level 9");
      fireEvent.click(status().getByRole("button", { name: "Concentrate" }));

      await waitFor(() => expect(writes).toHaveLength(1));
      expect(writes[0]?.concentration).toEqual({ spell: { homebrewId: "hb1" }, level: 9 });
    });

    it("replaces a held spell and names the one it ends", async () => {
      const { writes } = renderWriting({ concentration: bless });
      await screen.findByRole("region", { name: "Status Effects" });
      await pickSpell("Hold Person");
      expect(status().getByText("Ends concentration on Bless.")).toBeInTheDocument();
      await chooseLevel("Level 2");
      fireEvent.click(status().getByRole("button", { name: "Concentrate" }));

      await waitFor(() => expect(writes).toHaveLength(1));
      expect(writes[0]?.concentration).toEqual({ spell: holdPerson, level: 2 });
      await waitFor(() =>
        expect(announced()).toHaveTextContent(
          "Concentrating on Hold Person at level 2; Bless ended",
        ),
      );
    });

    it("ends the held concentration and nothing else", async () => {
      const prone = { name: "Prone", source: "XPHB" };
      const { writes, reload } = renderWriting({ concentration: bless, conditions: [prone] });
      await screen.findByRole("region", { name: "Status Effects" });
      fireEvent.click(await status().findByRole("button", { name: "End concentration" }));

      await waitFor(() => expect(writes).toHaveLength(1));
      expect(writes[0]?.concentration).toBeNull();
      expect(writes[0]?.conditions).toEqual([prone]);
      await waitFor(() => expect(announced()).toHaveTextContent("Concentration on Bless ended"));

      await waitFor(() =>
        expect(screen.getByRole("combobox", { name: "Concentrate on a spell" })).toHaveFocus(),
      );

      reload();
      await screen.findByRole("combobox", { name: "Concentrate on a spell" });
      expect(status().queryByText(/Concentrating on/)).toBeNull();
    });

    it("ends concentration in the write that adds a condition that incapacitates", async () => {
      const { writes } = renderWriting({ concentration: bless, conditions: [] });
      fireEvent.change(await screen.findByRole("combobox", { name: "Condition to add" }), {
        target: { value: "Stunned" },
      });
      fireEvent.click(status().getByRole("button", { name: "Add condition" }));

      await waitFor(() => expect(writes).toHaveLength(1));
      expect(writes[0]).toMatchObject({
        conditions: [{ name: "Stunned", source: "XPHB" }],
        concentration: null,
      });
      await waitFor(() =>
        expect(announced()).toHaveTextContent(/^Stunned added; concentration ended$/),
      );
    });

    it("keeps concentration when the condition added does not incapacitate", async () => {
      const { writes } = renderWriting({ concentration: bless, conditions: [] });
      fireEvent.change(await screen.findByRole("combobox", { name: "Condition to add" }), {
        target: { value: "Poisoned" },
      });
      fireEvent.click(status().getByRole("button", { name: "Add condition" }));

      await waitFor(() => expect(writes).toHaveLength(1));
      expect(writes[0]?.concentration).toEqual(bless);
      await waitFor(() => expect(announced()).toHaveTextContent(/^Poisoned added$/));
    });

    it("makes each set and end one state write, so one undo entry", async () => {
      const { writes } = renderWriting({ concentration: bless });
      await screen.findByRole("region", { name: "Status Effects" });
      await pickSpell("Hold Person");
      await chooseLevel("Level 2");
      fireEvent.click(status().getByRole("button", { name: "Concentrate" }));
      await waitFor(() => expect(writes).toHaveLength(1));

      fireEvent.click(await status().findByRole("button", { name: "End concentration" }));
      await waitFor(() => expect(writes).toHaveLength(2));
      expect(writes.map((write) => write.concentration)).toEqual([
        { spell: holdPerson, level: 2 },
        null,
      ]);
    });

    it("cancels a pick without a write, and returns focus to the picker", async () => {
      const { writes } = renderWriting({});
      await screen.findByRole("region", { name: "Status Effects" });
      await pickSpell("Bless");
      expect(status().getByRole("button", { name: "Concentrate" })).toHaveFocus();
      fireEvent.click(status().getByRole("button", { name: "Cancel" }));

      expect(screen.getByRole("combobox", { name: "Concentrate on a spell" })).toHaveFocus();
      expect(writes).toHaveLength(0);
    });
  });

  it("reports a state the API could not answer", async () => {
    stubFetch(new Response(JSON.stringify({ error: "Character not found" }), { status: 404 }));
    renderWithClient(<Vitals character={characterRecord("1", "Vex")} derived={derived()} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Character not found");
  });
});

describe("Hit Dice rolls", () => {
  const logged = {
    id: 1,
    characterId: "1",
    characterName: "Vex",
    rolledAt: "2026-01-01T00:00:00.000Z",
    label: "d8 Hit Die",
    notation: "1d8+2",
    total: 5,
    dice: [],
    modifier: 2,
    critical: false,
  };

  function renderRolling(status = 201, recording = true) {
    const base = derived();
    const block = {
      ...base,
      abilityModifiers: { ...base.abilityModifiers, con: { computed: 2, manual: null, terms: [] } },
    };
    const calls: { url: string; method?: string; body?: Record<string, unknown> }[] = [];
    const onRolled = vi.fn();
    const state = stateRecord();
    vi.stubGlobal("fetch", async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({
        url: String(url),
        method: init?.method,
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });
      if (String(url) === "/api/characters/1/rolls") {
        return new Response(JSON.stringify(init?.method === "POST" ? logged : []), { status });
      }
      return new Response(JSON.stringify(state), { status: 200 });
    });
    const sheet = <Vitals character={characterRecord("1", "Vex")} derived={block} />;
    renderWithClient(
      recording ? (
        <RollingFor value="1">
          <OnRolled value={onRolled}>{sheet}</OnRolled>
        </RollingFor>
      ) : (
        sheet
      ),
    );
    return { calls, onRolled };
  }

  it("rolls a pool's die plus Constitution, labels it, and opens the Roll Log on it", async () => {
    const { calls, onRolled } = renderRolling();
    fireEvent.click(await screen.findByRole("button", { name: "Roll d10 Hit Die" }));

    await waitFor(() => expect(onRolled).toHaveBeenCalledWith(logged));
    const post = calls.find((call) => call.method === "POST");
    expect(post?.body).toMatchObject({
      type: "hit-die",
      label: "d10 Hit Die",
      notation: "1d10+2",
      modifier: 2,
    });
    expect(screen.getByRole("button", { name: "Roll d8 Hit Die" })).toBeInTheDocument();
  });

  it("announces the roll, and that it was not logged when the server refuses it", async () => {
    renderRolling(500);
    fireEvent.click(await screen.findByRole("button", { name: "Roll d8 Hit Die" }));

    await waitFor(() =>
      expect(screen.getAllByRole("status").map((status) => status.textContent)).toContainEqual(
        expect.stringMatching(/^d8 Hit Die: \d+, not logged$/),
      ),
    );
  });

  it("announces the total when it was logged", async () => {
    renderRolling();
    fireEvent.click(await screen.findByRole("button", { name: "Roll d8 Hit Die" }));

    await waitFor(() =>
      expect(screen.getAllByRole("status").map((status) => status.textContent)).toContainEqual(
        expect.stringMatching(/^d8 Hit Die: \d+$/),
      ),
    );
  });

  it("changes no state: a roll writes nothing but the roll log, and spends no die", async () => {
    const { calls } = renderRolling();
    fireEvent.click(await screen.findByRole("button", { name: "Roll d8 Hit Die" }));

    await waitFor(() => expect(calls.some((call) => call.method === "POST")).toBe(true));
    expect(calls.filter((call) => call.method === "PUT")).toEqual([]);
  });

  it("shows no roll button where there is no character to record to", async () => {
    renderRolling(201, false);
    await screen.findByText("Hit Dice");
    expect(screen.queryByRole("button", { name: /Hit Die$/ })).not.toBeInTheDocument();
  });
});
