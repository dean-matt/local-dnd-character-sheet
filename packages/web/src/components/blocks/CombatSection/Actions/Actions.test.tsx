import type { CharacterDerived, CharacterRecord, CharacterState, RollRecord } from "@dnd/character";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
      }: {
        expended?: number;
        maximum?: number;
        restores?: CharacterDerived["featureRestores"];
        hitPoints?: CharacterState["hitPoints"];
      } = {},
    ) {
      let stored = stateRecord();
      stored = {
        ...stored,
        state: {
          ...stored.state,
          hitPoints,
          classResources: [{ class: FIGHTER, key: "second_wind", maximum, expended }],
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
        classResources: [
          {
            class: FIGHTER,
            key: "second_wind",
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
});
