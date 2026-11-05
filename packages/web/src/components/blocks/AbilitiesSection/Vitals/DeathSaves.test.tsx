import type { CharacterState } from "@dnd/character";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderVitals } from "./renderVitals.tsx";

const d20 = vi.hoisted(() => ({ total: 10 }));
vi.mock("@dnd/dice", () => ({ rollDice: () => d20 }));

const atZero = (successes: number, failures: number): Partial<CharacterState> => ({
  hitPoints: { current: 0, temporary: 0 },
  deathSaves: { successes, failures },
});

const card = () => within(screen.getByRole("region", { name: "Hit Points" }));
const marks = (column: "successes" | "failures") =>
  within(card().getByRole("group", { name: `Death save ${column}` }))
    .getAllByRole("button")
    .map((mark) => mark.getAttribute("aria-pressed"));
const mark = (name: string) => card().getByRole("button", { name });
const rollButton = () => card().queryByRole("button", { name: "Roll death save" });
const announced = () =>
  screen.getAllByRole("status").filter((region) => region.className === "sr-only")[1];

async function roll(value: number) {
  d20.total = value;
  fireEvent.click(await screen.findByRole("button", { name: "Roll death save" }));
}

beforeEach(() => {
  d20.total = 10;
});
afterEach(() => vi.unstubAllGlobals());

describe("DeathSaves", () => {
  it("shows three of each mark at 0 hit points, filled to the stored counts", async () => {
    renderVitals(atZero(2, 1));
    await screen.findByRole("spinbutton");

    expect(marks("successes")).toEqual(["true", "true", "false"]);
    expect(marks("failures")).toEqual(["true", "false", "false"]);
  });

  it("shows no marks above 0 hit points", async () => {
    renderVitals({ hitPoints: { current: 5, temporary: 0 } });
    await screen.findByRole("spinbutton");

    expect(card().queryByRole("group")).not.toBeInTheDocument();
  });

  it.each([
    [10, atZero(1, 0), "Rolled 10: a success. 2 successes, 0 failures, dying."],
    [9, atZero(0, 0), "Rolled 9: a failure. 0 successes, 1 failure, dying."],
    [1, atZero(1, 0), "Rolled 1: a natural 1, two failures. 1 success, 2 failures, dying."],
  ])("rolls a %i, writes it and announces it", async (value, before, text) => {
    const { writes } = renderVitals(before);
    await roll(value);

    await waitFor(() => expect(announced()).toHaveTextContent(text));
    expect(writes).toHaveLength(1);
    expect(card().getByText(`Rolled ${value}`)).toBeVisible();
  });

  it("stores the third success as three, and shows the character stable", async () => {
    const { writes } = renderVitals(atZero(2, 2));
    await roll(12);

    await waitFor(() => expect(writes[0]?.deathSaves).toEqual({ successes: 3, failures: 0 }));
    expect(await card().findByText("Stable")).toBeVisible();
    expect(rollButton()).not.toBeInTheDocument();
    expect(announced()).toHaveTextContent("3 successes, 0 failures, stable.");
  });

  it("brings a 20 up to 1 hit point with both counts cleared", async () => {
    const { writes } = renderVitals(atZero(1, 2));
    await roll(20);

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]?.hitPoints).toEqual({ current: 1, temporary: 0 });
    expect(writes[0]?.deathSaves).toEqual({ successes: 0, failures: 0 });
    await waitFor(() => expect(card().queryByRole("group")).not.toBeInTheDocument());
    expect(announced()).toHaveTextContent("Rolled 20: a natural 20. Conscious at 1 hit point.");
  });

  it.each([
    ["stable", atZero(3, 0)],
    ["dead", atZero(0, 3)],
  ])("offers no roll once %s", async (_, state) => {
    renderVitals(state);
    await screen.findByRole("spinbutton");
    expect(rollButton()).not.toBeInTheDocument();
  });

  it("sets an empty mark and clears a filled one by hand, one write each", async () => {
    const { writes } = renderVitals(atZero(1, 0));
    await screen.findByRole("spinbutton");

    fireEvent.click(mark("Failure 2"));
    await waitFor(() => expect(marks("failures")).toEqual(["true", "true", "false"]));
    expect(announced()).toHaveTextContent("1 success, 2 failures, dying.");

    fireEvent.click(mark("Success 1"));
    await waitFor(() => expect(marks("successes")).toEqual(["false", "false", "false"]));
    expect(writes.map((write) => write.deathSaves)).toEqual([
      { successes: 1, failures: 2 },
      { successes: 0, failures: 2 },
    ]);
  });

  it("returns a dead character to dying when a failure is cleared", async () => {
    const { writes } = renderVitals(atZero(0, 3));
    await screen.findByRole("spinbutton");
    expect(card().getByText("Dead")).toBeVisible();

    fireEvent.click(mark("Failure 3"));
    await waitFor(() => expect(writes[0]?.deathSaves).toEqual({ successes: 0, failures: 2 }));
    expect(await card().findByText("Dying")).toBeVisible();
    expect(rollButton()).toBeInTheDocument();
  });

  it("still shows a rolled stable so after a reload", async () => {
    const { writes, reload } = renderVitals(atZero(2, 0));
    await roll(12);
    await waitFor(() => expect(writes).toHaveLength(1));
    reload();

    await screen.findByRole("spinbutton");
    expect(card().getByText("Stable")).toBeVisible();
    expect(card().queryByText("Dying")).not.toBeInTheDocument();
  });

  it("still shows a death marked by hand so after a reload", async () => {
    const { writes, reload } = renderVitals(atZero(1, 2));
    await screen.findByRole("spinbutton");
    fireEvent.click(mark("Failure 3"));
    await waitFor(() => expect(writes).toHaveLength(1));
    reload();

    await screen.findByRole("spinbutton");
    expect(card().getByText("Dead")).toBeVisible();
    expect(marks("failures")).toEqual(["true", "true", "true"]);
  });

  it("clears both counts when healed from 0", async () => {
    const { writes } = renderVitals(atZero(2, 1));
    fireEvent.change(await screen.findByRole("spinbutton"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Heal" }));

    await waitFor(() => expect(writes[0]?.deathSaves).toEqual({ successes: 0, failures: 0 }));
    await waitFor(() => expect(card().queryByRole("group")).not.toBeInTheDocument());
  });

  it("keeps the stored marks and names the error when a write fails", async () => {
    renderVitals(atZero(1, 1), { fail: true });
    await screen.findByRole("spinbutton");
    fireEvent.click(mark("Success 2"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Death saves were not changed: Disk full",
    );
    expect(marks("successes")).toEqual(["true", "false", "false"]);

    await roll(15);
    await waitFor(() => expect(screen.getByRole("alert")).toBeVisible());
    expect(marks("successes")).toEqual(["true", "false", "false"]);
    expect(card().queryByText("Rolled 15")).not.toBeInTheDocument();
  });
});
