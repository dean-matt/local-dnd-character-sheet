import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderVitals, vex } from "./renderVitals.tsx";

const amount = () => screen.getByRole("spinbutton", { name: "Hit point amount" });
const button = (name: string) => screen.getByRole("button", { name });
const card = (name: string) => within(screen.getByRole("region", { name }));
const spoken = (name: string) =>
  card(name)
    .getAllByRole("status")
    .find((region) => region.className === "sr-only");
const announced = () => spoken("Hit Points");

async function apply(typed: string, action: "Damage" | "Heal") {
  fireEvent.change(await screen.findByRole("spinbutton"), { target: { value: typed } });
  fireEvent.click(button(action));
}

afterEach(() => vi.unstubAllGlobals());

describe("HitPointChange", () => {
  it("takes damage through temporary hit points first, and announces what is left", async () => {
    const { writes } = renderVitals({ hitPoints: { current: 12, temporary: 3 } });
    await apply("5", "Damage");

    await waitFor(() => expect(announced()).toHaveTextContent("10 hit points."));
    expect(writes[0]?.hitPoints).toEqual({ current: 10, temporary: 0 });
    expect(card("Hit Points").getByText("10")).toBeInTheDocument();
    expect(card("Hit Points").queryByText(/^\+\d+ temp$/)).not.toBeInTheDocument();
    expect(amount()).toHaveValue(null);
  });

  it("heals to the maximum by writing null, clearing the death saves", async () => {
    const { writes } = renderVitals({
      hitPoints: { current: 0, temporary: 0 },
      deathSaves: { successes: 1, failures: 2 },
    });
    await apply("30", "Heal");

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]?.hitPoints).toEqual({ current: null, temporary: 0 });
    expect(writes[0]?.deathSaves).toEqual({ successes: 0, failures: 0 });
    await waitFor(() => expect(announced()).toHaveTextContent("20 hit points."));
  });

  it("records one failure for damage at 0, which the Death Saves card announces", async () => {
    const { writes } = renderVitals({ hitPoints: { current: 0, temporary: 0 } });
    await apply("1", "Damage");

    await waitFor(() => expect(announced()).toHaveTextContent("0 hit points."));
    expect(writes[0]?.deathSaves).toEqual({ successes: 0, failures: 1 });
    await waitFor(() =>
      expect(spoken("Death Saves")).toHaveTextContent("0 successes, 1 failure, dying."),
    );
    expect(card("Hit Points").queryByText("Dying")).not.toBeInTheDocument();
    expect(card("Hit Points").queryByRole("button", { name: /critical/i })).not.toBeInTheDocument();
  });

  it("announces a result again when it repeats the last one", async () => {
    const { writes } = renderVitals({ hitPoints: { current: 0, temporary: 0 } });
    await apply("1", "Damage");
    await waitFor(() => expect(announced()).toHaveTextContent("0 hit points."));
    const first = announced()?.firstChild;

    await apply("1", "Damage");
    await waitFor(() => expect(announced()?.firstChild).not.toBe(first));
    expect(writes).toHaveLength(2);
    expect(announced()).toHaveTextContent("0 hit points.");
  });

  it("asks before massive damage kills, and Cancel writes nothing", async () => {
    const { writes } = renderVitals({ hitPoints: { current: 5, temporary: 0 } });
    await apply("25", "Damage");

    const dialog = within(screen.getByRole("dialog", { name: "25 damage kills Vex" }));
    expect(dialog.getByText(/Clearing a death save failure brings them back/)).toBeVisible();
    fireEvent.click(dialog.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(writes).toEqual([]);
    expect(amount()).toHaveValue(25);
  });

  it("writes the death once confirmed", async () => {
    const { writes } = renderVitals({ hitPoints: { current: 5, temporary: 0 } });
    await apply("25", "Damage");
    fireEvent.click(button("Apply the damage"));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]?.deathSaves).toEqual({ successes: 0, failures: 3 });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(announced()).toHaveTextContent("0 hit points.");
    await waitFor(() =>
      expect(spoken("Death Saves")).toHaveTextContent("0 successes, 3 failures, dead."),
    );
  });

  it("asks before the third failed death save", async () => {
    const { writes } = renderVitals({
      hitPoints: { current: 0, temporary: 0 },
      deathSaves: { successes: 0, failures: 2 },
    });
    await apply("1", "Damage");

    expect(screen.getByRole("dialog", { name: "1 damage kills Vex" })).toBeInTheDocument();
    expect(writes).toEqual([]);
  });

  it("asks only at the third failure under the noInstantDeath house rule", async () => {
    const { writes } = renderVitals(
      { hitPoints: { current: 5, temporary: 0 } },
      { character: vex(true) },
    );
    await apply("25", "Damage");

    await waitFor(() => expect(announced()).toHaveTextContent("0 hit points."));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(writes[0]?.deathSaves).toEqual({ successes: 0, failures: 0 });
  });

  it.each([
    ["", "Enter an amount."],
    ["0", "The amount is 1 or more."],
    ["-2", "The amount is 1 or more."],
    ["1.5", "The amount is a whole number."],
  ])("writes nothing for an amount of %j, and says why", async (typed, message) => {
    const { writes } = renderVitals({ hitPoints: { current: 12, temporary: 0 } });
    await apply(typed, "Damage");
    fireEvent.click(button("Heal"));

    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(amount()).toHaveAttribute("aria-invalid", "true");
    expect(writes).toEqual([]);
  });

  it("keeps the stored hit points and the amount when the write fails", async () => {
    renderVitals({ hitPoints: { current: 12, temporary: 0 } }, { fail: true });
    await apply("5", "Damage");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Hit points were not changed: Disk full",
    );
    expect(
      within(screen.getByRole("region", { name: "Hit Points" })).getByText("12"),
    ).toBeInTheDocument();
    expect(amount()).toHaveValue(5);
  });
});

describe("temporary hit points", () => {
  async function grant(typed: string) {
    fireEvent.change(await screen.findByRole("spinbutton"), { target: { value: typed } });
    fireEvent.click(button("Grant temp"));
  }

  it("replaces fewer temporary hit points in one write, leaving the rest alone", async () => {
    const { writes } = renderVitals({
      hitPoints: { current: 0, temporary: 3 },
      deathSaves: { successes: 1, failures: 1 },
    });
    await grant("8");

    await waitFor(() => expect(announced()).toHaveTextContent("8 temporary hit points."));
    expect(writes).toHaveLength(1);
    expect(writes[0]?.hitPoints).toEqual({ current: 0, temporary: 8 });
    expect(writes[0]?.deathSaves).toEqual({ successes: 1, failures: 1 });
    expect(card("Hit Points").getByText("+8 temp")).toBeInTheDocument();
    expect(amount()).toHaveValue(null);
  });

  it("keeps as many or more, says so, and takes the grant instead on request", async () => {
    const { writes } = renderVitals({ hitPoints: { current: 12, temporary: 8 } });
    await grant("5");

    const kept = "Kept 8 temporary hit points: they do not stack, and 5 is no more.";
    expect(card("Hit Points").getByText(kept, { selector: "p" })).toBeInTheDocument();
    expect(announced()).toHaveTextContent(kept);
    expect(writes).toEqual([]);

    fireEvent.click(button("Take 5 instead"));
    await waitFor(() => expect(announced()).toHaveTextContent("5 temporary hit points."));
    expect(writes).toHaveLength(1);
    expect(writes[0]?.hitPoints).toEqual({ current: 12, temporary: 5 });
    expect(screen.queryByText(kept, { selector: "p" })).not.toBeInTheDocument();
    expect(button("Grant temp")).toHaveFocus();
  });

  it("clears them to 0, and offers Clear temp only while some are held", async () => {
    const { writes } = renderVitals({
      hitPoints: { current: 0, temporary: 4 },
      deathSaves: { successes: 0, failures: 2 },
    });
    fireEvent.click(await screen.findByRole("button", { name: "Clear temp" }));

    await waitFor(() => expect(announced()).toHaveTextContent("0 temporary hit points."));
    expect(writes).toHaveLength(1);
    expect(writes[0]?.hitPoints).toEqual({ current: 0, temporary: 0 });
    expect(writes[0]?.deathSaves).toEqual({ successes: 0, failures: 2 });
    expect(screen.queryByRole("button", { name: "Clear temp" })).not.toBeInTheDocument();
    expect(button("Grant temp")).toHaveFocus();
  });

  it("grants nothing to the dead, and says why", async () => {
    const { writes } = renderVitals({
      hitPoints: { current: 0, temporary: 0 },
      deathSaves: { successes: 0, failures: 3 },
    });
    await grant("5");

    expect(
      card("Hit Points").getByText("Vex is dead, so temporary hit points were not granted.", {
        selector: "p",
      }),
    ).toBeInTheDocument();
    expect(writes).toEqual([]);
  });

  it.each([
    ["", "Enter an amount."],
    ["0", "The amount is 1 or more."],
    ["2.5", "The amount is a whole number."],
  ])("writes nothing for an amount of %j, and says why", async (typed, message) => {
    const { writes } = renderVitals({ hitPoints: { current: 12, temporary: 0 } });
    await grant(typed);

    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(amount()).toHaveAttribute("aria-invalid", "true");
    expect(writes).toEqual([]);
  });

  it("keeps the amount and the stored temporary hit points when the write fails", async () => {
    renderVitals({ hitPoints: { current: 12, temporary: 2 } }, { fail: true });
    await grant("6");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Hit points were not changed: Disk full",
    );
    expect(card("Hit Points").getByText("+2 temp")).toBeInTheDocument();
    expect(amount()).toHaveValue(6);
  });
});
