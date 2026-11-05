import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderVitals, vex } from "./renderVitals.tsx";

const amount = () => screen.getByRole("spinbutton", { name: "Damage or healing amount" });
const button = (name: string) => screen.getByRole("button", { name });
const CRITICAL = "Next hit is critical";
const critical = () => button(CRITICAL);
const announced = () =>
  screen.getAllByRole("status").find((region) => region.className === "sr-only");

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
    const card = within(screen.getByRole("region", { name: "Hit Points" }));
    expect(card.getByText("10")).toBeInTheDocument();
    expect(card.queryByText(/temp$/)).not.toBeInTheDocument();
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

  it("offers a critical toggle while dying; a critical costs two failures, then resets", async () => {
    const { writes } = renderVitals({ hitPoints: { current: 0, temporary: 0 } });
    await screen.findByRole("spinbutton");
    fireEvent.click(critical());
    expect(critical()).toHaveAttribute("aria-pressed", "true");
    await apply("1", "Damage");

    await waitFor(() => expect(announced()).toHaveTextContent("0 hit points, dying."));
    expect(writes[0]?.deathSaves).toEqual({ successes: 0, failures: 2 });
    expect(critical()).toHaveAttribute("aria-pressed", "false");
  });

  it("announces a result again when it repeats the last one", async () => {
    const { writes } = renderVitals({ hitPoints: { current: 0, temporary: 0 } });
    await apply("1", "Damage");
    await waitFor(() => expect(announced()).toHaveTextContent("0 hit points, dying."));
    const first = announced()?.firstChild;

    await apply("1", "Damage");
    await waitFor(() => expect(announced()?.firstChild).not.toBe(first));
    expect(writes).toHaveLength(2);
    expect(announced()).toHaveTextContent("0 hit points, dying.");
  });

  it("keeps the critical toggle while stable, where damage restarts the saves", async () => {
    const { writes } = renderVitals({
      hitPoints: { current: 0, temporary: 0 },
      deathSaves: { successes: 3, failures: 0 },
    });
    await screen.findByRole("spinbutton");
    fireEvent.click(critical());
    await apply("1", "Damage");

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]?.deathSaves).toEqual({ successes: 0, failures: 2 });
  });

  it.each([
    ["above 0 hit points", { hitPoints: { current: 1, temporary: 0 } }],
    [
      "once dead",
      { hitPoints: { current: 0, temporary: 0 }, deathSaves: { successes: 0, failures: 3 } },
    ],
  ])("hides the critical toggle %s", async (_, state) => {
    renderVitals(state);
    await screen.findByRole("spinbutton");
    expect(screen.queryByRole("button", { name: CRITICAL })).not.toBeInTheDocument();
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
    expect(announced()).toHaveTextContent("0 hit points, dead.");
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

    await waitFor(() => expect(announced()).toHaveTextContent("0 hit points, dying."));
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
