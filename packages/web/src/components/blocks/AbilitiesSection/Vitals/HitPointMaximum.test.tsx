import type { CharacterDerived } from "@dnd/character";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { derivedRecord, stateRecord } from "../../../../test/records.ts";
import { renderWithClient } from "../../../../test/renderWithClient.tsx";
import { SaveOverride } from "../../../overrideContext.ts";
import { HitPointMaximum } from "./HitPointMaximum.tsx";
import { renderVitals, vex } from "./renderVitals.tsx";

const hp = () => within(screen.getByRole("region", { name: "Hit Points" }));
const breakdown = () => screen.getByRole("group", { name: "Hit point maximum breakdown" });
const field = (name: string) => within(breakdown()).getByRole("textbox", { name });
const lasts = () => within(breakdown()).queryByRole("checkbox", { name: "Lasts past a long rest" });
const announced = () =>
  hp()
    .getAllByRole("status")
    .find((region) => region.className === "sr-only")?.textContent;

/** A 20 maximum reduced by 5, as the derived block shows it with the reduction held. */
const reducedMaximum = {
  computed: 15,
  manual: null,
  terms: [
    { label: "Hit dice", value: 20 },
    { label: "Maximum reduction", value: -5 },
  ],
};

async function open(name = "Hit point maximum 20") {
  fireEvent.click(await screen.findByRole("button", { name }));
}

function type(name: string, value: string) {
  fireEvent.change(field(name), { target: { value } });
  fireEvent.blur(field(name), { relatedTarget: breakdown() });
}

afterEach(() => vi.unstubAllGlobals());

describe("the hit point maximum's breakdown", () => {
  it("opens on hover or focus, and a click keeps it open until the player closes it", async () => {
    renderVitals({});
    const trigger = await screen.findByRole("button", { name: "Hit point maximum 20" });
    expect(trigger).toHaveAttribute("title", "Breakdown, temporary hit points and reduction");
    expect(trigger).toHaveClass("decoration-dotted");

    vi.useFakeTimers();
    try {
      fireEvent.focus(trigger);
      expect(breakdown()).toBeInTheDocument();
      expect(within(breakdown()).queryByRole("button", { name: "Close" })).toBeNull();
      fireEvent.keyDown(trigger, { key: "Escape" });
      fireEvent.mouseEnter(trigger);
      expect(breakdown()).toBeInTheDocument();
      fireEvent.click(trigger);
      fireEvent.mouseLeave(trigger);
      act(() => vi.advanceTimersByTime(1000));
      expect(breakdown()).toBeInTheDocument();
      fireEvent.click(within(breakdown()).getByRole("button", { name: "Close" }));
      expect(screen.queryByRole("group", { name: "Hit point maximum breakdown" })).toBeNull();
      expect(trigger).toHaveFocus();
    } finally {
      vi.useRealTimers();
    }
  });

  it("leaves the card no buttons for temporary hit points or the reduction", async () => {
    renderVitals(
      {
        hitPoints: { current: 10, temporary: 3 },
        hitPointMaximumReduction: { amount: 5, clearsOnLongRest: true },
      },
      { hitPointMaximum: reducedMaximum },
    );
    await screen.findByRole("button", { name: "Damage" });
    for (const name of [
      "Grant temp",
      "Clear temp",
      "Reduce maximum",
      "Change reduction",
      "Clear reduction",
    ]) {
      expect(hp().queryByRole("button", { name })).toBeNull();
    }
  });

  it("lists temporary hit points apart from the maximum's terms", async () => {
    renderVitals(
      { hitPoints: { current: 10, temporary: 3 } },
      {
        hitPointMaximum: { computed: 20, manual: null, terms: [{ label: "Hit dice", value: 20 }] },
      },
    );
    await open();

    expect(field("Temporary hit points")).toHaveValue("3");
    const terms = within(breakdown()).getByRole("list");
    expect(within(terms).queryByText("Temporary")).toBeNull();
    expect(within(terms).getByText("Hit dice")).toBeInTheDocument();
  });

  it("sets temporary hit points in one write, and clears them", async () => {
    const { writes } = renderVitals({ hitPoints: { current: 10, temporary: 3 } });
    await open();
    type("Temporary hit points", "7");

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]?.hitPoints).toEqual({ current: 10, temporary: 7 });
    await waitFor(() => expect(announced()).toBe("7 temporary hit points."));

    type("Temporary hit points", "");
    await waitFor(() => expect(writes).toHaveLength(2));
    expect(writes[1]?.hitPoints).toEqual({ current: 10, temporary: 0 });
    await waitFor(() => expect(announced()).toBe("Temporary hit points cleared."));
  });

  it("sets a reduction a long rest clears in one write, lowering hit points above it", async () => {
    const { writes } = renderVitals({ hitPoints: { current: 18, temporary: 0 } });
    await open();
    expect(lasts()).toBeNull();
    type("Hit point maximum reduction", "5");

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toMatchObject({
      hitPoints: { current: 15, temporary: 0 },
      hitPointMaximumReduction: { amount: 5, clearsOnLongRest: true },
    });
    await waitFor(() =>
      expect(announced()).toBe("Maximum reduced by 5, until a long rest. 15 hit points."),
    );
    expect(lasts()).not.toBeChecked();
  });

  it("changes a held reduction, keeping whether it lasts past a long rest, and clears it", async () => {
    const { writes } = renderVitals(
      {
        hitPoints: { current: 15, temporary: 0 },
        hitPointMaximumReduction: { amount: 5, clearsOnLongRest: false },
      },
      { hitPointMaximum: reducedMaximum },
    );
    await open("Hit point maximum 15");
    expect(field("Hit point maximum reduction")).toHaveValue("5");
    expect(lasts()).toBeChecked();
    type("Hit point maximum reduction", "8");

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toMatchObject({
      hitPoints: { current: 12, temporary: 0 },
      hitPointMaximumReduction: { amount: 8, clearsOnLongRest: false },
    });

    type("Hit point maximum reduction", "");
    await waitFor(() => expect(writes).toHaveLength(2));
    expect(writes[1]).toMatchObject({
      hitPoints: { current: 12, temporary: 0 },
      hitPointMaximumReduction: null,
    });
    await waitFor(() => expect(announced()).toBe("Reduction cleared. 12 hit points."));
    expect(lasts()).toBeNull();
  });

  it("keeps a held reduction past a long rest in one write", async () => {
    const { writes } = renderVitals(
      { hitPointMaximumReduction: { amount: 5, clearsOnLongRest: true } },
      { hitPointMaximum: reducedMaximum },
    );
    await open("Hit point maximum 15");
    fireEvent.click(lasts() as HTMLElement);

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]?.hitPointMaximumReduction).toEqual({ amount: 5, clearsOnLongRest: false });
    await waitFor(() => expect(announced()).toContain("Maximum reduced by 5, past a long rest."));
    expect(lasts()).toBeChecked();
  });

  it("writes nothing when the reduction a toggle reads was cleared first", async () => {
    const { writes, release } = renderVitals(
      {
        hitPoints: { current: 15, temporary: 0 },
        hitPointMaximumReduction: { amount: 5, clearsOnLongRest: true },
      },
      { hitPointMaximum: reducedMaximum, hold: true },
    );
    await open("Hit point maximum 15");
    type("Hit point maximum reduction", "");
    await act(async () => {});
    fireEvent.click(lasts() as HTMLElement);
    release();

    await waitFor(() => expect(announced()).toBe("Reduction cleared. 15 hit points."));
    // The toggle's write must not come, so nothing signals it; its edit runs as soon as the
    // clear lands, well inside 50 ms.
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(writes).toHaveLength(1);
    expect(writes[0]?.hitPointMaximumReduction).toBeNull();
  });

  it("lands each change on the state the one before it left", async () => {
    const { writes, release } = renderVitals(
      { hitPoints: { current: 18, temporary: 0 } },
      { hold: true },
    );
    await open();
    type("Temporary hit points", "7");
    type("Hit point maximum reduction", "5");
    release();

    await waitFor(() => expect(writes).toHaveLength(2));
    expect(writes[1]).toMatchObject({
      hitPoints: { current: 15, temporary: 7 },
      hitPointMaximumReduction: { amount: 5, clearsOnLongRest: true },
    });
  });

  it("refuses temporary hit points to the dead, and still clears them", async () => {
    const { writes } = renderVitals({
      hitPoints: { current: 0, temporary: 3 },
      deathSaves: { successes: 0, failures: 3 },
    });
    await open();
    type("Temporary hit points", "5");
    await waitFor(() =>
      expect(field("Temporary hit points")).toHaveAttribute("aria-invalid", "true"),
    );
    expect(writes).toHaveLength(0);

    type("Temporary hit points", "");
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]?.hitPoints.temporary).toBe(0);
  });

  it("refuses a reduction that is no whole number or would leave no maximum", async () => {
    const { writes } = renderVitals({});
    await open();
    for (const typed of ["20", "2.5", "-1"]) {
      type("Hit point maximum reduction", typed);
      await waitFor(() =>
        expect(field("Hit point maximum reduction")).toHaveAttribute("aria-invalid", "true"),
      );
    }
    expect(writes).toHaveLength(0);
  });

  it("outlines a field whose write failed and keeps its text", async () => {
    renderVitals({}, { fail: true });
    await open();
    type("Temporary hit points", "4");

    await waitFor(() =>
      expect(field("Temporary hit points")).toHaveAttribute("aria-invalid", "true"),
    );
    expect(field("Temporary hit points")).toHaveValue("4");
  });

  it("shows the reduction just written and the maximum it leaves before the derived block reloads", async () => {
    renderVitals({ hitPoints: { current: 10, temporary: 0 } });
    await open();
    type("Hit point maximum reduction", "5");

    await waitFor(() => expect(lasts()).not.toBeNull());
    expect(field("Hit point maximum reduction")).toHaveValue("5");
    expect(within(breakdown()).getByText("Maximum").nextSibling).toHaveTextContent("15");
  });
});

describe("the override in the hit point maximum's breakdown", () => {
  function renderOverridden(
    overrides: Record<string, unknown>,
    hitPointMaximum: CharacterDerived["hitPointMaximum"],
    state = stateRecord().state,
  ) {
    const character = vex();
    const save = vi.fn(async () => {});
    renderWithClient(
      <SaveOverride.Provider value={save}>
        <HitPointMaximum
          character={{ ...character, definition: { ...character.definition, overrides } }}
          derived={{ ...derivedRecord(), hitPointMaximum }}
          state={state}
        />
      </SaveOverride.Provider>,
    );
    return save;
  }

  it("saves the override typed, and clearing the field drops it", async () => {
    const save = renderOverridden({}, { computed: 20, manual: null, terms: [] });
    await open();
    type("Hit point maximum override", "30");
    await waitFor(() => expect(save).toHaveBeenCalledWith("hitPointMaximum", 30));

    type("Hit point maximum override", "");
    await waitFor(() => expect(save).toHaveBeenLastCalledWith("hitPointMaximum", null));
  });

  it("names the maximum before the reduction it overrode, as the override field holds it", async () => {
    renderOverridden(
      { hitPointMaximum: 40 },
      { computed: 15, manual: 35, terms: reducedMaximum.terms },
      { ...stateRecord().state, hitPointMaximumReduction: { amount: 5, clearsOnLongRest: true } },
    );
    await open("Hit point maximum 35, overridden from 20");

    expect(within(breakdown()).getByText(/^Overridden from 20\./)).toBeInTheDocument();
    expect(within(breakdown()).queryByRole("list")).toBeNull();
    expect(field("Hit point maximum override")).toHaveValue("40");
    expect(field("Hit point maximum reduction")).toHaveValue("5");
    expect(within(breakdown()).getByText("Maximum").nextSibling).toHaveTextContent("35");
  });

  it("lists the terms before the reduction where nothing is overridden", async () => {
    renderOverridden({}, reducedMaximum, {
      ...stateRecord().state,
      hitPointMaximumReduction: { amount: 5, clearsOnLongRest: true },
    });
    await open("Hit point maximum 15");

    expect(
      within(within(breakdown()).getByRole("list"))
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Hit dice20"]);
  });

  it("shows the override the definition holds while the derived block still shows the last", async () => {
    renderOverridden({}, { computed: 20, manual: 35, terms: [{ label: "Hit dice", value: 20 }] });
    await open("Hit point maximum 35, overridden from 20");

    expect(field("Hit point maximum override")).toHaveValue("20");
    expect(within(breakdown()).getByText("Maximum").nextSibling).toHaveTextContent("20");
  });
});
