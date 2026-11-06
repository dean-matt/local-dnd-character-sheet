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

  it("offers no spend on a spent pool, and neither restore nor reset on a full one", async () => {
    renderPools({
      classResources: [{ class: BARBARIAN, key: "rages", maximum: 3, expended: 3 }],
    });
    await screen.findByRole("region", { name: "Class Resources" });

    expect(card().queryByRole("button", { name: "Spend a use of Rages, Barbarian" })).toBeNull();
    expect(button("Restore a use of Rages, Barbarian")).toBeInTheDocument();
    expect(button("Spend a use of Focus points, Monk")).toBeInTheDocument();
    expect(
      card().queryByRole("button", { name: "Restore a use of Focus points, Monk" }),
    ).toBeNull();
    expect(card().queryByRole("button", { name: "Reset Focus points, Monk to full" })).toBeNull();
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
    expect(card().queryByRole("button", { name: "Reset Focus points, Monk to full" })).toBeNull();
  });

  it("moves focus to the row's first button left when a write removes the pressed one", async () => {
    renderPools({
      classResources: [{ class: MONK, key: "focus_points", maximum: 4, expended: 3 }],
    });
    await screen.findByRole("region", { name: "Class Resources" });
    const reset = button("Reset Focus points, Monk to full");
    reset.focus();
    fireEvent.click(reset);

    await waitFor(() =>
      expect(document.activeElement).toBe(button("Spend a use of Focus points, Monk")),
    );
  });

  it("keeps focus on a pressed button the write leaves in place", async () => {
    renderPools({});
    await screen.findByRole("region", { name: "Class Resources" });
    const spend = button("Spend a use of Rages, Barbarian");
    spend.focus();
    fireEvent.click(spend);

    await waitFor(() => expect(announced()).toHaveTextContent("2 of 3 left."));
    expect(document.activeElement).toBe(button("Spend a use of Rages, Barbarian"));
  });

  it("shows an Unlimited pool with no control", async () => {
    renderPools({});
    await screen.findByRole("region", { name: "Class Resources" });
    const unlimited = within(card().getAllByRole("listitem")[2] as HTMLElement);

    expect(unlimited.getByText("Unlimited")).toBeInTheDocument();
    expect(unlimited.queryByRole("button")).toBeNull();
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
});
