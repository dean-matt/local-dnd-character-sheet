import type { CharacterDerived, CharacterState } from "@dnd/character";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterRecord, derivedRecord, stateRecord } from "../../../../test/records.ts";
import { renderWithClient } from "../../../../test/renderWithClient.tsx";
import { SpellSlots } from "./SpellSlots.tsx";

const computed = (value: number) => ({ computed: value, manual: null, terms: [] });

const derived: CharacterDerived = {
  ...derivedRecord(),
  spellSlots: [
    { level: 1, total: computed(4) },
    { level: 2, total: { computed: 3, manual: 2, terms: [] } },
  ],
  pactSlots: { level: 3, total: computed(2) },
};

/**
 * Renders the card over a stand-in API that keeps each state write and answers later reads
 * with it. `fail` answers every write with a 500; `hold` keeps writes unanswered until `release`.
 */
function renderSlots(state: Partial<CharacterState>, { fail = false, hold = false } = {}) {
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
    renderWithClient(<SpellSlots character={characterRecord("1", "Vex")} derived={derived} />);
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

const card = () => within(screen.getByRole("region", { name: "Spell Slots" }));
const row = (spoken: string) =>
  within(card().getByText(`${spoken} slots`).closest("li") as HTMLElement);
const pips = (spoken: string) =>
  row(spoken)
    .getAllByRole("button")
    .filter((button) => /^(Expend|Restore) /.test(button.getAttribute("aria-label") ?? ""))
    .map((pip) => (pip.firstElementChild?.classList.contains("bg-accent") ? "x" : "o"))
    .join("");
/**
 * The last pip of that name. Pip n and the last expended pip n + 1 both leave n expended,
 * so they share a name, and the last of the two is the expended one.
 */
const pip = (name: string) => card().getAllByRole("button", { name }).at(-1) as HTMLElement;
const announced = () => card().getByRole("status");

afterEach(() => vi.unstubAllGlobals());

describe("SpellSlots", () => {
  it("fills each row's expended pips, no more pips than the total it shows", async () => {
    renderSlots({
      spellSlots: [
        { level: 1, total: 4, expended: 1 },
        { level: 2, total: 3, expended: 3 },
      ],
      pactSlots: { level: 3, total: 2, expended: 2 },
    });
    await screen.findByRole("region", { name: "Spell Slots" });

    expect(pips("1st Level")).toBe("xooo");
    expect(pips("2nd Level")).toBe("xx");
    expect(pips("Pact Magic, 3rd Level")).toBe("xx");
  });

  it("keeps a label on one line, the card as wide as its rows, and the pips wrapping inside it", async () => {
    renderSlots({ spellSlots: [{ level: 1, total: 4, expended: 0 }], pactSlots: null });
    const region = await screen.findByRole("region", { name: "Spell Slots" });

    expect(region).toHaveClass("w-fit", "max-w-full");
    const li = row("1st Level").getByText("1st Level").closest("li") as HTMLElement;
    expect(li.children[0]).toHaveClass("whitespace-nowrap");
    expect(li.children[1]).toHaveClass("flex-wrap", "min-w-0");
    expect(li.children[2]).toHaveClass("shrink-0");
  });

  it("spends every slot up to the pip clicked, writing only that level", async () => {
    const { writes } = renderSlots({ pactSlots: { level: 3, total: 2, expended: 1 } });
    await screen.findByRole("region", { name: "Spell Slots" });
    fireEvent.click(pip("Expend 1st Level slots 1 to 3"));

    await waitFor(() =>
      expect(announced()).toHaveTextContent("1st Level spell slots: 1 of 4 left."),
    );
    expect(writes[0]?.spellSlots).toEqual([{ level: 1, total: 4, expended: 3 }]);
    expect(writes[0]?.pactSlots).toEqual({ level: 3, total: 2, expended: 1 });
    expect(pips("1st Level")).toBe("xxxo");
  });

  it("offers no spend on a full row and no restore on an empty one", async () => {
    renderSlots({ spellSlots: [{ level: 2, total: 3, expended: 2 }] });
    await screen.findByRole("region", { name: "Spell Slots" });

    expect(row("2nd Level").queryByRole("button", { name: /^Expend/ })).toBeNull();
    expect(row("1st Level").queryByRole("button", { name: /^Restore/ })).toBeNull();
  });

  it("restores the last expended pip by itself, and those after an earlier one", async () => {
    const { writes } = renderSlots({ spellSlots: [{ level: 1, total: 4, expended: 3 }] });
    await screen.findByRole("region", { name: "Spell Slots" });
    fireEvent.click(pip("Restore 1st Level slot 3"));
    await waitFor(() => expect(pips("1st Level")).toBe("xxoo"));

    fireEvent.click(
      card().getAllByRole("button", { name: "Restore 1st Level slot 2" })[0] as HTMLElement,
    );
    await waitFor(() => expect(pips("1st Level")).toBe("xooo"));
    fireEvent.click(pip("Expend 1st Level slots 2 to 4"));
    await waitFor(() => expect(pips("1st Level")).toBe("xxxx"));
    fireEvent.click(pip("Restore 1st Level slots 2 to 4"));

    await waitFor(() =>
      expect(announced()).toHaveTextContent("1st Level spell slots: 3 of 4 left."),
    );
    expect(writes.map((write) => write.spellSlots[0]?.expended)).toEqual([2, 1, 4, 1]);
  });

  it("spends and restores a pact slot, leaving every regular row unchanged", async () => {
    const regular = [{ level: 1, total: 4, expended: 2 }];
    const { writes } = renderSlots({ spellSlots: regular });
    await screen.findByRole("region", { name: "Spell Slots" });
    fireEvent.click(pip("Expend Pact Magic, 3rd Level slot 1"));
    await waitFor(() => expect(pips("Pact Magic, 3rd Level")).toBe("xo"));
    fireEvent.click(pip("Restore Pact Magic, 3rd Level slot 1"));

    await waitFor(() =>
      expect(announced()).toHaveTextContent("Pact Magic, 3rd Level spell slots: 2 of 2 left."),
    );
    expect(writes.map((write) => write.pactSlots)).toEqual([
      { level: 3, total: 2, expended: 1 },
      { level: 3, total: 2, expended: 0 },
    ]);
    expect(writes.map((write) => write.spellSlots)).toEqual([regular, regular]);
    expect(pips("1st Level")).toBe("xxoo");
  });

  it("keeps a spend across a reload", async () => {
    const { reload } = renderSlots({});
    await screen.findByRole("region", { name: "Spell Slots" });
    fireEvent.click(pip("Expend 2nd Level slot 1"));
    await waitFor(() => expect(pips("2nd Level")).toBe("xo"));

    reload();
    await screen.findByRole("region", { name: "Spell Slots" });
    expect(pips("2nd Level")).toBe("xo");
  });

  it("takes no second write while one is in flight", async () => {
    const { writes, release } = renderSlots({}, { hold: true });
    await screen.findByRole("region", { name: "Spell Slots" });
    fireEvent.click(pip("Expend 1st Level slot 1"));
    await waitFor(() =>
      expect(pip("Expend 1st Level slots 1 to 2")).toHaveAttribute("aria-disabled", "true"),
    );
    fireEvent.click(pip("Expend 1st Level slots 1 to 2"));
    release();

    await waitFor(() => expect(pips("1st Level")).toBe("xooo"));
    expect(writes).toHaveLength(1);
  });

  it("shows the stored count and an error when a write fails", async () => {
    renderSlots({ spellSlots: [{ level: 1, total: 4, expended: 1 }] }, { fail: true });
    await screen.findByRole("region", { name: "Spell Slots" });
    fireEvent.click(pip("Expend 1st Level slots 2 to 4"));

    expect(await card().findByRole("alert")).toHaveTextContent(
      "Spell slots were not changed: Disk full",
    );
    expect(pips("1st Level")).toBe("xooo");
    expect(announced().textContent).toBe("");
  });
});
