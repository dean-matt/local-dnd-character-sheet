import type { CharacterDerived, CharacterState } from "@dnd/character";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterRecord, derivedRecord, stateRecord } from "../../../../test/records.ts";
import { renderWithClient } from "../../../../test/renderWithClient.tsx";
import { stubFetch, stubFetchByUrl } from "../../../../test/stubFetch.ts";
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
    expect(hp.queryByText(/^\+\d+ temp$/)).not.toBeInTheDocument();
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
      expect(offered).toEqual(["Poisoned", "Stunned"]);

      await addCondition("Poisoned");
      await waitFor(() => expect(writes).toHaveLength(1));
      expect(writes[0]?.conditions).toEqual([
        { name: "Prone", source: "XPHB" },
        { name: "Poisoned", source: "XPHB" },
      ]);
      await waitFor(() => expect(status().getByRole("status")).toHaveTextContent("Poisoned added"));

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
      await waitFor(() => expect(status().getByRole("status")).toHaveTextContent("Marked added"));

      reload();
      await screen.findByRole("combobox", { name: "Condition to add" });
      expect(chips()).toEqual(["Marked"]);
    });

    it("removes a custom condition, and it stays gone after a reload", async () => {
      const { writes, reload } = renderWriting({ customConditions: ["Marked", "Cursed"] });
      fireEvent.click(await findInStatus("button", { name: "Remove Marked" }));

      await waitFor(() => expect(writes).toHaveLength(1));
      expect(writes[0]?.customConditions).toEqual(["Cursed"]);
      await waitFor(() => expect(status().getByRole("status")).toHaveTextContent("Marked removed"));

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

    it("adds nothing for a name outside the list until it is offered as custom", async () => {
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

    it("removes every reference under a name", async () => {
      const poisoned = { name: "Poisoned", source: "XPHB" };
      const { writes } = renderWriting({
        conditions: [poisoned, { name: "Prone", source: "XPHB" }, { ...poisoned, source: "PHB" }],
      });
      fireEvent.click(await findInStatus("button", { name: "Remove Poisoned" }));

      await waitFor(() => expect(writes).toHaveLength(1));
      expect(writes[0]?.conditions).toEqual([{ name: "Prone", source: "XPHB" }]);
      await waitFor(() =>
        expect(status().getByRole("status")).toHaveTextContent("Poisoned removed"),
      );
    });

    it("steps exhaustion by one within 0 to 6", async () => {
      const { writes } = renderWriting({ exhaustion: 5 });
      const raise = await findInStatus("button", { name: "Raise exhaustion" });
      const lower = status().getByRole("button", { name: "Lower exhaustion" });
      fireEvent.click(raise);
      await waitFor(() => expect(writes.at(-1)?.exhaustion).toBe(6));
      await waitFor(() => expect(raise).toHaveAttribute("aria-disabled", "true"));
      expect(chips()).toEqual(["Exhaustion 6"]);
      expect(status().getByRole("status")).toHaveTextContent("Exhaustion 6");

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

  it("reports a state the API could not answer", async () => {
    stubFetch(new Response(JSON.stringify({ error: "Character not found" }), { status: 404 }));
    renderWithClient(<Vitals character={characterRecord("1", "Vex")} derived={derived()} />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Character not found");
  });
});
