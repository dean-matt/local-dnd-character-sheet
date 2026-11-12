import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderVitals, vex } from "./renderVitals.tsx";

const hp = () => within(screen.getByRole("region", { name: "Hit Points" }));
const button = (name: string) => hp().getByRole("button", { name });
const reduction = () => hp().getByRole("spinbutton", { name: "Reduction" });
const announced = () =>
  hp()
    .getAllByRole("status")
    .map((region) => region.textContent)
    .join(" ");

/** A 20 maximum reduced by 5, as the derived block shows it with the reduction held. */
const reducedMaximum = {
  computed: 15,
  manual: null,
  terms: [
    { label: "Hit dice", value: 20 },
    { label: "Maximum reduction", value: -5 },
  ],
};

async function reduce(amount: string, { persists = false } = {}) {
  fireEvent.click(await screen.findByRole("button", { name: "Reduce maximum" }));
  fireEvent.change(reduction(), { target: { value: amount } });
  if (persists) fireEvent.click(hp().getByRole("checkbox", { name: "Lasts past a long rest" }));
  fireEvent.submit(hp().getByRole("form", { name: "Reduce hit point maximum" }));
}

afterEach(() => vi.unstubAllGlobals());

describe("a reduction to the hit point maximum", () => {
  it("names the held reduction, and the maximum's breakdown names it too", async () => {
    renderVitals(
      { hitPointMaximumReduction: { amount: 5, clearsOnLongRest: false } },
      { hitPointMaximum: reducedMaximum },
    );

    expect(
      await screen.findByText(
        (_, node) => node?.textContent === "Maximum reduced by 5, past a long rest",
      ),
    ).toBeInTheDocument();
    fireEvent.click(button("Hit point maximum 15"));
    expect(await screen.findByText("Maximum reduction")).toBeInTheDocument();
  });

  it("records one that a long rest clears in one write, lowering hit points above the reduced maximum", async () => {
    const { writes } = renderVitals({ hitPoints: { current: 18, temporary: 0 } });
    await reduce("5");

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toMatchObject({
      hitPoints: { current: 15, temporary: 0 },
      hitPointMaximumReduction: { amount: 5, clearsOnLongRest: true },
    });
    await waitFor(() =>
      expect(announced()).toContain("Maximum reduced by 5, until a long rest. 15 hit points."),
    );
    expect(button("Change reduction")).toHaveFocus();
  });

  it("records one marked to last past a long rest", async () => {
    const { writes } = renderVitals({});
    await reduce("3", { persists: true });

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]?.hitPointMaximumReduction).toEqual({ amount: 3, clearsOnLongRest: false });
  });

  it("clears the held reduction in one write, restoring no hit points", async () => {
    const { writes } = renderVitals(
      {
        hitPoints: { current: 15, temporary: 0 },
        hitPointMaximumReduction: { amount: 5, clearsOnLongRest: true },
      },
      { hitPointMaximum: reducedMaximum },
    );
    fireEvent.click(await screen.findByRole("button", { name: "Clear reduction" }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toMatchObject({
      hitPoints: { current: 15, temporary: 0 },
      hitPointMaximumReduction: null,
    });
    await waitFor(() => expect(announced()).toContain("Reduction cleared. 15 hit points."));
    expect(button("Reduce maximum")).toHaveFocus();
  });

  it.each([
    [true, false],
    [false, true],
  ])(
    "opens Change reduction on the held amount, a long rest clearing it %s",
    async (clearsOnLongRest, checked) => {
      renderVitals(
        { hitPointMaximumReduction: { amount: 5, clearsOnLongRest } },
        { hitPointMaximum: reducedMaximum },
      );
      fireEvent.click(await screen.findByRole("button", { name: "Change reduction" }));

      expect(reduction()).toHaveValue(5);
      expect(hp().getByRole("checkbox", { name: "Lasts past a long rest" })).toHaveProperty(
        "checked",
        checked,
      );
      expect(hp().queryByRole("button", { name: "Clear reduction" })).toBeNull();
    },
  );

  it("replaces a held reduction with a larger one, lowering hit points to the new maximum", async () => {
    const { writes } = renderVitals(
      {
        hitPoints: { current: 15, temporary: 0 },
        hitPointMaximumReduction: { amount: 5, clearsOnLongRest: true },
      },
      { hitPointMaximum: reducedMaximum },
    );
    fireEvent.click(await screen.findByRole("button", { name: "Change reduction" }));
    fireEvent.change(reduction(), { target: { value: "8" } });
    fireEvent.click(button("Reduce"));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toMatchObject({
      hitPoints: { current: 12, temporary: 0 },
      hitPointMaximumReduction: { amount: 8, clearsOnLongRest: true },
    });
  });

  it("takes the reduction from an override of the maximum, named in its breakdown", async () => {
    const character = vex();
    const overridden = {
      ...character,
      definition: { ...character.definition, overrides: { hitPointMaximum: 40 } },
    };
    const { writes } = renderVitals(
      { hitPoints: { current: 38, temporary: 0 } },
      {
        character: overridden,
        hitPointMaximum: { computed: 20, manual: 40, terms: [{ label: "Hit dice", value: 20 }] },
      },
    );
    await reduce("5");

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]?.hitPoints.current).toBe(35);
    await waitFor(() => expect(announced()).toContain("35 hit points."));
  });

  it("shows an override less the held reduction, the breakdown naming both", async () => {
    const character = vex();
    renderVitals(
      { hitPointMaximumReduction: { amount: 5, clearsOnLongRest: true } },
      {
        character: {
          ...character,
          definition: { ...character.definition, overrides: { hitPointMaximum: 40 } },
        },
        hitPointMaximum: { computed: 15, manual: 35, terms: reducedMaximum.terms },
      },
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Hit point maximum 35, overridden from 15" }),
    );
    expect(await screen.findByText("Override")).toBeInTheDocument();
    expect(screen.getByText("Maximum reduction")).toBeInTheDocument();
  });

  it("refuses an amount that is no whole number or would leave no maximum, writing nothing", async () => {
    const { writes } = renderVitals({});
    await reduce("");
    expect(await hp().findByText("Enter an amount.")).toBeInTheDocument();
    fireEvent.change(reduction(), { target: { value: "20" } });
    fireEvent.click(button("Reduce"));
    expect(
      await hp().findByText("The reduction is less than the maximum, 20."),
    ).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });

  it("cancels without a write, returning focus to Reduce maximum", async () => {
    const { writes } = renderVitals({});
    fireEvent.click(await screen.findByRole("button", { name: "Reduce maximum" }));
    expect(reduction()).toHaveFocus();
    fireEvent.click(button("Cancel"));

    await waitFor(() => expect(button("Reduce maximum")).toHaveFocus());
    expect(writes).toHaveLength(0);
  });

  it("names a failed write and keeps the form open", async () => {
    renderVitals({}, { fail: true });
    await reduce("5");

    expect(
      await hp().findByText("The maximum was not changed: Disk full, write 1"),
    ).toBeInTheDocument();
    expect(reduction()).toHaveValue(5);
  });
});
