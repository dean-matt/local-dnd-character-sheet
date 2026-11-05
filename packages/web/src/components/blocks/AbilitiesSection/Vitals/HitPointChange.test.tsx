import type { CharacterDerived, CharacterRecord, CharacterState } from "@dnd/character";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterRecord, derivedRecord, stateRecord } from "../../../../test/records.ts";
import { renderWithClient } from "../../../../test/renderWithClient.tsx";
import { Vitals } from "./Vitals.tsx";

function derived(): CharacterDerived {
  return { ...derivedRecord(), hitPointMaximum: { computed: 20, manual: null, terms: [] } };
}

function vex(noInstantDeath?: boolean): CharacterRecord {
  const character = characterRecord("1", "Vex");
  return {
    ...character,
    definition: { ...character.definition, houseRules: { noInstantDeath } },
  };
}

/**
 * Renders the cards over a stand-in API that keeps what each state write sends and answers
 * later reads with it, as a reload would. `fail` answers every write with a 500.
 */
function renderLive(state: Partial<CharacterState>, { character = vex(), fail = false } = {}) {
  let stored = { ...stateRecord(), state: { ...stateRecord().state, ...state } };
  const writes: CharacterState[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "PUT") {
        if (fail) return new Response(JSON.stringify({ error: "Disk full" }), { status: 500 });
        const written = JSON.parse(String(init.body));
        writes.push(written);
        stored = { ...stored, state: written };
      }
      return new Response(JSON.stringify(stored), { status: 200 });
    }),
  );
  renderWithClient(<Vitals character={character} derived={derived()} />);
  return writes;
}

const amount = () => screen.getByRole("spinbutton", { name: "Damage or healing amount" });
const button = (name: string) => screen.getByRole("button", { name });
const announced = () =>
  screen.getAllByRole("status").find((region) => region.className === "sr-only");

async function apply(typed: string, action: "Damage" | "Heal") {
  fireEvent.change(await screen.findByRole("spinbutton"), { target: { value: typed } });
  fireEvent.click(button(action));
}

afterEach(() => vi.unstubAllGlobals());

describe("HitPointChange", () => {
  it("takes damage through temporary hit points first, and announces what is left", async () => {
    const writes = renderLive({ hitPoints: { current: 12, temporary: 3 } });
    await apply("5", "Damage");

    await waitFor(() => expect(announced()).toHaveTextContent("10 hit points."));
    expect(writes[0]?.hitPoints).toEqual({ current: 10, temporary: 0 });
    const card = within(screen.getByRole("region", { name: "Hit Points" }));
    expect(card.getByText("10")).toBeInTheDocument();
    expect(card.queryByText(/temp$/)).not.toBeInTheDocument();
    expect(amount()).toHaveValue(null);
  });

  it("heals to the maximum by writing null, clearing the death saves", async () => {
    const writes = renderLive({
      hitPoints: { current: 0, temporary: 0 },
      deathSaves: { successes: 1, failures: 2 },
    });
    await apply("30", "Heal");

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]?.hitPoints).toEqual({ current: null, temporary: 0 });
    expect(writes[0]?.deathSaves).toEqual({ successes: 0, failures: 0 });
    await waitFor(() => expect(announced()).toHaveTextContent("20 hit points."));
  });

  it("offers Critical hit only at 0 hit points, and a critical costs two failures", async () => {
    const writes = renderLive({ hitPoints: { current: 0, temporary: 0 } });
    await screen.findByRole("spinbutton");
    fireEvent.click(screen.getByRole("checkbox", { name: "Critical hit" }));
    await apply("1", "Damage");

    await waitFor(() => expect(announced()).toHaveTextContent("0 hit points, dying."));
    expect(writes[0]?.deathSaves).toEqual({ successes: 0, failures: 2 });
  });

  it("announces a result again when it repeats the last one", async () => {
    const writes = renderLive({ hitPoints: { current: 0, temporary: 0 } });
    await apply("1", "Damage");
    await waitFor(() => expect(announced()).toHaveTextContent("0 hit points, dying."));
    const first = announced()?.firstChild;

    await apply("1", "Damage");
    await waitFor(() => expect(announced()?.firstChild).not.toBe(first));
    expect(writes).toHaveLength(2);
    expect(announced()).toHaveTextContent("0 hit points, dying.");
  });

  it("hides Critical hit above 0 hit points", async () => {
    renderLive({ hitPoints: { current: 1, temporary: 0 } });
    await screen.findByRole("spinbutton");
    expect(screen.queryByRole("checkbox", { name: "Critical hit" })).not.toBeInTheDocument();
  });

  it("asks before massive damage kills, and Cancel writes nothing", async () => {
    const writes = renderLive({ hitPoints: { current: 5, temporary: 0 } });
    await apply("25", "Damage");

    const dialog = within(screen.getByRole("dialog", { name: "25 damage kills Vex" }));
    fireEvent.click(dialog.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(writes).toEqual([]);
    expect(amount()).toHaveValue(25);
  });

  it("writes the death once confirmed", async () => {
    const writes = renderLive({ hitPoints: { current: 5, temporary: 0 } });
    await apply("25", "Damage");
    fireEvent.click(button("Apply the damage"));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]?.deathSaves).toEqual({ successes: 0, failures: 3 });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(announced()).toHaveTextContent("0 hit points, dead.");
  });

  it("asks before the third failed death save", async () => {
    const writes = renderLive({
      hitPoints: { current: 0, temporary: 0 },
      deathSaves: { successes: 0, failures: 2 },
    });
    await apply("1", "Damage");

    expect(screen.getByRole("dialog", { name: "1 damage kills Vex" })).toBeInTheDocument();
    expect(writes).toEqual([]);
  });

  it("asks only at the third failure under the noInstantDeath house rule", async () => {
    const writes = renderLive(
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
    const writes = renderLive({ hitPoints: { current: 12, temporary: 0 } });
    await apply(typed, "Damage");
    fireEvent.click(button("Heal"));

    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(amount()).toHaveAttribute("aria-invalid", "true");
    expect(writes).toEqual([]);
  });

  it("keeps the stored hit points and the amount when the write fails", async () => {
    renderLive({ hitPoints: { current: 12, temporary: 0 } }, { fail: true });
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
