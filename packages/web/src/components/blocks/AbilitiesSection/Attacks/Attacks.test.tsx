import { type CharacterDerived, characterDefinitionSchema } from "@dnd/character";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterKey } from "../../../../hooks/characterKeys.ts";
import { characterRecord, derivedRecord, stateRecord } from "../../../../test/records.ts";
import { renderWithClient } from "../../../../test/renderWithClient.tsx";
import { stubFetchByUrl } from "../../../../test/stubFetch.ts";
import { OnRolled, RollingFor } from "../../../rollerContext.ts";
import { Attacks } from "./Attacks.tsx";

/** Vex with a longsword in hand and a dagger in the pack. */
function vex() {
  const record = characterRecord("1", "Vex");
  const definition = characterDefinitionSchema.parse({
    ...record.definition,
    inventory: [
      { ref: { name: "Longsword", source: "PHB" }, equipped: true },
      { ref: { name: "Dagger", source: "PHB" } },
    ],
  });
  return { ...record, definition };
}

const attack = (entry: number, bonus: number): CharacterDerived["attacks"][number] => ({
  entry,
  ability: "str",
  attackBonus: { computed: bonus, manual: null, terms: [{ label: "Strength", value: bonus }] },
  critThreshold: { computed: 20, manual: null, terms: [] },
  damage: {
    dice: "1d8",
    type: "slashing",
    modifier: { computed: -1, manual: null, terms: [{ label: "Strength", value: -1 }] },
  },
  grip: null,
  mastery: [],
  range: null,
  ammunition: null,
  reload: null,
});

function renderAttacks(derived: CharacterDerived) {
  stubFetchByUrl({
    "/api/characters/1/inventory": {
      items: [{ name: "Longsword" }, { name: "Dagger" }],
    },
  });
  renderWithClient(<Attacks character={vex()} derived={derived} />);
}

const rows = () =>
  within(screen.getByRole("region", { name: "Attacks & Spellcasting" })).getAllByRole("row");

afterEach(() => vi.unstubAllGlobals());

describe("Attacks", () => {
  it("lists each equipped weapon's bonus and damage, then each class's spell attack", async () => {
    renderAttacks({ ...derivedRecord(), attacks: [attack(0, 5), attack(1, 2)] });

    expect(await screen.findByRole("rowheader", { name: "Longsword" })).toBeInTheDocument();
    expect(rows().map((row) => row.textContent)).toEqual([
      "NameBonusDamage / TypeRoll attackRoll damage",
      "Longsword+51d8-1 slashing",
      "Warlock spell attack+5—None",
    ]);
  });

  it("shows the lowered critical threshold beside the damage, and nothing at 20", async () => {
    const crits = { computed: 19, manual: null, terms: [] };
    renderAttacks({
      ...derivedRecord(),
      attacks: [{ ...attack(0, 5), critThreshold: crits }, attack(1, 2)],
    });

    expect(await screen.findByRole("rowheader", { name: "Longsword" })).toBeInTheDocument();
    expect(rows().map((row) => row.textContent)).toContain(
      "Longsword+51d8-1 slashing · Crit 19–20",
    );
  });

  it("marks each attack bonus with the advantage or disadvantage an item grants on attack rolls", async () => {
    renderAttacks({
      ...derivedRecord(),
      attacks: [attack(0, 5)],
      rollEffects: {
        computed: [
          {
            source: "Oathbow",
            mode: "disadvantage",
            roll: "attack",
            condition: "with all other weapons",
          },
          { source: "Boots of Elvenkind", mode: "advantage", roll: "skill", target: "Stealth" },
        ],
        manual: null,
        terms: [],
      },
    });

    fireEvent.focus(
      await screen.findByRole("button", {
        name: "Longsword: Disadvantage if every condition holds",
      }),
    );
    expect(
      screen.getByRole("group", { name: "Longsword advantage and disadvantage" }),
    ).toHaveTextContent("Disadvantage with all other weapons (Oathbow)");
    expect(screen.getByRole("rowheader", { name: /^Longsword/ })).not.toHaveTextContent("Oathbow");
    expect(
      screen.getByRole("button", {
        name: "Warlock spell attack: Disadvantage if every condition holds",
      }),
    ).toHaveTextContent(/^DIS\*$/);
  });

  it("marks only the attacks that use the ability an effect names, citing its source", async () => {
    renderAttacks({
      ...derivedRecord(),
      attacks: [attack(0, 5)],
      rollEffects: {
        computed: (["str", "dex", "con"] as const).map((target) => ({
          source: "Heavily encumbered",
          mode: "disadvantage" as const,
          roll: "attack" as const,
          target,
        })),
        manual: null,
        terms: [],
      },
    });

    fireEvent.focus(await screen.findByRole("button", { name: "Longsword: Disadvantage" }));
    expect(
      screen.getByRole("group", { name: "Longsword advantage and disadvantage" }),
    ).toHaveTextContent("Disadvantage (Heavily encumbered)");
    expect(screen.queryByRole("button", { name: /^Warlock spell attack:/ })).toBeNull();
  });

  it("notes under each spell attack that armor worn without proficiency stops casting", async () => {
    renderAttacks({
      ...derivedRecord(),
      attacks: [attack(0, 5)],
      castingBlockedBy: ["Plate Armor"],
    });

    expect(
      await screen.findByRole("rowheader", { name: /^Warlock spell attack/ }),
    ).toHaveTextContent("Can't cast spells while wearing Plate Armor without proficiency.");
    expect(screen.getByRole("rowheader", { name: "Longsword" })).not.toHaveTextContent("cast");
  });

  it("opens a weapon's attack terms from its bonus", async () => {
    renderAttacks({ ...derivedRecord(), attacks: [attack(0, 5)] });

    fireEvent.click(await screen.findByRole("button", { name: "Longsword attack bonus +5" }));
    expect(
      screen.getByRole("group", { name: "Longsword attack bonus breakdown" }),
    ).toHaveTextContent("Strength5");
  });

  it("names the mastery a chosen weapon has, linked to its rules text", async () => {
    const topple = { name: "Topple", source: "XPHB" };
    const fetchMock = stubFetchByUrl({
      "/api/characters/1/inventory": { items: [{ name: "Longsword" }, { name: "Dagger" }] },
      "/api/refs/resolve": {
        refs: [
          {
            ...topple,
            entries: ["Push the target over."],
            path: "/catalog/itemMastery/Topple/XPHB",
          },
        ],
      },
    });
    renderWithClient(
      <Attacks
        character={vex()}
        derived={{ ...derivedRecord(), attacks: [{ ...attack(0, 5), mastery: [topple] }] }}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Topple" }));
    expect(screen.getByRole("rowheader", { name: /Mastery: Topple/ })).toBeInTheDocument();
    expect(
      JSON.parse(
        String(fetchMock.mock.calls.find(([url]) => url === "/api/refs/resolve")?.[1]?.body),
      ).refs,
    ).toEqual([{ tag: "itemMastery", name: "Topple", source: "XPHB" }]);
    expect(screen.getByText("Push the target over.")).toBeInTheDocument();
  });

  it("names no mastery on a weapon that has none", async () => {
    renderAttacks({ ...derivedRecord(), attacks: [attack(0, 5)] });

    expect(await screen.findByRole("rowheader", { name: "Longsword" })).toBeInTheDocument();
    expect(screen.queryByText(/Mastery/)).not.toBeInTheDocument();
  });

  it("shows a ranged weapon's range, its ammunition with the count left, and a firearm's reload", async () => {
    renderAttacks({
      ...derivedRecord(),
      attacks: [
        {
          ...attack(0, 5),
          range: { normal: 80, long: 320 },
          ammunition: { type: "arrow|phb", stacks: [{ entry: 1, quantity: 12 }] },
          reload: 2,
        },
      ],
    });

    const row = await screen.findByRole("rowheader", { name: /Longsword/ });
    expect(row).toHaveTextContent("Range 80/320 ft");
    expect(row).toHaveTextContent("Ammunition: arrow (12 left)");
    expect(row).toHaveTextContent("Reload 2");
  });

  it("shows no range, ammunition or reload on a weapon that states none", async () => {
    renderAttacks({ ...derivedRecord(), attacks: [attack(0, 5)] });

    expect(await screen.findByRole("rowheader", { name: "Longsword" })).toBeInTheDocument();
    expect(screen.queryByText(/Range|Ammunition|Reload/)).not.toBeInTheDocument();
  });

  it("opens a class's spell attack terms from its bonus", async () => {
    renderAttacks(derivedRecord());

    fireEvent.click(await screen.findByRole("button", { name: "Warlock spell attack bonus +5" }));
    expect(
      screen.getByRole("group", { name: "Warlock spell attack bonus breakdown" }),
    ).toHaveTextContent("Charisma3Proficiency2");
  });

  it("says so when nothing is equipped and nothing casts", () => {
    renderAttacks({ ...derivedRecord(), spellcasting: [], attacks: [attack(1, 2)] });

    expect(screen.getByText("No weapon equipped.")).toBeInTheDocument();
  });

  describe("roll buttons", () => {
    const logged = {
      id: 1,
      characterId: "1",
      characterName: "Vex",
      rolledAt: "2026-01-01T00:00:00.000Z",
      label: "x",
      notation: "x",
      total: 9,
      dice: [],
      modifier: 0,
      critical: false,
    };

    function renderRolling(
      derived: CharacterDerived,
      status = 201,
      conditions: { name: string; source: string }[] = [],
      houseRules: Record<string, string> = {},
    ) {
      const onRolled = vi.fn();
      const posts: Record<string, unknown>[] = [];
      const play = stateRecord();
      stubFetchByUrl({
        "/api/characters/1/inventory": { items: [{ name: "Longsword" }] },
        "/api/characters/1/state": { ...play, state: { ...play.state, conditions } },
      });
      const base = globalThis.fetch;
      vi.stubGlobal("fetch", async (url: RequestInfo | URL, init?: RequestInit) => {
        if (String(url) !== "/api/characters/1/rolls") return base(url, init);
        if (init?.method === "POST") posts.push(JSON.parse(String(init.body)));
        return new Response(JSON.stringify(logged), { status });
      });
      const character = {
        ...vex(),
        definition: characterDefinitionSchema.parse({ ...vex().definition, houseRules }),
      };
      const client = new QueryClient();
      client.setQueryData(characterKey("1"), character);
      render(
        <QueryClientProvider client={client}>
          <RollingFor value="1">
            <OnRolled value={onRolled}>
              <Attacks character={character} derived={derived} />
            </OnRolled>
          </RollingFor>
        </QueryClientProvider>,
      );
      return { posts, onRolled };
    }

    it("rolls a weapon's attack and damage and a spell attack, each labelled, typed and from its origin", async () => {
      const { posts } = renderRolling({ ...derivedRecord(), attacks: [attack(0, 5)] });
      fireEvent.click(await screen.findByRole("button", { name: "Roll Longsword attack" }));
      fireEvent.click(screen.getByRole("button", { name: "Roll Longsword damage" }));
      fireEvent.click(screen.getByRole("button", { name: "Roll Warlock spell attack" }));

      await waitFor(() => expect(posts).toHaveLength(3));
      expect(posts.map((post) => [post.label, post.notation, post.type, post.origin])).toEqual([
        ["Longsword attack", "1d20+5", "attack", "Longsword"],
        ["Longsword damage", "1d8-1", "damage", "Longsword"],
        ["Warlock spell attack", "1d20+5", "spell-attack", "Warlock"],
      ]);
    });

    it("calls out a natural 20 and doubles the damage dice, not the modifier, once", async () => {
      vi.spyOn(Math, "random").mockReturnValue(0.99);
      const { posts } = renderRolling({ ...derivedRecord(), attacks: [attack(0, 5)] });
      const mark = await screen.findByRole("checkbox", { name: "Critical hit" });
      expect(mark).not.toBeChecked();
      fireEvent.click(screen.getByRole("button", { name: "Roll Longsword attack" }));

      await waitFor(() => expect(mark).toBeChecked());
      expect(await screen.findByText(/: 25, critical hit$/)).toHaveAttribute("role", "status");
      fireEvent.click(screen.getByRole("button", { name: "Roll Longsword damage" }));

      await waitFor(() => expect(posts).toHaveLength(2));
      expect(posts[1]).toMatchObject({ critical: true, modifier: -1, total: 15 });
      expect(posts[1]?.dice).toHaveLength(2);
      await waitFor(() => expect(mark).not.toBeChecked());
    });

    it("calls out a roll at a lowered threshold", async () => {
      const lowered = {
        ...attack(0, 5),
        critThreshold: { computed: 19, manual: null, terms: [] },
      };
      vi.spyOn(Math, "random").mockReturnValue(0.9);
      renderRolling({ ...derivedRecord(), attacks: [lowered] });
      fireEvent.click(await screen.findByRole("button", { name: "Roll Longsword attack" }));
      await waitFor(() =>
        expect(screen.getByRole("checkbox", { name: "Critical hit" })).toBeChecked(),
      );
    });

    it("does not call out a roll one below a lowered threshold", async () => {
      const lowered = {
        ...attack(0, 5),
        critThreshold: { computed: 19, manual: null, terms: [] },
      };
      vi.spyOn(Math, "random").mockReturnValue(0.85);
      const { posts } = renderRolling({ ...derivedRecord(), attacks: [lowered] });
      fireEvent.click(await screen.findByRole("button", { name: "Roll Longsword attack" }));
      await waitFor(() => expect(posts).toHaveLength(1));
      expect(screen.getByRole("checkbox", { name: "Critical hit" })).not.toBeChecked();
    });

    it("calls out a spell attack's natural 20 and clears it on the next roll", async () => {
      const random = vi.spyOn(Math, "random").mockReturnValue(0.99);
      const { posts } = renderRolling({ ...derivedRecord(), attacks: [] });
      const roll = await screen.findByRole("button", { name: "Roll Warlock spell attack" });
      fireEvent.click(roll);
      expect(await screen.findByText("Critical hit")).toBeVisible();

      random.mockReturnValue(0.5);
      fireEvent.click(roll);
      await waitFor(() => expect(posts).toHaveLength(2));
      await waitFor(() => expect(screen.queryByText("Critical hit")).toBeNull());
    });

    it("does not call out a roll below the threshold", async () => {
      vi.spyOn(Math, "random").mockReturnValue(0.9);
      const { posts } = renderRolling({ ...derivedRecord(), attacks: [attack(0, 5)] });
      fireEvent.click(await screen.findByRole("button", { name: "Roll Longsword attack" }));
      await waitFor(() => expect(posts).toHaveLength(1));
      expect(screen.getByRole("checkbox", { name: "Critical hit" })).not.toBeChecked();
    });

    it("doubles the damage dice of a roll marked critical by hand", async () => {
      const { posts } = renderRolling({ ...derivedRecord(), attacks: [attack(0, 5)] });
      fireEvent.click(await screen.findByRole("checkbox", { name: "Critical hit" }));
      fireEvent.click(screen.getByRole("button", { name: "Roll Longsword damage" }));

      await waitFor(() => expect(posts).toHaveLength(1));
      expect(posts[0]).toMatchObject({ critical: true, modifier: -1 });
      expect(posts[0]?.dice).toHaveLength(2);
    });

    it("counts one set of the damage dice at its maximum on a critical where the table plays it", async () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      const { posts } = renderRolling({ ...derivedRecord(), attacks: [attack(0, 5)] }, 201, [], {
        criticalHit: "maximum",
      });
      fireEvent.click(await screen.findByRole("checkbox", { name: "Critical hit" }));
      fireEvent.click(screen.getByRole("button", { name: "Roll Longsword damage" }));

      await waitFor(() => expect(posts).toHaveLength(1));
      expect(posts[0]).toMatchObject({ critical: true, total: 8, modifier: -1 });
      expect(posts[0]).toMatchObject({ dice: [{ value: 8 }, { value: 1 }] });
    });

    describe("flanking", () => {
      it("offers none as printed", async () => {
        renderRolling({ ...derivedRecord(), attacks: [attack(0, 5)] });
        await screen.findByRole("button", { name: "Roll Longsword attack" });
        expect(screen.queryByRole("checkbox", { name: "Flanking" })).toBeNull();
      });

      it("offers none on a weapon that states a range", async () => {
        renderRolling(
          {
            ...derivedRecord(),
            attacks: [{ ...attack(0, 5), range: { normal: 20, long: 60 } }],
          },
          201,
          [],
          { flanking: "advantage" },
        );
        await screen.findByRole("button", { name: "Roll Longsword attack" });
        expect(screen.queryByRole("checkbox", { name: "Flanking" })).toBeNull();
      });

      it("offers none on a weapon that fires ammunition", async () => {
        renderRolling(
          {
            ...derivedRecord(),
            attacks: [
              {
                ...attack(0, 5),
                ammunition: { type: "arrow|phb", stacks: [{ entry: 1, quantity: 5 }] },
              },
            ],
          },
          201,
          [],
          { flanking: "advantage" },
        );
        await screen.findByRole("button", { name: "Roll Longsword attack" });
        expect(screen.queryByRole("checkbox", { name: "Flanking" })).toBeNull();
      });

      it("gives advantage that nets against a condition's disadvantage", async () => {
        renderRolling({ ...derivedRecord(), attacks: [attack(0, 5)] }, 201, [], {
          flanking: "advantage",
        });
        const mode = await screen.findByRole("combobox", { name: "Longsword attack mode" });
        fireEvent.click(screen.getByRole("checkbox", { name: "Flanking" }));
        expect(mode).toHaveValue("advantage");
        expect(mode).toHaveAccessibleDescription("Flanking: advantage");
      });

      it("cancels against a poisoned character's disadvantage", async () => {
        renderRolling(
          { ...derivedRecord(), attacks: [attack(0, 5)] },
          201,
          [{ name: "Poisoned", source: "x" }],
          { flanking: "advantage" },
        );
        const mode = await screen.findByRole("combobox", { name: "Longsword attack mode" });
        await waitFor(() => expect(mode).toHaveValue("disadvantage"));
        fireEvent.click(screen.getByRole("checkbox", { name: "Flanking" }));
        expect(mode).toHaveValue("normal");
      });

      it("adds 2 and names it in the logged roll", async () => {
        vi.spyOn(Math, "random").mockReturnValue(0);
        const { posts } = renderRolling({ ...derivedRecord(), attacks: [attack(0, 5)] }, 201, [], {
          flanking: "bonus",
        });
        fireEvent.click(await screen.findByRole("checkbox", { name: "Flanking" }));
        fireEvent.click(
          screen.getByRole("button", { name: "Roll Longsword attack while flanking +2" }),
        );

        await waitFor(() => expect(posts).toHaveLength(1));
        expect(posts[0]).toMatchObject({
          label: "Longsword attack while flanking +2",
          notation: "1d20+7",
          modifier: 7,
          total: 8,
        });
        expect(await screen.findByText("Longsword attack while flanking +2: 8")).toHaveAttribute(
          "role",
          "status",
        );
      });
    });

    const effects = (...list: CharacterDerived["rollEffects"]["computed"]) => ({
      computed: list,
      manual: null,
      terms: [],
    });

    it("rolls two dice and records the mode and the discarded die when rolled with advantage", async () => {
      const { posts } = renderRolling({ ...derivedRecord(), attacks: [attack(0, 5)] });
      const mode = await screen.findByRole("combobox", { name: "Longsword attack mode" });
      expect(mode).toHaveValue("normal");
      fireEvent.change(mode, { target: { value: "advantage" } });
      fireEvent.click(screen.getByRole("button", { name: "Roll Longsword attack" }));

      await waitFor(() => expect(posts).toHaveLength(1));
      const [post] = posts as { mode: string; dice: { kept: boolean }[] }[];
      expect(post?.mode).toBe("advantage");
      expect(post?.dice.map(({ kept }) => kept).sort()).toEqual([false, true]);
      expect(await screen.findByText(/^Longsword attack with advantage: \d+$/)).toHaveAttribute(
        "role",
        "status",
      );
    });

    it("starts on the net of what holds, and names every source, a conditional one too", async () => {
      renderRolling({
        ...derivedRecord(),
        attacks: [attack(0, 5)],
        rollEffects: effects(
          { source: "Oathbow", mode: "advantage", roll: "attack" },
          { source: "Ring", mode: "disadvantage", roll: "attack", condition: "in sunlight" },
        ),
      });
      const mode = await screen.findByRole("combobox", { name: "Longsword attack mode" });
      expect(mode).toHaveValue("advantage");
      expect(mode).toHaveAccessibleDescription(
        "Oathbow: advantage; Ring: disadvantage in sunlight",
      );
    });

    it("offers a normal roll where advantage and disadvantage cancel", async () => {
      renderRolling({
        ...derivedRecord(),
        attacks: [attack(0, 5)],
        rollEffects: effects(
          { source: "Oathbow", mode: "advantage", roll: "attack" },
          { source: "Armor", mode: "disadvantage", roll: "attack" },
        ),
      });
      expect(await screen.findByRole("combobox", { name: "Longsword attack mode" })).toHaveValue(
        "normal",
      );
    });

    it("starts a poisoned character's attack on disadvantage", async () => {
      const { posts } = renderRolling({ ...derivedRecord(), attacks: [attack(0, 5)] }, 201, [
        { name: "Poisoned", source: "XPHB" },
      ]);
      const mode = await screen.findByRole("combobox", { name: "Longsword attack mode" });
      await waitFor(() => expect(mode).toHaveValue("disadvantage"));
      expect(mode).toHaveAccessibleDescription("Poisoned: disadvantage");
      fireEvent.click(screen.getByRole("button", { name: "Roll Longsword attack" }));
      await waitFor(() => expect(posts[0]?.mode).toBe("disadvantage"));
    });

    it("has no damage button on a weapon with no damage", async () => {
      renderRolling({ ...derivedRecord(), attacks: [{ ...attack(0, 5), damage: null }] });
      await screen.findByRole("button", { name: "Roll Longsword attack" });
      expect(screen.queryByRole("button", { name: /damage$/ })).toBeNull();
    });

    it("hands the recorded entry to the layout and announces the total without moving focus", async () => {
      const { onRolled } = renderRolling({ ...derivedRecord(), attacks: [attack(0, 5)] });
      const button = await screen.findByRole("button", { name: "Roll Longsword damage" });
      button.focus();
      fireEvent.click(button);
      await waitFor(() => expect(onRolled).toHaveBeenCalledWith(logged));
      expect(await screen.findByText(/^Longsword damage: \d+$/)).toHaveAttribute("role", "status");
      expect(button).toHaveFocus();
    });

    it("announces a roll the server could not record as not logged", async () => {
      renderRolling({ ...derivedRecord(), attacks: [attack(0, 5)] }, 500);
      fireEvent.click(await screen.findByRole("button", { name: "Roll Longsword attack" }));
      expect(await screen.findByText(/^Longsword attack: \d+, not logged$/)).toBeInTheDocument();
    });

    it("shows no roll button where no character is open to record to", async () => {
      renderAttacks({ ...derivedRecord(), attacks: [attack(0, 5)] });
      await screen.findByRole("rowheader", { name: "Longsword" });
      expect(screen.queryByRole("button", { name: /^Roll / })).toBeNull();
    });
  });
});
