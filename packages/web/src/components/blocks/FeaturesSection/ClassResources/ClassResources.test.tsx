import type { CharacterDerived, CharacterState } from "@dnd/character";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterRecord, derivedRecord, stateRecord } from "../../../../test/records.ts";
import { renderWithClient } from "../../../../test/renderWithClient.tsx";
import { ClassResources } from "./ClassResources.tsx";

const computed = (value: number) => ({ computed: value, manual: null, terms: [] });

const BARBARIAN = { name: "Barbarian", source: "PHB" };
const MONK = { name: "Monk", source: "XPHB" };

const derived: CharacterDerived = {
  ...derivedRecord(),
  classResources: [
    { class: BARBARIAN, key: "rages", maximum: computed(3) },
    { class: MONK, key: "focus_points", maximum: { computed: 5, manual: 4, terms: [] } },
    { class: { name: "Barbarian", source: "XPHB" }, key: "rages", maximum: null },
  ],
};

/**
 * Renders the card over a stand-in API that keeps each state write and answers later reads
 * with it. `fail` answers every write with a 500; `hold` keeps writes unanswered until `release`.
 */
function renderPools(
  state: Partial<CharacterState>,
  { fail = false, hold = false, sheet = derived } = {},
) {
  let stored = { ...stateRecord(), state: { ...stateRecord().state, ...state } };
  const writes: CharacterState[] = [];
  let release = () => {};
  const held = hold ? new Promise<void>((resolve) => (release = resolve)) : Promise.resolve();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "PUT") {
        await held;
        if (fail) return new Response(JSON.stringify({ error: "Disk full" }), { status: 500 });
        const written = JSON.parse(String(init.body));
        writes.push(written);
        stored = { ...stored, state: written };
      }
      return new Response(JSON.stringify(stored), { status: 200 });
    }),
  );
  const render = () =>
    renderWithClient(<ClassResources character={characterRecord("1", "Vex")} derived={sheet} />);
  const view = render();
  return {
    writes,
    release: () => release(),
    reload() {
      view.unmount();
      render();
    },
  };
}

const card = () => within(screen.getByRole("region", { name: "Class Resources" }));
const item = (label: string, className: string) =>
  card()
    .getAllByRole("listitem")
    .find((li) => li.textContent?.startsWith(`${label} ${className}`)) as HTMLElement;
/** "2 / 3": the uses left, then the maximum the sheet shows. */
const count = (label: string, className: string) => {
  const [, left, maximum] = item(label, className).textContent?.match(/(\d+) \/ .*?(\d+)/) ?? [];
  return `${left} / ${maximum}`;
};
const button = (name: string) => card().getByRole("button", { name });
const announced = () => card().getByRole("status");

afterEach(() => vi.unstubAllGlobals());

describe("ClassResources", () => {
  it("lists each pool with its uses left out of the maximum the sheet shows", async () => {
    renderPools({
      classResources: [{ class: MONK, key: "focus_points", maximum: 5, expended: 1 }],
    });
    await screen.findByRole("region", { name: "Class Resources" });

    expect(count("Rages", "Barbarian")).toBe("3 / 3");
    expect(count("Focus points", "Monk")).toBe("3 / 4");
  });

  it("shows no card for a character with no pools", () => {
    renderPools({}, { sheet: { ...derived, classResources: [] } });

    expect(screen.queryByRole("region", { name: "Class Resources" })).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("spends a use, writing only that pool", async () => {
    const other = { class: MONK, key: "focus_points", maximum: 4, expended: 2 };
    const { writes } = renderPools({ classResources: [other] });
    await screen.findByRole("region", { name: "Class Resources" });
    fireEvent.click(button("Spend a use of Rages, Barbarian"));

    await waitFor(() => expect(announced()).toHaveTextContent("Rages, Barbarian: 2 of 3 left."));
    expect(writes[0]?.classResources).toEqual([
      other,
      { class: BARBARIAN, key: "rages", maximum: 3, expended: 1 },
    ]);
    expect(writes[0]?.spellSlots).toEqual(stateRecord().state.spellSlots);
  });

  it("shows minus, plus and refresh icons for each counted pool, with no text", async () => {
    renderPools({});
    await screen.findByRole("region", { name: "Class Resources" });
    const buttons = within(item("Rages", "Barbarian")).getAllByRole("button");

    expect(buttons.map((b) => b.getAttribute("aria-label"))).toEqual([
      "Spend a use of Rages, Barbarian",
      "Restore a use of Rages, Barbarian",
      "Reset Rages, Barbarian to full",
      "Start rage",
    ]);
    expect(buttons.map((b) => b.title)).toEqual([
      "Spend a use",
      "Restore a use",
      "Reset to full",
      "Start rage",
    ]);
    for (const b of buttons) {
      expect(b.textContent).toBe("");
      expect(b.querySelector("svg")).not.toBeNull();
    }
  });

  it("disables spend on a spent pool, and restore and reset on a full one", async () => {
    const { writes } = renderPools({
      classResources: [{ class: BARBARIAN, key: "rages", maximum: 3, expended: 3 }],
    });
    await screen.findByRole("region", { name: "Class Resources" });
    const disabled = [
      "Spend a use of Rages, Barbarian",
      "Restore a use of Focus points, Monk",
      "Reset Focus points, Monk to full",
    ];
    for (const name of disabled) {
      expect(button(name)).toHaveAttribute("aria-disabled", "true");
      fireEvent.click(button(name));
    }

    expect(button("Restore a use of Rages, Barbarian")).toHaveAttribute("aria-disabled", "false");
    expect(button("Spend a use of Focus points, Monk")).toHaveAttribute("aria-disabled", "false");
    expect(writes).toHaveLength(0);
    expect(announced().textContent).toBe("");
  });

  it("restores one use, then resets the pool to none spent", async () => {
    const { writes } = renderPools({
      classResources: [{ class: MONK, key: "focus_points", maximum: 4, expended: 3 }],
    });
    await screen.findByRole("region", { name: "Class Resources" });
    fireEvent.click(button("Restore a use of Focus points, Monk"));
    await waitFor(() => expect(announced()).toHaveTextContent("Focus points, Monk: 2 of 4 left."));
    fireEvent.click(button("Reset Focus points, Monk to full"));

    await waitFor(() => expect(announced()).toHaveTextContent("Focus points, Monk: 4 of 4 left."));
    expect(writes.map((write) => write.classResources[0]?.expended)).toEqual([2, 0]);
    expect(button("Reset Focus points, Monk to full")).toHaveAttribute("aria-disabled", "true");
  });

  it("keeps focus on Spend when spending the last use disables it", async () => {
    renderPools({
      classResources: [{ class: BARBARIAN, key: "rages", maximum: 3, expended: 2 }],
    });
    await screen.findByRole("region", { name: "Class Resources" });
    const spend = button("Spend a use of Rages, Barbarian");
    spend.focus();
    fireEvent.click(spend);

    await waitFor(() => expect(announced()).toHaveTextContent("Rages, Barbarian: 0 of 3 left."));
    expect(spend).toHaveAttribute("aria-disabled", "true");
    expect(document.activeElement).toBe(spend);
  });

  it("leaves focus where the user moved it before the write lands", async () => {
    const { release } = renderPools(
      { classResources: [{ class: MONK, key: "focus_points", maximum: 4, expended: 3 }] },
      { hold: true },
    );
    await screen.findByRole("region", { name: "Class Resources" });
    fireEvent.click(button("Reset Focus points, Monk to full"));
    const elsewhere = button("Spend a use of Rages, Barbarian");
    elsewhere.focus();
    release();

    await waitFor(() => expect(announced()).toHaveTextContent("Focus points, Monk: 4 of 4 left."));
    expect(document.activeElement).toBe(elsewhere);
  });

  it("shows an Unlimited pool with no use control", async () => {
    renderPools({});
    await screen.findByRole("region", { name: "Class Resources" });
    const unlimited = within(card().getAllByRole("listitem")[2] as HTMLElement);

    expect(unlimited.getByText("Unlimited")).toBeInTheDocument();
    expect(unlimited.getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual([
      "Start rage",
    ]);
  });

  it("keeps a spend across a reload", async () => {
    const { reload } = renderPools({});
    await screen.findByRole("region", { name: "Class Resources" });
    fireEvent.click(button("Spend a use of Rages, Barbarian"));
    await waitFor(() => expect(announced()).toHaveTextContent("2 of 3 left."));

    reload();
    await screen.findByRole("region", { name: "Class Resources" });
    expect(button("Restore a use of Rages, Barbarian")).toBeInTheDocument();
    expect(count("Rages", "Barbarian")).toBe("2 / 3");
  });

  it("takes no second write while one is in flight", async () => {
    const { writes, release } = renderPools({}, { hold: true });
    await screen.findByRole("region", { name: "Class Resources" });
    fireEvent.click(button("Spend a use of Rages, Barbarian"));
    await waitFor(() =>
      expect(button("Spend a use of Rages, Barbarian")).toHaveAttribute("aria-disabled", "true"),
    );
    fireEvent.click(button("Spend a use of Rages, Barbarian"));
    release();

    await waitFor(() => expect(announced()).toHaveTextContent("2 of 3 left."));
    expect(writes).toHaveLength(1);
  });

  it("shows the stored count and an error when a write fails", async () => {
    renderPools({}, { fail: true });
    await screen.findByRole("region", { name: "Class Resources" });
    fireEvent.click(button("Spend a use of Rages, Barbarian"));

    expect(await card().findByRole("alert")).toHaveTextContent(
      "Class resources were not changed: Disk full",
    );
    expect(count("Rages", "Barbarian")).toBe("3 / 3");
    expect(announced().textContent).toBe("");
  });

  describe("rage", () => {
    const start = (label: string, owner: string) =>
      within(item(label, owner)).getByRole("button", { name: "Start rage" });
    const end = () => within(item("Rages", "Barbarian")).getByRole("button", { name: "End rage" });

    it("starts a rage, spending a use and marking the character raging in one write", async () => {
      const { writes } = renderPools({});
      await screen.findByRole("region", { name: "Class Resources" });
      fireEvent.click(start("Rages", "Barbarian"));

      await waitFor(() => expect(announced()).toHaveTextContent("Rage started."));
      expect(writes).toHaveLength(1);
      expect(writes[0]?.classResources).toEqual([
        { class: BARBARIAN, key: "rages", maximum: 3, expended: 1 },
      ]);
      expect(writes[0]?.activeEffects).toEqual([{ name: "Rage" }]);
      expect(count("Rages", "Barbarian")).toBe("2 / 3");
    });

    it("starts a rage from an Unlimited pool without a count to run down", async () => {
      const { writes } = renderPools({});
      await screen.findByRole("region", { name: "Class Resources" });
      const unlimited = card().getAllByRole("listitem")[2] as HTMLElement;
      fireEvent.click(within(unlimited).getByRole("button", { name: "Start rage" }));

      await waitFor(() => expect(writes).toHaveLength(1));
      expect(writes[0]?.classResources).toEqual([]);
      expect(writes[0]?.activeEffects).toEqual([{ name: "Rage" }]);
    });

    it("is disabled with the reason when no use is left", async () => {
      const { writes } = renderPools({
        classResources: [{ class: BARBARIAN, key: "rages", maximum: 3, expended: 3 }],
      });
      await screen.findByRole("region", { name: "Class Resources" });

      expect(start("Rages", "Barbarian")).toHaveAttribute("aria-disabled", "true");
      expect(start("Rages", "Barbarian")).toHaveAttribute("title", "No Rage use left.");
      fireEvent.click(start("Rages", "Barbarian"));
      expect(writes).toHaveLength(0);
    });

    it("is disabled in heavy armor, even with an Unlimited pool", async () => {
      renderPools({}, { sheet: { ...derived, heavyArmorWorn: true } });
      await screen.findByRole("region", { name: "Class Resources" });

      expect(start("Rages", "Barbarian")).toHaveAttribute("title", "Heavy armor is worn.");
      expect(start("Rages", "Barbarian")).toHaveAttribute("aria-disabled", "true");
    });

    it("ends the rage, restoring no use", async () => {
      const { writes } = renderPools({
        classResources: [{ class: BARBARIAN, key: "rages", maximum: 3, expended: 1 }],
        activeEffects: [{ name: "Rage" }],
      });
      await screen.findByRole("region", { name: "Class Resources" });
      fireEvent.click(end());

      await waitFor(() => expect(announced()).toHaveTextContent("Rage ended."));
      expect(writes[0]?.activeEffects).toEqual([]);
      expect(writes[0]?.classResources[0]?.expended).toBe(1);
      expect(
        within(item("Rages", "Barbarian")).queryByRole("button", { name: "Start rage" }),
      ).not.toBeNull();
    });

    it("stays raging across a reload", async () => {
      const { reload } = renderPools({});
      await screen.findByRole("region", { name: "Class Resources" });
      fireEvent.click(start("Rages", "Barbarian"));
      await waitFor(() => expect(announced()).toHaveTextContent("Rage started."));

      reload();
      await screen.findByRole("region", { name: "Class Resources" });
      expect(end()).toBeInTheDocument();
    });
  });
});
