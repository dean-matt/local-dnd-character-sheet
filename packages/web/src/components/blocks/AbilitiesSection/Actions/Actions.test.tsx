import type { CharacterDerived, CharacterRecord, CharacterState } from "@dnd/character";
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

    const bonus = (await within(card).findByRole("button", { name: "Second Wind" })).closest("div");
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
      { expended = 0, maximum = 2 }: { expended?: number; maximum?: number } = {},
    ) {
      let stored = stateRecord();
      stored = {
        ...stored,
        state: {
          ...stored.state,
          classResources: [{ class: FIGHTER, key: "second_wind", maximum, expended }],
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
              groups: [{ origin: "class", name: "Fighter", class: FIGHTER, features: [feature] }],
            });
          }
          return Response.json(stored);
        }),
      );
      const derived: CharacterDerived = {
        ...derivedRecord(),
        classResources: [
          {
            class: FIGHTER,
            key: "second_wind",
            maximum: { computed: maximum, manual: null, terms: [] },
          },
        ],
      };
      const card = renderActions("one", derived);
      return { card, writes };
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
  });
});
