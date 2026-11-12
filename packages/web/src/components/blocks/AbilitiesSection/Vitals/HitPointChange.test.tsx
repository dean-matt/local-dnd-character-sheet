import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { derivedRecord, stateRecord } from "../../../../test/records.ts";
import { renderWithClient } from "../../../../test/renderWithClient.tsx";
import { HitPointChange } from "./HitPointChange.tsx";
import { renderVitals, vex } from "./renderVitals.tsx";

const amount = () => screen.getByRole("spinbutton", { name: "Hit point amount" });
const button = (name: string) => screen.getByRole("button", { name });
const card = (name: string) => within(screen.getByRole("region", { name }));
const spoken = (name: string) =>
  card(name)
    .getAllByRole("status")
    .findLast((region) => region.className === "sr-only");
const announced = () => spoken("Hit Points");
const ring = () => card("Hit Points").getByRole("img");

async function apply(typed: string, action: "Damage" | "Heal") {
  fireEvent.change(await screen.findByRole("spinbutton"), { target: { value: typed } });
  fireEvent.click(button(action));
}

afterEach(() => vi.unstubAllGlobals());

const grant = (name: string, from: string) => ({ name, from: [from] });

/** Raging, so resistant to slashing; immune to fire; vulnerable to cold. */
const defenses = {
  computed: {
    resistances: [grant("slashing", "Rage")],
    damageImmunities: [grant("fire", "Ring of Fire Immunity")],
    conditionImmunities: [],
    vulnerabilities: [grant("cold", "Curse")],
    resistanceChoice: null,
  },
  manual: null,
  terms: [],
};

function pickType(label: string) {
  fireEvent.click(screen.getByRole("combobox", { name: "Damage type" }));
  fireEvent.click(screen.getByRole("option", { name: label }));
}

describe("typed damage", () => {
  it("applies untyped damage as entered, whatever the character resists", async () => {
    const { writes } = renderVitals({ hitPoints: { current: 12, temporary: 0 } }, { defenses });
    expect(await screen.findByRole("combobox", { name: "Damage type" })).toHaveTextContent(
      "Untyped",
    );
    await apply("5", "Damage");

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]?.hitPoints).toEqual({ current: 7, temporary: 0 });
    expect(announced()).toHaveTextContent(/^7 hit points\.$/);
  });

  it("halves damage a rage resists in one write, temporary hit points first, and names it", async () => {
    const { writes } = renderVitals({ hitPoints: { current: 12, temporary: 2 } }, { defenses });
    await screen.findByRole("spinbutton");
    pickType("Slashing");
    await apply("9", "Damage");

    const named = "Slashing resistance halved 9 damage to 4.";
    await waitFor(() => expect(announced()).toHaveTextContent(`${named} 10 hit points.`));
    expect(writes).toHaveLength(1);
    expect(writes[0]?.hitPoints).toEqual({ current: 10, temporary: 0 });
    expect(await card("Hit Points").findByText(named, { selector: "p" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Damage type" })).toHaveTextContent("Untyped");
  });

  it("doubles damage the character is vulnerable to", async () => {
    const { writes } = renderVitals({ hitPoints: { current: 12, temporary: 0 } }, { defenses });
    await screen.findByRole("spinbutton");
    pickType("Cold");
    await apply("3", "Damage");

    await waitFor(() =>
      expect(announced()).toHaveTextContent(
        "Cold vulnerability doubled 3 damage to 6. 6 hit points.",
      ),
    );
    expect(writes[0]?.hitPoints).toEqual({ current: 6, temporary: 0 });
  });

  it("writes nothing for damage an immunity reduces to 0, and says so", async () => {
    const { writes } = renderVitals({ hitPoints: { current: 12, temporary: 0 } }, { defenses });
    await screen.findByRole("spinbutton");
    pickType("Fire");
    await apply("8", "Damage");

    const named = "Fire immunity reduced 8 damage to 0. Hit points are unchanged.";
    expect(card("Hit Points").getByText(named, { selector: "p" })).toBeInTheDocument();
    expect(announced()).toHaveTextContent(named);
    expect(writes).toEqual([]);
    expect(amount()).toHaveValue(null);
  });

  it("names both defenses when a type is resisted and doubled", async () => {
    const torn = {
      ...defenses,
      computed: { ...defenses.computed, vulnerabilities: [grant("slashing", "Curse")] },
    };
    const { writes } = renderVitals(
      { hitPoints: { current: 12, temporary: 0 } },
      { defenses: torn },
    );
    await screen.findByRole("spinbutton");
    pickType("Slashing");
    await apply("11", "Damage");

    await waitFor(() =>
      expect(announced()).toHaveTextContent(
        "Slashing resistance and vulnerability changed 11 damage to 10. 2 hit points.",
      ),
    );
    expect(writes[0]?.hitPoints).toEqual({ current: 2, temporary: 0 });
  });

  it("drops a defense's notice once the hit points change elsewhere, as an undo does", async () => {
    const character = vex();
    const derived = {
      ...derivedRecord(),
      hitPointMaximum: { computed: 20, manual: null, terms: [] },
      defenses,
    };
    const at = (current: number) => ({
      ...stateRecord().state,
      hitPoints: { current, temporary: 0 },
    });
    const view = renderWithClient(
      <HitPointChange character={character} derived={derived} state={at(12)} />,
    );
    pickType("Fire");
    await apply("8", "Damage");
    const named = "Fire immunity reduced 8 damage to 0. Hit points are unchanged.";
    expect(screen.getByText(named, { selector: "p" })).toBeInTheDocument();

    view.rerender(<HitPointChange character={character} derived={derived} state={at(20)} />);
    expect(screen.queryByText(named, { selector: "p" })).not.toBeInTheDocument();
  });

  it("weighs the adjusted amount when asking before damage kills", async () => {
    renderVitals({ hitPoints: { current: 5, temporary: 0 } }, { defenses });
    await screen.findByRole("spinbutton");
    pickType("Cold");
    await apply("13", "Damage");

    const dialog = within(screen.getByRole("dialog", { name: "26 damage kills Vex" }));
    expect(dialog.getByText("Cold vulnerability doubled 13 damage to 26.")).toBeVisible();
  });
});

describe("HitPointChange", () => {
  it("takes damage through temporary hit points first, and announces what is left", async () => {
    const { writes } = renderVitals({ hitPoints: { current: 12, temporary: 3 } });
    await apply("5", "Damage");

    await waitFor(() => expect(announced()).toHaveTextContent("10 hit points."));
    expect(writes[0]?.hitPoints).toEqual({ current: 10, temporary: 0 });
    expect(ring()).toHaveAccessibleName("10 of 20 hit points");
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
  });

  it("records two failures in one write for a critical hit at 0, then clears Critical hit", async () => {
    const { writes } = renderVitals({ hitPoints: { current: 0, temporary: 0 } });
    const critical = await screen.findByRole("checkbox", { name: "Critical hit" });
    fireEvent.click(critical);
    expect(critical).toBeChecked();
    await apply("1", "Damage");

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]?.deathSaves).toEqual({ successes: 0, failures: 2 });
    await waitFor(() =>
      expect(spoken("Death Saves")).toHaveTextContent("0 successes, 2 failures, dying."),
    );
    await waitFor(() => expect(critical).not.toBeChecked());
  });

  it("offers Critical hit only at 0 hit points", async () => {
    renderVitals({ hitPoints: { current: 5, temporary: 0 } });

    await screen.findByRole("button", { name: "Damage" });
    expect(screen.queryByRole("checkbox", { name: "Critical hit" })).not.toBeInTheDocument();
  });

  it("clears Critical hit once the hit points change without damage", async () => {
    const { writes } = renderVitals({ hitPoints: { current: 0, temporary: 0 } });
    const critical = await screen.findByRole("checkbox", { name: "Critical hit" });
    fireEvent.click(critical);
    expect(critical).toBeChecked();
    fireEvent.click(button("Hit point maximum 20"));
    const temporary = screen.getByRole("textbox", { name: "Temporary hit points" });
    fireEvent.change(temporary, { target: { value: "5" } });
    fireEvent.blur(temporary);

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(screen.getByRole("checkbox", { name: "Critical hit" })).not.toBeChecked();
  });

  it("asks before a critical hit at 0 makes the third failure", async () => {
    const { writes } = renderVitals({
      hitPoints: { current: 0, temporary: 0 },
      deathSaves: { successes: 0, failures: 1 },
    });
    fireEvent.click(await screen.findByRole("checkbox", { name: "Critical hit" }));
    await apply("1", "Damage");
    fireEvent.click(button("Apply the damage"));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]?.deathSaves).toEqual({ successes: 0, failures: 3 });
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

describe("concentration", () => {
  const bless = { spell: { name: "Bless", source: "XPHB" }, level: 1 };
  const hitPoints = card.bind(null, "Hit Points");
  const prompt = () =>
    screen.queryByText(
      (_, element) =>
        element?.tagName === "P" && element.textContent?.startsWith("Concentration:") === true,
    );
  const alone = {
    ...derivedRecord(),
    hitPointMaximum: { computed: 20, manual: null, terms: [] },
  };
  const at = (current: number, concentration: typeof bless | null) => ({
    ...stateRecord().state,
    hitPoints: { current, temporary: 0 },
    concentration,
  });

  it("shows the DC for the damage taken and the save, and End concentration is one write", async () => {
    const { writes } = renderVitals({
      hitPoints: { current: 20, temporary: 10 },
      concentration: bless,
    });
    await apply("26", "Damage");

    await waitFor(() =>
      expect(prompt()).toHaveTextContent("Concentration: DC 13 Constitution save, +2"),
    );
    expect(announced()).toHaveTextContent(
      "4 hit points. DC 13 Constitution save to keep concentration.",
    );
    fireEvent.click(hitPoints().getByRole("button", { name: "End concentration" }));

    await waitFor(() => expect(prompt()).not.toBeInTheDocument());
    expect(announced()).toHaveTextContent(/^Concentration ended\.$/);
    expect(writes).toHaveLength(2);
    expect(writes[1]).toEqual({ ...writes[0], concentration: null });
    expect(button("Damage")).toHaveFocus();
  });

  it("keeps concentration without a write, and says so", async () => {
    const { writes } = renderVitals({
      hitPoints: { current: 20, temporary: 0 },
      concentration: bless,
    });
    await apply("4", "Damage");
    await waitFor(() => expect(prompt()).toHaveTextContent("DC 10"));
    fireEvent.click(hitPoints().getByRole("button", { name: "Keep concentration" }));

    expect(announced()).toHaveTextContent(/^Concentration kept\.$/);
    expect(prompt()).not.toBeInTheDocument();
    expect(button("Damage")).toHaveFocus();
    expect(writes).toHaveLength(1);
    expect(writes[0]?.concentration).toEqual(bless);
  });

  it("asks nothing of a character not concentrating", async () => {
    renderVitals({ hitPoints: { current: 20, temporary: 0 }, concentration: null });
    await apply("4", "Damage");

    await waitFor(() => expect(announced()).toHaveTextContent(/^16 hit points\.$/));
    expect(prompt()).not.toBeInTheDocument();
  });

  it("ends concentration in the write that kills, and asks nothing", async () => {
    const { writes } = renderVitals({
      hitPoints: { current: 5, temporary: 0 },
      concentration: bless,
    });
    await apply("30", "Damage");
    fireEvent.click(await screen.findByRole("button", { name: "Apply the damage" }));

    await waitFor(() =>
      expect(announced()).toHaveTextContent(/^0 hit points\. Concentration ended\.$/),
    );
    expect(writes).toHaveLength(1);
    expect(writes[0]?.concentration).toBeNull();
    expect(prompt()).not.toBeInTheDocument();
  });

  it.each([
    ["drops the character to 0", 0],
    ["lands at 0", 1],
  ])(
    "ends concentration in the write once the damage %s, and asks nothing",
    async (_, failures) => {
      const { writes } = renderVitals({
        hitPoints: { current: failures === 0 ? 5 : 0, temporary: 0 },
        deathSaves: { successes: 0, failures },
        concentration: bless,
      });
      await apply("6", "Damage");

      await waitFor(() =>
        expect(announced()).toHaveTextContent(/^0 hit points\. Concentration ended\.$/),
      );
      expect(writes).toHaveLength(1);
      expect(writes[0]).toMatchObject({ hitPoints: { current: 0 }, concentration: null });
      expect(prompt()).not.toBeInTheDocument();
    },
  );

  it("keeps the prompt and names the error when End concentration fails", async () => {
    let puts = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_: RequestInfo | URL, init?: RequestInit) =>
        init?.method === "PUT" && ++puts > 1
          ? new Response(JSON.stringify({ error: "Disk full" }), { status: 500 })
          : new Response(JSON.stringify(stateRecord()), { status: 200 }),
      ),
    );
    const view = renderWithClient(
      <HitPointChange character={vex()} derived={alone} state={at(20, bless)} />,
    );
    await apply("4", "Damage");
    view.rerender(<HitPointChange character={vex()} derived={alone} state={at(16, bless)} />);
    await waitFor(() => expect(prompt()).toHaveTextContent("DC 10"));
    fireEvent.click(screen.getByRole("button", { name: "End concentration" }));

    await waitFor(() =>
      expect(screen.queryByRole("alert")).toHaveTextContent(
        "Concentration was not ended: Disk full",
      ),
    );
    expect(prompt()).toHaveTextContent("DC 10");
    expect(puts).toBe(2);
  });

  it("weighs the concentration save an item adds to, and drops once concentration ends elsewhere", async () => {
    const character = vex();
    const derived = { ...alone, concentrationSave: { computed: 4, manual: null, terms: [] } };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(stateRecord()), { status: 200 })),
    );
    const view = renderWithClient(
      <HitPointChange character={character} derived={derived} state={at(20, bless)} />,
    );
    await apply("5", "Damage");
    view.rerender(<HitPointChange character={character} derived={derived} state={at(15, bless)} />);
    await waitFor(() => expect(prompt()).toHaveTextContent("DC 10 Constitution save, +4"));

    view.rerender(<HitPointChange character={character} derived={derived} state={at(15, null)} />);
    expect(prompt()).not.toBeInTheDocument();
  });
});
