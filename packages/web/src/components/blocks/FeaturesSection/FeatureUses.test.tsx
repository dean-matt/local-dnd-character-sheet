import type { CharacterFeatures } from "@dnd/catalog";
import type { CharacterDerived, CharacterState } from "@dnd/character";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterRecord, derivedRecord, stateRecord } from "../../../test/records.ts";
import { renderWithClient } from "../../../test/renderWithClient.tsx";
import { FeaturesSection } from "./FeaturesSection.tsx";

const RELENTLESS = "trait|catalog|Half-Orc|PHB|Relentless Endurance";

const FEATURES: CharacterFeatures = {
  groups: [
    {
      origin: "class",
      name: "Fighter",
      features: [
        {
          resolved: true,
          name: "Second Wind",
          source: "PHB",
          level: 1,
          entries: [],
          uses: { key: "feature|Fighter|PHB|||1|PHB|Second Wind", count: 1, reset: "short" },
        },
        { resolved: true, name: "Fighting Style", source: "PHB", level: 1, entries: [] },
      ],
    },
    {
      origin: "race",
      name: "Half-Orc",
      features: [
        {
          resolved: true,
          name: "Relentless Endurance",
          source: "PHB",
          entries: [],
          uses: { key: RELENTLESS, count: 2, reset: "long" },
        },
      ],
    },
    {
      origin: "feat",
      features: [
        {
          resolved: true,
          name: "Lucky",
          source: "PHB",
          level: 4,
          entries: [],
          uses: { key: "feat|PHB|Lucky", count: 3, reset: "long" },
        },
      ],
    },
  ],
};

/**
 * The section over a stand-in API that keeps each state write and answers later reads with it.
 * A null `derived` stands for the derived block still loading.
 */
function renderFeatures(
  state: Partial<CharacterState> = {},
  derived: CharacterDerived | null = derivedRecord(),
  features: CharacterFeatures = FEATURES,
) {
  let stored = { ...stateRecord(), state: { ...stateRecord().state, ...state } };
  const writes: CharacterState[] = [];
  const rolls: { label: string; total: number }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/characters/1/features") return new Response(JSON.stringify(features));
      if (url === "/api/characters/1/rolls" && init?.method === "POST") {
        const roll = JSON.parse(String(init.body));
        rolls.push(roll);
        const entry = { ...roll, id: 1, characterId: "1", characterName: "Vex" };
        return Response.json({ ...entry, rolledAt: "2024-01-01T00:00:00.000Z" });
      }
      if (url !== "/api/characters/1/state") return new Response("{}", { status: 404 });
      if (init?.method === "PUT") {
        const written = JSON.parse(String(init.body));
        writes.push(written);
        stored = { ...stored, state: written };
      }
      return new Response(JSON.stringify(stored));
    }),
  );
  const render = () =>
    renderWithClient(
      <FeaturesSection character={characterRecord("1", "Vex")} derived={derived ?? undefined} />,
    );
  const view = render();
  return {
    writes,
    rolls,
    reload() {
      view.unmount();
      render();
    },
  };
}

const row = (name: string) => screen.getByText(name).closest("li") as HTMLElement;

afterEach(() => vi.unstubAllGlobals());

describe("FeatureUses", () => {
  it("shows a class, race and chosen feature's uses left, out of its count, and its rest", async () => {
    renderFeatures({ featureUses: [{ key: RELENTLESS, expended: 1 }] });

    await waitFor(() => expect(row("Second Wind")).toHaveTextContent("1 / 1 Short rest"));
    expect(row("Relentless Endurance")).toHaveTextContent("1 / 2 Long rest");
    expect(row("Lucky")).toHaveTextContent("3 / 3 Long rest");
  });

  it("offers nothing on a feature with no limited uses", async () => {
    renderFeatures();

    await waitFor(() => expect(row("Second Wind")).toHaveTextContent("1 / 1"));
    expect(row("Fighting Style")).not.toHaveTextContent(/\d \/ \d/);
    expect(within(row("Fighting Style")).queryByRole("button", { name: /use of/ })).toBeNull();
  });

  it("spends a use, and the count left survives a reload", async () => {
    const { writes, reload } = renderFeatures({ featureUses: [{ key: RELENTLESS, expended: 1 }] });
    await waitFor(() => expect(row("Lucky")).toHaveTextContent("3 / 3"));

    fireEvent.click(within(row("Lucky")).getByRole("button", { name: "Spend a use of Lucky" }));

    await waitFor(() => expect(row("Lucky")).toHaveTextContent("2 / 3"));
    expect(writes[0]?.featureUses).toEqual([
      { key: RELENTLESS, expended: 1 },
      { key: "feat|PHB|Lucky", expended: 1 },
    ]);
    reload();
    await waitFor(() => expect(row("Lucky")).toHaveTextContent("2 / 3 Long rest"));
  });

  it("spends a use in a card filtered to its limited uses as it does unfiltered", async () => {
    const { writes } = renderFeatures();
    await waitFor(() => expect(row("Second Wind")).toHaveTextContent("1 / 1"));
    const classes = within(
      screen
        .getByRole("heading", { level: 3, name: "Class Features" })
        .closest("section") as HTMLElement,
    );
    fireEvent.click(classes.getByRole("button", { name: /^Filter / }));
    fireEvent.click(classes.getByLabelText("Has limited uses"));
    expect(classes.queryByText("Fighting Style")).toBeNull();

    fireEvent.click(classes.getByRole("button", { name: "Spend a use of Second Wind" }));

    await waitFor(() => expect(row("Second Wind")).toHaveTextContent("0 / 1"));
    expect(writes[0]?.featureUses).toEqual([
      { key: "feature|Fighter|PHB|||1|PHB|Second Wind", expended: 1 },
    ]);
    expect(classes.getByLabelText("Has limited uses")).toBeChecked();
  });

  it("offers no spend once every use is gone, and restores one", async () => {
    const { writes } = renderFeatures({ featureUses: [{ key: RELENTLESS, expended: 2 }] });
    await waitFor(() => expect(row("Relentless Endurance")).toHaveTextContent("0 / 2"));
    const relentless = within(row("Relentless Endurance"));
    const spend = relentless.getByRole("button", { name: "Spend a use of Relentless Endurance" });
    expect(spend).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(spend);
    fireEvent.click(
      relentless.getByRole("button", { name: "Restore a use of Relentless Endurance" }),
    );

    await waitFor(() => expect(row("Relentless Endurance")).toHaveTextContent("1 / 2"));
    expect(writes).toHaveLength(1);
  });

  it("lands what a spent feature restores in the spend's one write, then logs it", async () => {
    const derived: CharacterDerived = {
      ...derivedRecord(),
      featureRestores: [
        {
          feature: { name: "Relentless Endurance", source: "PHB" },
          kind: "heal",
          dice: null,
          bonus: 1,
          others: false,
        },
      ],
    };
    const { writes, rolls } = renderFeatures({ hitPoints: { current: 0, temporary: 0 } }, derived);
    await waitFor(() => expect(row("Relentless Endurance")).toHaveTextContent("2 / 2"));

    fireEvent.click(
      within(row("Relentless Endurance")).getByRole("button", {
        name: "Spend a use of Relentless Endurance",
      }),
    );

    await waitFor(() => expect(rolls).toHaveLength(1));
    expect(writes).toHaveLength(1);
    expect(writes[0]?.hitPoints.current).toBe(1);
    expect(writes[0]?.featureUses).toEqual([{ key: RELENTLESS, expended: 1 }]);
    expect(rolls[0]).toMatchObject({ label: "Relentless Endurance", total: 1 });
    expect(within(row("Relentless Endurance")).getByRole("status")).toHaveTextContent(
      "Relentless Endurance: 1 of 2 left. Relentless Endurance: regained 1 hit point.",
    );
  });

  it("gives the amount once for each creature the player picks, up to the most", async () => {
    const derived: CharacterDerived = {
      ...derivedRecord(),
      featureRestores: [
        {
          feature: { name: "Relentless Endurance", source: "PHB" },
          kind: "tempHp",
          dice: null,
          bonus: 5,
          others: false,
          per: { unit: "creature", most: 3 },
        },
      ],
    };
    const { writes, rolls } = renderFeatures({ hitPoints: { current: 5, temporary: 0 } }, derived);
    await waitFor(() => expect(row("Relentless Endurance")).toHaveTextContent("2 / 2"));
    const relentless = within(row("Relentless Endurance"));
    const pick = relentless.getByRole("combobox", {
      name: "Creatures that accept for Relentless Endurance",
    });
    expect(within(pick).getAllByRole("option")).toHaveLength(3);

    fireEvent.change(pick, { target: { value: "2" } });
    fireEvent.click(
      relentless.getByRole("button", { name: "Spend a use of Relentless Endurance" }),
    );

    await waitFor(() => expect(rolls).toHaveLength(1));
    expect(writes[0]?.hitPoints.temporary).toBe(10);
    expect(rolls[0]).toMatchObject({ label: "Relentless Endurance", total: 10 });
    expect(relentless.getByRole("status")).toHaveTextContent(
      "Relentless Endurance: gained 10 temporary hit points for 2 creatures.",
    );
  });

  it("offers no spend until the derived block that holds what it restores loads", async () => {
    const { writes } = renderFeatures({}, null);
    await waitFor(() => expect(row("Second Wind")).toHaveTextContent("1 / 1"));
    const spend = within(row("Second Wind")).getByRole("button", {
      name: "Spend a use of Second Wind",
    });
    expect(spend).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(spend);

    expect(row("Second Wind")).toHaveTextContent("1 / 1");
    expect(writes).toHaveLength(0);
  });

  describe("slot recovery", () => {
    const ARCANE = "feature|Wizard|PHB|||1|PHB|Arcane Recovery";
    const WIZARD: CharacterFeatures = {
      groups: [
        {
          origin: "class",
          name: "Wizard",
          features: [
            {
              resolved: true,
              name: "Arcane Recovery",
              source: "PHB",
              level: 1,
              entries: [],
              uses: { key: ARCANE, count: 1, reset: "long" },
            },
          ],
        },
      ],
    };
    const derived = (): CharacterDerived => ({
      ...derivedRecord(),
      spellSlots: [1, 2, 3].map((level) => ({
        level,
        total: { computed: 2, manual: null, terms: [] },
      })),
      slotRecoveries: [
        { feature: { name: "Arcane Recovery", source: "PHB" }, budget: 2, maxLevel: 5 },
      ],
    });
    const expended = [
      { level: 1, total: 2, expended: 2 },
      { level: 2, total: 2, expended: 1 },
      { level: 3, total: 2, expended: 1 },
    ];

    it("recovers the picked slots and spends the use in one write", async () => {
      const { writes } = renderFeatures({ spellSlots: expended }, derived(), WIZARD);
      fireEvent.click(
        await screen.findByRole("button", { name: "Recover slots with Arcane Recovery" }),
      );
      const dialog = await screen.findByRole("dialog");
      expect(dialog).not.toHaveTextContent("Level 4");
      fireEvent.change(within(dialog).getByLabelText(/Level 1 slots/), { target: { value: "2" } });
      fireEvent.click(within(dialog).getByRole("button", { name: "Recover" }));

      await waitFor(() => expect(writes).toHaveLength(1));
      expect(writes[0]?.spellSlots).toEqual([
        { level: 1, total: 2, expended: 0 },
        { level: 2, total: 2, expended: 1 },
        { level: 3, total: 2, expended: 1 },
      ]);
      expect(writes[0]?.featureUses).toEqual([{ key: ARCANE, expended: 1 }]);
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });

    it("refuses a pick past the budget", async () => {
      const { writes } = renderFeatures({ spellSlots: expended }, derived(), WIZARD);
      fireEvent.click(
        await screen.findByRole("button", { name: "Recover slots with Arcane Recovery" }),
      );
      const dialog = await screen.findByRole("dialog");
      fireEvent.change(within(dialog).getByLabelText(/Level 3 slots/), { target: { value: "1" } });
      expect(dialog).toHaveTextContent("3 of 2 slot levels");
      fireEvent.click(within(dialog).getByRole("button", { name: "Recover" }));
      expect(writes).toHaveLength(0);
    });

    it("offers no recovery once the use is spent", async () => {
      renderFeatures(
        { spellSlots: expended, featureUses: [{ key: ARCANE, expended: 1 }] },
        derived(),
        WIZARD,
      );
      expect(
        await screen.findByRole("button", { name: "Recover slots with Arcane Recovery" }),
      ).toHaveAttribute("aria-disabled", "true");
    });
  });
});
