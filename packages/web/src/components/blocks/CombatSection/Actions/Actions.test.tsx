import type { CharacterDerived, CharacterRecord, CharacterState, RollRecord } from "@dnd/character";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterRecord, derivedRecord, stateRecord } from "../../../../test/records.ts";
import { stubFetchByUrl } from "../../../../test/stubFetch.ts";
import { Actions } from "./Actions.tsx";

function renderActions(edition: "classic" | "one", derived: CharacterDerived = derivedRecord()) {
  const base: CharacterRecord = characterRecord("1", "Vex");
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Actions
        character={{ ...base, definition: { ...base.definition, edition } }}
        derived={derived}
      />
    </QueryClientProvider>,
  );
  return screen.getByRole("region", { name: "Actions" });
}

const names = (group: HTMLElement) =>
  within(group)
    .getAllByRole("button")
    .map((b) => b.textContent);

afterEach(() => vi.unstubAllGlobals());

describe("Actions", () => {
  it("groups the standard actions by the kind of action they take", () => {
    stubFetchByUrl({});
    const card = renderActions("one");

    const groups = within(card)
      .getAllByRole("heading", { level: 4 })
      .map((h) => h.textContent);
    expect(groups).toEqual(["action", "bonus action", "reaction", "free"]);
    const action = within(card).getByRole("heading", { name: "action" }).nextElementSibling;
    expect(names(action as HTMLElement)).toContain("Dash");
    expect(names(action as HTMLElement)).toContain("Utilize");
    const reaction = within(card).getByRole("heading", { name: "reaction" }).nextElementSibling;
    expect(names(reaction as HTMLElement)).toEqual(["Opportunity Attack"]);
  });

  it("lists the actions of the character's edition", () => {
    stubFetchByUrl({});
    const classic = renderActions("classic");
    expect(within(classic).getByRole("button", { name: "Use an Object" })).toBeInTheDocument();
    expect(within(classic).queryByRole("button", { name: "Utilize" })).toBeNull();
  });

  it("opens an action's rules text from a button the keyboard reaches", async () => {
    const fetchMock = stubFetchByUrl({
      "/api/refs/resolve": {
        refs: [{ name: "Dash", source: "XPHB", entries: ["Gain extra Speed."] }],
      },
    });
    const card = renderActions("one");
    const dash = within(card).getByRole("button", { name: "Dash" });
    expect(dash.tagName).toBe("BUTTON");
    fireEvent.click(dash);

    expect(await screen.findByText("Gain extra Speed.")).toBeInTheDocument();
    expect(
      JSON.parse(String(fetchMock.mock.calls.find((call) => call[1]?.body)?.[1]?.body)).refs,
    ).toEqual([{ tag: "action", name: "Dash", source: "XPHB" }]);
  });

  it("says how many attacks the Attack action allows where a feature raises it", () => {
    stubFetchByUrl({});
    const turn = (attacks: number, pactAttacks: number | null) => ({
      ...derivedRecord(),
      turn: { ...derivedRecord().turn, attacks, pactAttacks },
    });
    const attack = (card: HTMLElement) =>
      within(card).getByRole("button", { name: "Attack" }).closest("li");

    expect(attack(renderActions("classic", turn(3, null)))).toHaveTextContent("Attack3 attacks");
    cleanup();
    expect(attack(renderActions("classic", turn(1, 2)))).toHaveTextContent(
      "2 attacks with the pact weapon",
    );
    cleanup();
    expect(attack(renderActions("classic"))).toHaveTextContent(/^Attack$/);
  });

  it("lists each action a feature lets the character take as a bonus action, and why", async () => {
    const fetchMock = stubFetchByUrl({});
    const card = renderActions("classic", {
      ...derivedRecord(),
      turn: {
        ...derivedRecord().turn,
        bonusActions: [{ action: "Dash", features: ["Cunning Action", "Step of the Wind"] }],
      },
    });
    const bonus = within(card).getByRole("heading", { name: "bonus action" })
      .nextElementSibling as HTMLElement;
    expect(names(bonus)).toEqual(["Two-Weapon Fighting", "Dash"]);
    const dash = within(bonus).getByRole("button", { name: "Dash" });
    expect(dash.closest("li")).toHaveTextContent("via Cunning Action, Step of the Wind");

    fireEvent.click(dash);
    await waitFor(() =>
      expect(
        JSON.parse(String(fetchMock.mock.calls.find((call) => call[1]?.body)?.[1]?.body)).refs,
      ).toEqual([{ tag: "action", name: "Dash", source: "PHB" }]),
    );
  });

  it("lists a held feature under its action type with its rules text one click away", async () => {
    stubFetchByUrl({
      "/api/characters/1/features": {
        groups: [
          {
            origin: "class",
            name: "Fighter",
            features: [
              {
                resolved: true,
                name: "Second Wind",
                source: "XPHB",
                level: 1,
                entries: ["Regain hit points."],
              },
              {
                resolved: true,
                name: "Second Wind",
                source: "XPHB",
                level: 5,
                entries: ["Regain hit points."],
              },
              {
                resolved: true,
                name: "Fighting Style",
                source: "XPHB",
                level: 1,
                entries: ["Pick one."],
              },
              { resolved: false, name: "Action Surge", source: "XPHB" },
            ],
          },
        ],
      },
    });
    const card = renderActions("one");

    const bonus = (await within(card).findByRole("button", { name: "Second Wind" })).closest("ul");
    expect(names(bonus as HTMLElement)).toEqual(["Two-Weapon Fighting", "Second Wind"]);
    expect(within(card).queryByRole("button", { name: "Fighting Style" })).toBeNull();
    expect(within(card).queryByRole("button", { name: "Action Surge" })).toBeNull();

    const button = within(card).getByRole("button", { name: "Second Wind" });
    expect(button.tagName).toBe("BUTTON");
    fireEvent.click(button);
    expect(await screen.findByText("Regain hit points.")).toBeInTheDocument();
  });

  describe("Use", () => {
    const SECOND_WIND = {
      resolved: true,
      name: "Second Wind",
      source: "XPHB",
      level: 1,
      entries: [],
    };
    const FIGHTER = { name: "Fighter", source: "XPHB" };

    function renderUse(
      feature: object,
      {
        expended = 0,
        maximum = 2,
        restores = [],
        hitPoints = { current: null, temporary: 0 },
        turn = derivedRecord().turn,
        poolKey = "second_wind",
      }: {
        expended?: number;
        maximum?: number;
        restores?: CharacterDerived["featureRestores"];
        hitPoints?: CharacterState["hitPoints"];
        turn?: CharacterDerived["turn"];
        poolKey?: string;
      } = {},
    ) {
      let stored = stateRecord();
      stored = {
        ...stored,
        state: {
          ...stored.state,
          hitPoints,
          classResources: [{ class: FIGHTER, key: poolKey, maximum, expended }],
        },
      };
      const writes: CharacterState[] = [];
      const rolls: RollRecord[] = [];
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
          if (init?.method === "POST") {
            const roll = JSON.parse(String(init.body));
            rolls.push(roll);
            return Response.json({
              ...roll,
              id: rolls.length,
              characterId: "1",
              characterName: "Vex",
              rolledAt: "2024-01-01T00:00:00.000Z",
            });
          }
          if (init?.method === "PUT") {
            const written = JSON.parse(String(init.body));
            writes.push(written);
            stored = { ...stored, state: written };
            return Response.json(stored);
          }
          if (String(input).endsWith("/features")) {
            return Response.json({
              groups: [{ origin: "class", name: "Fighter", class: FIGHTER, features: [feature] }],
            });
          }
          return Response.json(stored);
        }),
      );
      const derived: CharacterDerived = {
        ...derivedRecord(),
        hitPointMaximum: { computed: 40, manual: null, terms: [] },
        featureRestores: restores,
        turn,
        classResources: [
          {
            class: FIGHTER,
            key: poolKey,
            maximum: { computed: maximum, manual: null, terms: [] },
          },
        ],
      };
      const card = renderActions("one", derived);
      return { card, writes, rolls };
    }

    it("spends the pool and the action type in one write, and announces it", async () => {
      const { card, writes } = renderUse(SECOND_WIND);
      const row = (await within(card).findByRole("button", { name: "Use Second Wind" })).closest(
        "li",
      ) as HTMLElement;
      expect(row).toHaveTextContent("2 / 2 Long rest");

      fireEvent.click(within(row).getByRole("button", { name: "Use Second Wind" }));

      await waitFor(() => expect(row).toHaveTextContent("1 / 2 Long rest"));
      expect(writes).toHaveLength(1);
      expect(writes[0]?.classResources[0]?.expended).toBe(1);
      expect(writes[0]?.turn.bonusAction).toBe(true);
      expect(within(row).getByRole("status")).toHaveTextContent(
        "Second Wind used: 1 of 2 left. Bonus action spent.",
      );
    });

    it("spends a chosen amount of a cost that varies, listed as a free action", async () => {
      const twinned = {
        resolved: true,
        name: "Twinned Spell",
        source: "PHB",
        level: 3,
        entries: [],
      };
      const { card, writes } = renderUse(twinned, { poolKey: "sorcery_points", maximum: 5 });
      const row = (await within(card).findByRole("button", { name: "Use Twinned Spell" })).closest(
        "li",
      ) as HTMLElement;
      expect(row).toHaveTextContent("5 / 5");

      fireEvent.change(within(row).getByLabelText("Amount to spend on Twinned Spell"), {
        target: { value: "3" },
      });
      fireEvent.click(within(row).getByRole("button", { name: "Use Twinned Spell" }));

      await waitFor(() => expect(row).toHaveTextContent("2 / 5"));
      expect(writes[0]?.classResources[0]?.expended).toBe(3);
      expect(writes[0]?.turn.bonusAction).toBe(false);
      expect(within(row).getByRole("status")).toHaveTextContent("Twinned Spell used: 2 of 5 left.");
    });

    it("adds an action to the turn in the spend's one write where the feature does", async () => {
      const surge = { name: "Action Surge", source: "XPHB" };
      const { card, writes } = renderUse(
        {
          ...SECOND_WIND,
          ...surge,
          uses: { key: "feature|Fighter|XPHB|Action Surge", count: 1, reset: "short" },
        },
        { turn: { ...derivedRecord().turn, addsAction: [surge] } },
      );
      const use = await within(card).findByRole("button", { name: "Use Action Surge" });
      fireEvent.click(use);

      await waitFor(() => expect(writes).toHaveLength(1));
      expect(writes[0]?.turn.addedActions).toEqual([false]);
      expect(writes[0]?.featureUses).toEqual([
        { key: "feature|Fighter|XPHB|Action Surge", expended: 1 },
      ]);
      expect(within(use.closest("li") as HTMLElement).getByRole("status")).toHaveTextContent(
        "Action Surge used: 0 of 1 left. Action added to the turn.",
      );
    });

    it("refuses a second added action in one turn while uses remain", async () => {
      const surge = { name: "Action Surge", source: "XPHB" };
      const { card, writes } = renderUse(
        {
          ...SECOND_WIND,
          ...surge,
          uses: { key: "feature|Fighter|XPHB|Action Surge", count: 2, reset: "short" },
        },
        { turn: { ...derivedRecord().turn, addsAction: [surge] } },
      );
      const use = await within(card).findByRole("button", { name: "Use Action Surge" });
      fireEvent.click(use);
      await waitFor(() => expect(use).toHaveAttribute("aria-disabled", "true"));
      expect(use).toHaveAttribute("title", "Action Surge already used this turn");
      fireEvent.click(use);
      expect(writes).toHaveLength(1);
      expect(writes[0]?.turn.addedActions).toEqual([false]);
    });

    it("refuses a use at 0 left", async () => {
      const { card, writes } = renderUse(SECOND_WIND, { expended: 2 });
      const use = await within(card).findByRole("button", { name: "Use Second Wind" });
      expect(use).toHaveAttribute("aria-disabled", "true");
      fireEvent.click(use);
      expect(writes).toHaveLength(0);
    });

    it("spends a feature's own limited uses where no pool backs it", async () => {
      const { card, writes } = renderUse({
        ...SECOND_WIND,
        source: "PHB",
        uses: { key: "feature|Fighter|PHB|Second Wind", count: 1, reset: "short" },
      });
      const use = await within(card).findByRole("button", { name: "Use Second Wind" });
      expect(use.closest("li")).toHaveTextContent("1 / 1 Short rest");
      fireEvent.click(use);
      await waitFor(() => expect(writes).toHaveLength(1));
      expect(writes[0]?.featureUses).toEqual([
        { key: "feature|Fighter|PHB|Second Wind", expended: 1 },
      ]);
      expect(writes[0]?.turn.bonusAction).toBe(true);
    });

    const restore = (
      name: string,
      source: string,
      rest: Partial<CharacterDerived["featureRestores"][number]>,
    ): CharacterDerived["featureRestores"][number] => ({
      feature: { name, source },
      kind: "heal",
      dice: null,
      bonus: 1,
      others: false,
      ...rest,
    });

    it("heals by the roll in the spend's one write, then logs the roll under the feature", async () => {
      const { card, writes, rolls } = renderUse(SECOND_WIND, {
        hitPoints: { current: 10, temporary: 0 },
        restores: [restore("Second Wind", "XPHB", { dice: "1d10", bonus: 5 })],
      });
      fireEvent.click(await within(card).findByRole("button", { name: "Use Second Wind" }));

      await waitFor(() => expect(rolls).toHaveLength(1));
      expect(writes).toHaveLength(1);
      expect(rolls[0]).toMatchObject({ type: "healing", label: "Second Wind", notation: "1d10+5" });
      const healed = rolls[0]?.total ?? 0;
      expect(healed).toBeGreaterThanOrEqual(6);
      expect(writes[0]?.hitPoints.current).toBe(10 + healed);
      expect(writes[0]?.classResources[0]?.expended).toBe(1);
      expect(writes[0]?.turn.bonusAction).toBe(true);
      const row = within(card).getByRole("button", { name: "Use Second Wind" }).closest("li");
      expect(within(row as HTMLElement).getByRole("status")).toHaveTextContent(
        `Second Wind: regained ${healed} hit points.`,
      );
    });

    it("shows a heal on another creature without healing the character", async () => {
      const spark = { ...SECOND_WIND, name: "Divine Spark" };
      const { card, writes, rolls } = renderUse(spark, {
        hitPoints: { current: 10, temporary: 0 },
        restores: [restore("Divine Spark", "XPHB", { dice: "1d8", bonus: 3, others: true })],
      });
      const use = await within(card).findByRole("button", { name: "Use Divine Spark" });
      fireEvent.click(use);

      await waitFor(() => expect(rolls).toHaveLength(1));
      expect(writes[0]?.hitPoints).toEqual({ current: 10, temporary: 0 });
      expect(within(use.closest("li") as HTMLElement).getByRole("status")).toHaveTextContent(
        `Divine Spark: ${rolls[0]?.total} hit points to restore to another creature.`,
      );
    });

    it("shows temporary hit points for another creature without granting them", async () => {
      const mantle = { ...SECOND_WIND, name: "Mantle of Inspiration", source: "XGE" };
      const gives = [
        restore("Mantle of Inspiration", "XGE", { kind: "tempHp", bonus: 8, others: true }),
      ];
      const { card, writes, rolls } = renderUse(mantle, {
        hitPoints: { current: 10, temporary: 0 },
        restores: gives,
      });
      const use = await within(card).findByRole("button", { name: "Use Mantle of Inspiration" });
      fireEvent.click(use);

      await waitFor(() => expect(rolls).toHaveLength(1));
      expect(writes[0]?.hitPoints).toEqual({ current: 10, temporary: 0 });
      expect(rolls[0]).toMatchObject({ type: "temporary-hp", label: "Mantle of Inspiration" });
      expect(within(use.closest("li") as HTMLElement).getByRole("status")).toHaveTextContent(
        "Mantle of Inspiration: 8 temporary hit points to give another creature.",
      );
    });

    it("grants temporary hit points", async () => {
      const tireless = { ...SECOND_WIND, name: "Tireless" };
      const gives = [restore("Tireless", "XPHB", { kind: "tempHp", bonus: 7 })];
      const low = renderUse(tireless, {
        hitPoints: { current: 10, temporary: 3 },
        restores: gives,
      });
      fireEvent.click(await within(low.card).findByRole("button", { name: "Use Tireless" }));
      await waitFor(() => expect(low.rolls).toHaveLength(1));
      expect(low.writes[0]?.hitPoints).toEqual({ current: 10, temporary: 7 });
      expect(low.rolls[0]).toMatchObject({ type: "temporary-hp", notation: "7", total: 7 });
    });

    it("keeps temporary hit points higher than a feature grants", async () => {
      const tireless = { ...SECOND_WIND, name: "Tireless" };
      const gives = [restore("Tireless", "XPHB", { kind: "tempHp", bonus: 7 })];
      const { card, writes } = renderUse(tireless, {
        hitPoints: { current: 10, temporary: 9 },
        restores: gives,
      });
      fireEvent.click(await within(card).findByRole("button", { name: "Use Tireless" }));
      await waitFor(() => expect(writes).toHaveLength(1));
      expect(writes[0]?.hitPoints).toEqual({ current: 10, temporary: 9 });
    });
  });

  describe("Convert", () => {
    const SORCERER = { name: "Sorcerer", source: "PHB" };
    const FONT = { resolved: true, name: "Font of Magic", source: "PHB", level: 2, entries: [] };
    const total = (computed: number) => ({ computed, manual: null, terms: [] });

    function renderConvert(points: number, slots: CharacterState["spellSlots"]) {
      let stored = stateRecord();
      stored = {
        ...stored,
        state: {
          ...stored.state,
          spellSlots: slots,
          classResources: [
            { class: SORCERER, key: "sorcery_points", maximum: 3, expended: 3 - points },
          ],
        },
      };
      const writes: CharacterState[] = [];
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
          if (init?.method === "PUT") {
            const written = JSON.parse(String(init.body));
            writes.push(written);
            stored = { ...stored, state: written };
            return Response.json(stored);
          }
          if (String(input).endsWith("/features")) {
            return Response.json({
              groups: [{ origin: "class", name: "Sorcerer", class: SORCERER, features: [FONT] }],
            });
          }
          return Response.json(stored);
        }),
      );
      const derived: CharacterDerived = {
        ...derivedRecord(),
        spellSlots: [
          { level: 1, total: total(4) },
          { level: 2, total: total(2) },
        ],
        classResources: [{ class: SORCERER, key: "sorcery_points", maximum: total(3) }],
        featureConversions: [
          {
            feature: { name: "Font of Magic", source: "PHB" },
            class: SORCERER,
            pool: "sorcery_points",
            costs: [2, 3, 5, 6, 7],
            refund: true,
          },
        ],
      };
      return { card: renderActions("classic", derived), writes };
    }

    it("refills a slot from the points, with the bonus action, in one write", async () => {
      const { card, writes } = renderConvert(2, [{ level: 1, total: 4, expended: 1 }]);
      fireEvent.click(
        await within(card).findByRole("button", { name: "Convert with Font of Magic" }),
      );
      const dialog = await screen.findByRole("dialog");
      expect(within(dialog).getByRole("radio", { name: /Regain a level 2 slot/ })).toBeDisabled();
      expect(dialog).toHaveTextContent(
        "Regain a level 2 slot for 3 sorcery points (Sorcery points: 2 left, 3 needed.)",
      );
      fireEvent.click(within(dialog).getByRole("radio", { name: /Regain a level 1 slot/ }));
      fireEvent.click(within(dialog).getByRole("button", { name: "Convert" }));

      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
      expect(writes).toHaveLength(1);
      expect(writes[0]?.spellSlots).toEqual([{ level: 1, total: 4, expended: 0 }]);
      expect(writes[0]?.classResources[0]?.expended).toBe(3);
      expect(writes[0]?.turn.bonusAction).toBe(true);
      expect(within(card).getByRole("status")).toHaveTextContent(
        "Font of Magic used to regain a level 1 slot for 2 sorcery points. Bonus action spent.",
      );
    });

    it("expends a slot for points, gaining no more than the pool spent", async () => {
      const { card, writes } = renderConvert(2, []);
      fireEvent.click(
        await within(card).findByRole("button", { name: "Convert with Font of Magic" }),
      );
      const dialog = await screen.findByRole("dialog");
      fireEvent.click(
        within(dialog).getByRole("radio", { name: "Expend a level 2 slot for 1 sorcery point" }),
      );
      fireEvent.click(within(dialog).getByRole("button", { name: "Convert" }));

      await waitFor(() => expect(writes).toHaveLength(1));
      expect(writes[0]?.spellSlots).toEqual([{ level: 2, total: 2, expended: 1 }]);
      expect(writes[0]?.classResources[0]?.expended).toBe(0);
    });

    it("spends a feature's own use once with the trade, in one write", async () => {
      const CLERIC = { name: "Cleric", source: "PHB" };
      const HARNESS = "Channel Divinity: Harness Divine Power";
      const key = `feature|Cleric|PHB|${HARNESS}`;
      let stored = stateRecord();
      stored = {
        ...stored,
        state: { ...stored.state, spellSlots: [{ level: 1, total: 4, expended: 1 }] },
      };
      const writes: CharacterState[] = [];
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
          if (init?.method === "PUT") {
            const written = JSON.parse(String(init.body));
            writes.push(written);
            stored = { ...stored, state: written };
            return Response.json(stored);
          }
          if (String(input).endsWith("/features")) {
            const feature = {
              resolved: true,
              name: HARNESS,
              source: "TCE",
              level: 2,
              entries: [],
              uses: { key, count: 1, reset: "long" },
            };
            return Response.json({
              groups: [{ origin: "class", name: "Cleric", class: CLERIC, features: [feature] }],
            });
          }
          return Response.json(stored);
        }),
      );
      const derived: CharacterDerived = {
        ...derivedRecord(),
        spellSlots: [{ level: 1, total: total(4) }],
        featureConversions: [
          {
            feature: { name: HARNESS, source: "TCE" },
            class: CLERIC,
            pool: "channel_divinity",
            costs: [1],
            refund: false,
          },
        ],
      };
      const card = renderActions("classic", derived);
      const opener = await within(card).findByRole("button", { name: `Convert with ${HARNESS}` });
      expect(opener.closest("li")).toHaveTextContent("1 / 1 Long rest");
      fireEvent.click(opener);
      const dialog = await screen.findByRole("dialog");
      fireEvent.click(within(dialog).getByRole("radio", { name: /Regain a level 1 slot/ }));
      fireEvent.click(within(dialog).getByRole("button", { name: "Convert" }));

      await waitFor(() => expect(writes).toHaveLength(1));
      expect(writes[0]?.spellSlots).toEqual([{ level: 1, total: 4, expended: 0 }]);
      expect(writes[0]?.featureUses).toEqual([{ key, expended: 1 }]);
      expect(writes[0]?.turn.bonusAction).toBe(true);
      await waitFor(() =>
        expect(
          within(card).getByRole("button", { name: `Convert with ${HARNESS}` }),
        ).toHaveAttribute("aria-disabled", "true"),
      );
    });
  });
});
