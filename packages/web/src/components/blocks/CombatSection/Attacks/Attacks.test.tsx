import {
  type CharacterDerived,
  type CharacterState,
  characterDefinitionSchema,
} from "@dnd/character";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterKey } from "../../../../hooks/characterKeys.ts";
import { characterRecord, derivedRecord, stateRecord } from "../../../../test/records.ts";
import { renderWithClient } from "../../../../test/renderWithClient.tsx";
import { stubFetchByUrl } from "../../../../test/stubFetch.ts";
import { SaveOverride } from "../../../overrideContext.ts";
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
  options: [],
  featureDamage: [],
});

const unarmedStrike: CharacterDerived["unarmedStrike"] = {
  featureDamage: [],
  attackBonus: {
    computed: 5,
    manual: null,
    terms: [
      { label: "Strength", value: 3 },
      { label: "Proficiency", value: 2 },
    ],
  },
  critThreshold: { computed: 20, manual: null, terms: [] },
  damage: {
    dice: "1d1",
    type: "bludgeoning",
    modifier: { computed: 0, manual: null, terms: [] },
  },
  options: [],
};

function renderAttacks(derived: CharacterDerived) {
  stubFetchByUrl({
    "/api/characters/1/inventory": {
      items: [{ name: "Longsword" }, { name: "Dagger" }],
    },
  });
  renderWithClient(<Attacks character={vex()} derived={derived} />);
}

const longsword = () =>
  within(screen.getByRole("rowheader", { name: /^Longsword/ }).closest("tr") as HTMLElement);

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
      "Unarmed Strike+11d1-1 bludgeoning",
      "Warlock spell attack+5—None",
    ]);
  });

  describe("the off-hand attack", () => {
    const offHand: CharacterDerived["offHandAttack"] = {
      ...attack(1, 2),
      damage: {
        dice: "1d4",
        type: "piercing",
        modifier: { computed: 0, manual: null, terms: [{ label: "Off-hand", value: 0 }] },
      },
    };

    it("shows a bonus-action row for the second light weapon, without the positive modifier", async () => {
      renderAttacks({
        ...derivedRecord(),
        attacks: [attack(0, 5), attack(1, 2)],
        offHandAttack: offHand,
      });

      const row = (await screen.findByRole("rowheader", { name: /^Dagger \(off-hand\)/ })).closest(
        "tr",
      ) as HTMLElement;
      expect(row).toHaveTextContent("Bonus action");
      expect(row).toHaveTextContent("+21d4 piercing");
    });

    it("shows no row without one", async () => {
      renderAttacks({ ...derivedRecord(), attacks: [attack(0, 5), attack(1, 2)] });
      await screen.findByRole("rowheader", { name: "Longsword" });
      expect(screen.queryByText(/off-hand/)).toBeNull();
    });
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

  it("lists an unarmed strike when nothing is equipped and nothing casts", async () => {
    renderAttacks({ ...derivedRecord(), spellcasting: [], attacks: [attack(1, 2)], unarmedStrike });

    expect(await screen.findByRole("rowheader", { name: "Unarmed Strike" })).toBeInTheDocument();
    expect(rows().map((row) => row.textContent)).toEqual([
      "NameBonusDamage / TypeRoll attackRoll damage",
      "Unarmed Strike+51d1 bludgeoning",
    ]);
  });

  it("opens the unarmed strike's bonus terms", async () => {
    renderAttacks({ ...derivedRecord(), attacks: [], unarmedStrike });

    fireEvent.click(await screen.findByRole("button", { name: "Unarmed Strike attack bonus +5" }));
    expect(
      screen.getByRole("group", { name: "Unarmed Strike attack bonus breakdown" }),
    ).toHaveTextContent("Strength3Proficiency2");
  });

  it("saves an unarmed strike's bonus, damage modifier and critical threshold under its own key", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    stubFetchByUrl({ "/api/characters/1/inventory": { items: [] } });
    renderWithClient(
      <SaveOverride.Provider value={save}>
        <Attacks character={vex()} derived={{ ...derivedRecord(), attacks: [], unarmedStrike }} />
      </SaveOverride.Provider>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Unarmed Strike attack bonus +5" }));
    const bonus = screen.getByRole("textbox", { name: "Unarmed Strike attack bonus override" });
    fireEvent.change(bonus, { target: { value: "7" } });
    fireEvent.blur(bonus);
    await waitFor(() => expect(save).toHaveBeenCalledWith("unarmedStrike.attackBonus", 7));

    fireEvent.click(screen.getByRole("button", { name: "1d1 bludgeoning" }));
    for (const [name, value] of [
      ["Unarmed Strike damage modifier override", "2"],
      ["Unarmed Strike critical hit threshold override", "19"],
    ] as const) {
      fireEvent.change(screen.getByRole("textbox", { name }), { target: { value } });
    }
    fireEvent.keyDown(screen.getByRole("group", { name: "Unarmed Strike damage breakdown" }), {
      key: "Escape",
    });
    await waitFor(() => {
      expect(save).toHaveBeenCalledWith("unarmedStrike.damage.modifier", 2);
      expect(save).toHaveBeenCalledWith("unarmedStrike.critThreshold", 19);
    });
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
      held: Partial<CharacterState> = {},
    ) {
      const onRolled = vi.fn();
      const posts: Record<string, unknown>[] = [];
      const puts: CharacterState[] = [];
      const play = stateRecord();
      stubFetchByUrl({
        "/api/characters/1/inventory": { items: [{ name: "Longsword" }] },
        "/api/characters/1/state": { ...play, state: { ...play.state, conditions, ...held } },
      });
      const base = globalThis.fetch;
      vi.stubGlobal("fetch", async (url: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === "PUT") puts.push(JSON.parse(String(init.body)));
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
      return { posts, puts, onRolled };
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

    it("rolls the unarmed strike's attack and damage, each labelled and from its origin", async () => {
      const { posts } = renderRolling({ ...derivedRecord(), attacks: [], unarmedStrike });
      fireEvent.click(await screen.findByRole("button", { name: "Roll Unarmed Strike attack" }));
      fireEvent.click(screen.getByRole("button", { name: "Roll Unarmed Strike damage" }));

      await waitFor(() => expect(posts).toHaveLength(2));
      expect(posts.map((post) => [post.label, post.notation, post.type, post.origin])).toEqual([
        ["Unarmed Strike attack", "1d20+5", "attack", "Unarmed Strike"],
        ["Unarmed Strike damage", "1d1", "damage", "Unarmed Strike"],
      ]);
    });

    it("rolls the off-hand attack and damage, each labelled and from its origin", async () => {
      const offHandAttack: CharacterDerived["offHandAttack"] = {
        ...attack(1, 2),
        damage: {
          dice: "1d4",
          type: "piercing",
          modifier: { computed: 0, manual: null, terms: [] },
        },
      };
      const { posts } = renderRolling({
        ...derivedRecord(),
        attacks: [attack(0, 5), attack(1, 2)],
        offHandAttack,
      });
      fireEvent.click(await screen.findByRole("button", { name: "Roll Dagger (off-hand) attack" }));
      fireEvent.click(screen.getByRole("button", { name: "Roll Dagger (off-hand) damage" }));

      await waitFor(() => expect(posts).toHaveLength(2));
      expect(posts.map((post) => [post.label, post.type, post.origin])).toEqual([
        ["Dagger (off-hand) attack", "attack", "Dagger (off-hand)"],
        ["Dagger (off-hand) damage", "damage", "Dagger (off-hand)"],
      ]);
    });

    it("rolls a die the player names with the attack, as its own signed term", async () => {
      const { posts } = renderRolling({ ...derivedRecord(), attacks: [attack(0, 5)] });
      fireEvent.change(await screen.findByRole("textbox", { name: "Longsword attack extra die" }), {
        target: { value: "+1d4" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Roll Longsword attack" }));

      await waitFor(() => expect(posts).toHaveLength(1));
      const [post] = posts as { notation: string; dice: { faces: number; sign: number }[] }[];
      expect(post?.notation).toBe("1d20+1d4+5");
      expect(post?.dice.map(({ faces, sign }) => [faces, sign])).toEqual([
        [20, 1],
        [4, 1],
      ]);
    });

    it("calls out a natural 20 and doubles the damage dice, not the modifier, once", async () => {
      vi.spyOn(Math, "random").mockReturnValue(0.99);
      const { posts } = renderRolling({ ...derivedRecord(), attacks: [attack(0, 5)] });
      const mark = await longsword().findByRole("checkbox", { name: "Critical hit" });
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

    it("adds an item's extra damage to the damage roll for the target alignment chosen", async () => {
      const holy = {
        ...attack(0, 5),
        extraDamage: [
          { source: "Holy Avenger", dice: "1d6", type: "radiant", targetAlignment: "CE" },
        ],
      };
      const { posts } = renderRolling({ ...derivedRecord(), attacks: [holy] });
      const roll = await screen.findByRole("button", { name: "Roll Longsword damage" });
      fireEvent.click(roll);
      await waitFor(() => expect(posts).toHaveLength(1));
      expect(posts[0]).toMatchObject({ notation: "1d8-1" });

      fireEvent.change(longsword().getByRole("combobox", { name: "Target alignment" }), {
        target: { value: "CE" },
      });
      expect(
        longsword().getByRole("option", { name: "Chaotic Evil (+1d6 radiant)" }),
      ).toBeVisible();
      fireEvent.click(
        await screen.findByRole("button", { name: "Roll Longsword damage and 1d6 radiant" }),
      );
      await waitFor(() => expect(posts).toHaveLength(2));
      expect(posts[1]).toMatchObject({ notation: "1d8+1d6-1" });
      expect(posts[1]?.dice).toHaveLength(2);

      fireEvent.click(longsword().getByRole("checkbox", { name: "Critical hit" }));
      fireEvent.click(
        await screen.findByRole("button", { name: "Roll Longsword damage and 1d6 radiant" }),
      );
      await waitFor(() => expect(posts).toHaveLength(3));
      expect(posts[2]).toMatchObject({ critical: true, notation: "1d8+1d6-1" });
      expect(posts[2]?.dice).toHaveLength(4);
    });

    it("offers no target alignment where no item deals extra damage", async () => {
      renderRolling({ ...derivedRecord(), attacks: [attack(0, 5)] });
      await longsword().findByRole("checkbox", { name: "Critical hit" });
      expect(longsword().queryByRole("combobox", { name: "Target alignment" })).toBeNull();
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
        expect(longsword().getByRole("checkbox", { name: "Critical hit" })).toBeChecked(),
      );
    });

    it("calls out a roll at the threshold a trade taken lowers, and adds no term for it", async () => {
      const curse = {
        source: "Hexblade's Curse",
        attack: 0,
        damage: 0,
        critical: 19,
        dice: null,
        afterRoll: false,
        condition: "against your cursed target",
      };
      vi.spyOn(Math, "random").mockReturnValue(0.9);
      const { posts } = renderRolling({
        ...derivedRecord(),
        attacks: [{ ...attack(0, 5), options: [curse] }],
      });
      const mark = await longsword().findByRole("checkbox", { name: "Critical hit" });
      fireEvent.click(screen.getByRole("button", { name: "Roll Longsword attack" }));
      await waitFor(() => expect(posts).toHaveLength(1));
      expect(mark).not.toBeChecked();

      fireEvent.click(
        longsword().getByRole("checkbox", {
          name: "Hexblade's Curse crit 19–20, against your cursed target",
        }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Roll Longsword attack" }));
      await waitFor(() => expect(mark).toBeChecked());
      expect(posts[1]).toMatchObject({ terms: [{ source: "Strength", value: 5 }] });
    });

    it("takes one size of a feature's trade at a time", async () => {
      const blade = (bonus: number) => ({
        source: "Sharpen the Blade",
        attack: bonus,
        damage: bonus,
        critical: null,
        dice: null,
        afterRoll: false,
        condition: `${bonus} ki`,
      });
      const { posts } = renderRolling({
        ...derivedRecord(),
        attacks: [{ ...attack(0, 5), options: [blade(1), blade(2), blade(3)] }],
      });
      const two = await longsword().findByRole("checkbox", {
        name: "Sharpen the Blade +2/+2, 2 ki",
      });
      const three = longsword().getByRole("checkbox", { name: "Sharpen the Blade +3/+3, 3 ki" });
      fireEvent.click(three);
      fireEvent.click(two);
      expect(two).toBeChecked();
      expect(three).not.toBeChecked();
      expect(
        longsword().getByRole("checkbox", { name: "Sharpen the Blade +1/+1, 1 ki" }),
      ).not.toBeChecked();
      fireEvent.click(screen.getByRole("button", { name: "Roll Longsword attack" }));
      await waitFor(() => expect(posts).toHaveLength(1));
      expect(posts[0]).toMatchObject({
        terms: [
          { source: "Strength", value: 5 },
          { source: "Sharpen the Blade", value: 2 },
        ],
      });
    });

    it("rolls a die a feature adds with the d20 when taken, and untakes a once-a-turn die once the attack is logged", async () => {
      const bolster = {
        source: "Emboldening Bond",
        attack: 0,
        damage: 0,
        critical: null,
        dice: "1d3",
        afterRoll: false,
        oncePerTurn: true,
        condition: "once a turn while a bonded creature is within 30 feet",
      };
      const { posts } = renderRolling({
        ...derivedRecord(),
        attacks: [{ ...attack(0, 5), options: [bolster] }],
      });
      const taken = await longsword().findByRole("checkbox", {
        name: "Emboldening Bond +1d3, once a turn while a bonded creature is within 30 feet",
      });
      fireEvent.click(taken);
      fireEvent.click(
        screen.getByRole("button", { name: "Roll Longsword attack with Emboldening Bond" }),
      );
      await waitFor(() => expect(posts).toHaveLength(1));
      expect(posts[0]?.notation).toMatch(/^1d20\+1d3\+5$/);
      await waitFor(() => expect(taken).not.toBeChecked());
    });

    it("keeps a die ticked for as long as its feature lasts", async () => {
      const bolster = {
        source: "Bolstering Magic",
        attack: 0,
        damage: 0,
        critical: null,
        dice: "1d3",
        afterRoll: false,
        condition: "for the 10 minutes Bolstering Magic lasts on you",
      };
      const { posts } = renderRolling({
        ...derivedRecord(),
        attacks: [{ ...attack(0, 5), options: [bolster] }],
      });
      const taken = await longsword().findByRole("checkbox", {
        name: "Bolstering Magic +1d3, for the 10 minutes Bolstering Magic lasts on you",
      });
      fireEvent.click(taken);
      const roll = screen.getByRole("button", {
        name: "Roll Longsword attack with Bolstering Magic",
      });
      fireEvent.click(roll);
      await waitFor(() => expect(posts).toHaveLength(1));
      fireEvent.click(roll);
      await waitFor(() => expect(posts).toHaveLength(2));
      expect(posts[1]?.notation).toMatch(/^1d20\+1d3\+5$/);
      expect(taken).toBeChecked();
    });

    it("adds a bonus or die to the attack that landed, logging the new total once per feature", async () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      const after = (source: string, attack: number, dice: string | null) => ({
        source,
        attack,
        damage: 0,
        critical: null,
        dice,
        afterRoll: true,
        condition: "after a miss",
      });
      const { posts } = renderRolling({
        ...derivedRecord(),
        attacks: [
          {
            ...attack(0, 5),
            options: [after("Guided Strike", 10, null), after("Favored by the Gods", 0, "2d4")],
          },
        ],
      });
      expect(screen.queryByRole("button", { name: /^Add Guided Strike/ })).toBeNull();
      await longsword().findByRole("button", { name: "Roll Longsword attack" });
      fireEvent.click(screen.getByRole("button", { name: "Roll Longsword attack" }));
      await waitFor(() => expect(posts).toHaveLength(1));
      const roll = posts[0] as { total: number };
      fireEvent.click(await longsword().findByRole("button", { name: /^Add Guided Strike/ }));
      await waitFor(() => expect(posts).toHaveLength(2));
      expect(posts[1]).toMatchObject({
        type: "attack",
        label: "Longsword attack with Guided Strike",
        total: roll.total + 10,
        modifier: 15,
      });
      await waitFor(() =>
        expect(screen.queryByRole("button", { name: /^Add Guided Strike/ })).toBeNull(),
      );
      fireEvent.click(longsword().getByRole("button", { name: /^Add Favored by the Gods/ }));
      await waitFor(() => expect(posts).toHaveLength(3));
      expect(posts[2]).toMatchObject({
        label: "Longsword attack with Guided Strike and Favored by the Gods",
        total: roll.total + 10 + 2,
      });
    });

    it("logs an after-roll bonus once however often its button is clicked", async () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      const { posts } = renderRolling({
        ...derivedRecord(),
        attacks: [
          {
            ...attack(0, 5),
            options: [
              {
                source: "Guided Strike",
                attack: 10,
                damage: 0,
                critical: null,
                dice: null,
                afterRoll: true,
                condition: "after a miss",
              },
            ],
          },
        ],
      });
      fireEvent.click(await screen.findByRole("button", { name: "Roll Longsword attack" }));
      await waitFor(() => expect(posts).toHaveLength(1));
      const add = await longsword().findByRole("button", { name: /^Add Guided Strike/ });
      fireEvent.click(add);
      fireEvent.click(add);
      await waitFor(() => expect(posts).toHaveLength(2));
      await waitFor(() =>
        expect(screen.queryByRole("button", { name: /^Add Guided Strike/ })).toBeNull(),
      );
      expect(posts).toHaveLength(2);
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
      expect(longsword().getByRole("checkbox", { name: "Critical hit" })).not.toBeChecked();
    });

    it("calls out a spell attack's natural 20 and clears it on the next roll", async () => {
      const random = vi.spyOn(Math, "random").mockReturnValue(0.99);
      const { posts } = renderRolling({ ...derivedRecord(), attacks: [] });
      const roll = await screen.findByRole("button", { name: "Roll Warlock spell attack" });
      fireEvent.click(roll);
      expect(await screen.findByText("Critical hit", { selector: "p" })).toBeVisible();

      random.mockReturnValue(0.5);
      fireEvent.click(roll);
      await waitFor(() => expect(posts).toHaveLength(2));
      await waitFor(() => expect(screen.queryByText("Critical hit", { selector: "p" })).toBeNull());
    });

    it("does not call out a roll below the threshold", async () => {
      vi.spyOn(Math, "random").mockReturnValue(0.9);
      const { posts } = renderRolling({ ...derivedRecord(), attacks: [attack(0, 5)] });
      fireEvent.click(await screen.findByRole("button", { name: "Roll Longsword attack" }));
      await waitFor(() => expect(posts).toHaveLength(1));
      expect(longsword().getByRole("checkbox", { name: "Critical hit" })).not.toBeChecked();
    });

    it("doubles the damage dice of a roll marked critical by hand", async () => {
      const { posts } = renderRolling({ ...derivedRecord(), attacks: [attack(0, 5)] });
      fireEvent.click(await longsword().findByRole("checkbox", { name: "Critical hit" }));
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
      fireEvent.click(await longsword().findByRole("checkbox", { name: "Critical hit" }));
      fireEvent.click(screen.getByRole("button", { name: "Roll Longsword damage" }));

      await waitFor(() => expect(posts).toHaveLength(1));
      expect(posts[0]).toMatchObject({ critical: true, total: 8, modifier: -1 });
      expect(posts[0]).toMatchObject({ dice: [{ value: 8 }, { value: 1 }] });
    });

    describe("flanking", () => {
      it("offers none as printed", async () => {
        renderRolling({ ...derivedRecord(), attacks: [attack(0, 5)] });
        await screen.findByRole("button", { name: "Roll Longsword attack" });
        expect(longsword().queryByRole("checkbox", { name: "Flanking" })).toBeNull();
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
        expect(longsword().queryByRole("checkbox", { name: "Flanking" })).toBeNull();
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
        expect(longsword().queryByRole("checkbox", { name: "Flanking" })).toBeNull();
      });

      it("gives advantage that nets against a condition's disadvantage", async () => {
        renderRolling({ ...derivedRecord(), attacks: [attack(0, 5)] }, 201, [], {
          flanking: "advantage",
        });
        const mode = await screen.findByRole("combobox", { name: "Longsword attack mode" });
        fireEvent.click(longsword().getByRole("checkbox", { name: "Flanking" }));
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
        fireEvent.click(longsword().getByRole("checkbox", { name: "Flanking" }));
        expect(mode).toHaveValue("normal");
      });

      it("offers flanking on the unarmed strike's attack roll", async () => {
        renderRolling({ ...derivedRecord(), attacks: [], unarmedStrike }, 201, [], {
          flanking: "advantage",
        });
        const mode = await screen.findByRole("combobox", { name: "Unarmed Strike attack mode" });
        fireEvent.click(screen.getByRole("checkbox", { name: "Flanking" }));
        expect(mode).toHaveValue("advantage");
      });

      it("adds 2 and names it in the logged roll", async () => {
        vi.spyOn(Math, "random").mockReturnValue(0);
        const { posts } = renderRolling({ ...derivedRecord(), attacks: [attack(0, 5)] }, 201, [], {
          flanking: "bonus",
        });
        fireEvent.click(await longsword().findByRole("checkbox", { name: "Flanking" }));
        fireEvent.click(
          screen.getByRole("button", { name: "Roll Longsword attack while flanking +2" }),
        );

        await waitFor(() => expect(posts).toHaveLength(1));
        expect(posts[0]).toMatchObject({
          label: "Longsword attack while flanking +2",
          notation: "1d20+7",
          modifier: 7,
          terms: [
            { source: "Strength", value: 5 },
            { source: "Flanking", value: 2 },
          ],
          total: 8,
        });
        expect(await screen.findByText("Longsword attack while flanking +2: 8")).toHaveAttribute(
          "role",
          "status",
        );
      });
    });

    it("applies a feature's trade a player takes to the attack and its damage, until the damage is logged", async () => {
      const sharpshooter = {
        source: "Sharpshooter",
        attack: -5,
        damage: 10,
        critical: null,
        dice: null,
        afterRoll: false,
        condition: "before the attack",
      };
      const { posts } = renderRolling({
        ...derivedRecord(),
        attacks: [{ ...attack(0, 5), options: [sharpshooter] }],
      });
      const trade = await longsword().findByRole("checkbox", {
        name: "Sharpshooter -5/+10, before the attack",
      });
      expect(longsword().getByText("Sharpshooter -5/+10")).toBeInTheDocument();
      fireEvent.click(trade);
      fireEvent.click(screen.getByRole("button", { name: "Roll Longsword attack" }));
      await waitFor(() => expect(posts).toHaveLength(1));
      expect(posts[0]).toMatchObject({
        notation: "1d20",
        terms: [
          { source: "Strength", value: 5 },
          { source: "Sharpshooter", value: -5 },
        ],
      });
      expect(trade).toBeChecked();
      fireEvent.click(
        screen.getByRole("button", { name: "Roll Longsword damage with Sharpshooter" }),
      );

      await waitFor(() => expect(posts).toHaveLength(2));
      expect(posts[1]).toMatchObject({ notation: "1d8+9", modifier: 9 });
      await waitFor(() => expect(trade).not.toBeChecked());
    });

    const sneakAttack = {
      source: "Sneak Attack",
      dice: "3d6",
      bonus: 0,
      type: null,
      offer: { condition: "with advantage", oncePerTurn: true, slot: null },
    };

    it("adds a feature's damage the player takes to the damage roll, until it is logged", async () => {
      const { posts, puts } = renderRolling({
        ...derivedRecord(),
        attacks: [{ ...attack(0, 5), featureDamage: [sneakAttack] }],
      });
      const offer = await longsword().findByRole("checkbox", {
        name: "Sneak Attack +3d6, with advantage",
      });
      fireEvent.click(offer);
      fireEvent.click(
        screen.getByRole("button", { name: "Roll Longsword damage with Sneak Attack" }),
      );

      await waitFor(() => expect(posts).toHaveLength(1));
      expect(posts[0]).toMatchObject({ notation: "1d8+3d6-1" });
      expect(puts).toEqual([]);
      await waitFor(() => expect(offer).not.toBeChecked());
    });

    it("offers a once-a-turn feature once a turn while an encounter runs", async () => {
      const { posts, puts } = renderRolling(
        { ...derivedRecord(), attacks: [{ ...attack(0, 5), featureDamage: [sneakAttack] }] },
        201,
        [],
        {},
        { encounter: { round: 1, initiative: null } },
      );
      fireEvent.click(await longsword().findByRole("checkbox", { name: /^Sneak Attack/ }));
      fireEvent.click(
        screen.getByRole("button", { name: "Roll Longsword damage with Sneak Attack" }),
      );
      await waitFor(() => expect(posts).toHaveLength(1));
      expect(puts[0]?.turn.features).toEqual(["Sneak Attack"]);
    });

    it("notes a once-a-turn feature used this turn in place of offering it", async () => {
      renderRolling(
        { ...derivedRecord(), attacks: [{ ...attack(0, 5), featureDamage: [sneakAttack] }] },
        201,
        [],
        {},
        {
          encounter: { round: 1, initiative: null },
          turn: { ...stateRecord().state.turn, features: ["Sneak Attack"] },
        },
      );
      expect(await longsword().findByText("Sneak Attack used this turn")).toBeInTheDocument();
      expect(longsword().queryByRole("checkbox", { name: /^Sneak Attack/ })).toBeNull();
    });

    it("adds damage that always lands to the roll and the cell", async () => {
      const smite = {
        source: "Improved Divine Smite",
        dice: "1d8",
        bonus: 0,
        type: "radiant",
        offer: null,
      };
      const { posts } = renderRolling({
        ...derivedRecord(),
        attacks: [{ ...attack(0, 5), featureDamage: [smite] }],
      });
      expect(await longsword().findByText("+1d8 radiant Improved Divine Smite")).toBeVisible();
      fireEvent.click(screen.getByRole("button", { name: "Roll Longsword damage" }));
      await waitFor(() => expect(posts).toHaveLength(1));
      expect(posts[0]).toMatchObject({ notation: "1d8+1d8-1" });
    });

    it("spends the slot Divine Smite takes and scales its dice by the slot's level", async () => {
      const smite = {
        source: "Divine Smite",
        dice: "2d8",
        bonus: 0,
        type: "radiant",
        offer: {
          condition: "on a melee weapon hit",
          oncePerTurn: false,
          slot: { max: 5, versus: "an undead or a fiend" },
        },
      };
      const { posts, puts } = renderRolling({
        ...derivedRecord(),
        spellSlots: [
          { level: 1, total: { computed: 4, manual: null, terms: [] } },
          { level: 3, total: { computed: 2, manual: null, terms: [] } },
        ],
        attacks: [{ ...attack(0, 5), featureDamage: [smite] }],
      });
      fireEvent.click(await longsword().findByRole("checkbox", { name: /^Divine Smite/ }));
      fireEvent.change(longsword().getByRole("combobox", { name: "Divine Smite slot" }), {
        target: { value: "slot:3" },
      });
      fireEvent.click(longsword().getByRole("checkbox", { name: "Against an undead or a fiend" }));
      fireEvent.click(
        screen.getByRole("button", { name: "Roll Longsword damage with Divine Smite" }),
      );

      await waitFor(() => expect(posts).toHaveLength(1));
      expect(posts[0]).toMatchObject({ notation: "1d8+5d8-1" });
      expect(puts[0]?.spellSlots).toContainEqual({ level: 3, total: 2, expended: 1 });
    });

    it("spends a pact slot alone on Eldritch Smite, asking nothing about the target", async () => {
      const smite = {
        source: "Eldritch Smite",
        dice: "2d8",
        bonus: 0,
        type: "force",
        offer: {
          condition: "with your pact weapon",
          oncePerTurn: true,
          slot: { max: 6, pact: true as const },
        },
      };
      const { posts, puts } = renderRolling({
        ...derivedRecord(),
        spellSlots: [{ level: 1, total: { computed: 4, manual: null, terms: [] } }],
        pactSlots: { level: 3, total: { computed: 2, manual: null, terms: [] } },
        attacks: [{ ...attack(0, 5), featureDamage: [smite] }],
      });
      fireEvent.click(await longsword().findByRole("checkbox", { name: /^Eldritch Smite \+4d8/ }));
      const slot = longsword().getByRole("combobox", { name: "Eldritch Smite slot" });
      expect(
        within(slot)
          .getAllByRole("option")
          .map((option) => option.textContent),
      ).toEqual(["Level 3 pact (2 left)"]);
      expect(longsword().queryByRole("checkbox", { name: /^Against/ })).toBeNull();
      fireEvent.click(
        screen.getByRole("button", { name: "Roll Longsword damage with Eldritch Smite" }),
      );

      await waitFor(() => expect(posts).toHaveLength(1));
      expect(posts[0]).toMatchObject({ notation: "1d8+4d8-1" });
      expect(puts[0]?.pactSlots).toEqual({ level: 3, total: 2, expended: 1 });
    });

    it("names the pact slot Eldritch Smite lacks while spell slots remain", async () => {
      const smite = {
        source: "Eldritch Smite",
        dice: "2d8",
        bonus: 0,
        type: "force",
        offer: {
          condition: "with your pact weapon",
          oncePerTurn: true,
          slot: { max: 6, pact: true as const },
        },
      };
      renderRolling({
        ...derivedRecord(),
        spellSlots: [{ level: 1, total: { computed: 4, manual: null, terms: [] } }],
        pactSlots: null,
        attacks: [{ ...attack(0, 5), featureDamage: [smite] }],
      });
      expect(await longsword().findByText("No pact slot left")).toBeInTheDocument();
      expect(longsword().getByRole("checkbox", { name: /^Eldritch Smite/ })).toBeDisabled();
    });

    it("applies each slot-spending feature taken on one hit, spending a slot for each", async () => {
      const slotOffer = (source: string, pact?: true) => ({
        source,
        dice: "2d8",
        bonus: 0,
        type: null,
        offer: {
          condition: "on a hit",
          oncePerTurn: false,
          slot: { max: 5, ...(pact && { pact }) },
        },
      });
      const { posts, puts } = renderRolling({
        ...derivedRecord(),
        spellSlots: [{ level: 1, total: { computed: 4, manual: null, terms: [] } }],
        pactSlots: { level: 3, total: { computed: 2, manual: null, terms: [] } },
        attacks: [
          {
            ...attack(0, 5),
            featureDamage: [slotOffer("Divine Smite"), slotOffer("Eldritch Smite", true)],
          },
        ],
      });
      fireEvent.click(await longsword().findByRole("checkbox", { name: /^Divine Smite/ }));
      fireEvent.click(longsword().getByRole("checkbox", { name: /^Eldritch Smite/ }));
      expect(longsword().getByRole("checkbox", { name: /^Divine Smite/ })).toBeChecked();
      expect(longsword().getByRole("checkbox", { name: /^Eldritch Smite/ })).toBeChecked();
      fireEvent.click(
        screen.getByRole("button", {
          name: "Roll Longsword damage with Divine Smite with Eldritch Smite",
        }),
      );

      await waitFor(() => expect(posts).toHaveLength(1));
      expect(posts[0]).toMatchObject({ notation: "1d8+2d8+4d8-1" });
      expect(puts[0]?.spellSlots).toContainEqual({ level: 1, total: 4, expended: 1 });
      expect(puts[0]?.pactSlots).toEqual({ level: 3, total: 2, expended: 1 });
    });

    it("refuses the roll's slots and spends none when a second smite finds its slot gone", async () => {
      const smite = (source: string) => ({
        source,
        dice: "2d8",
        bonus: 0,
        type: "radiant",
        offer: { condition: "on a hit", oncePerTurn: false, slot: { max: 5 } },
      });
      const { posts, puts } = renderRolling({
        ...derivedRecord(),
        spellSlots: [{ level: 1, total: { computed: 1, manual: null, terms: [] } }],
        pactSlots: null,
        attacks: [{ ...attack(0, 5), featureDamage: [smite("Divine Smite"), smite("Holy Smite")] }],
      });
      fireEvent.click(await longsword().findByRole("checkbox", { name: /^Divine Smite/ }));
      fireEvent.click(longsword().getByRole("checkbox", { name: /^Holy Smite/ }));
      fireEvent.click(
        screen.getByRole("button", {
          name: "Roll Longsword damage with Divine Smite with Holy Smite",
        }),
      );

      expect(await screen.findAllByText(/Holy Smite was not used/)).not.toHaveLength(0);
      expect(puts).toHaveLength(0);
      expect(posts).toHaveLength(0);
    });

    it("shows and adds a feature's dice with the flat amount it adds to them", async () => {
      const harm = {
        source: "Hand of Harm",
        dice: "1d6",
        bonus: 2,
        type: "necrotic",
        offer: { condition: "spending 1 ki point", oncePerTurn: true, slot: null },
      };
      const { posts } = renderRolling({
        ...derivedRecord(),
        attacks: [{ ...attack(0, 5), featureDamage: [harm] }],
      });
      fireEvent.click(
        await longsword().findByRole("checkbox", {
          name: "Hand of Harm +1d6+2 necrotic, spending 1 ki point",
        }),
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Roll Longsword damage with Hand of Harm" }),
      );
      await waitFor(() => expect(posts).toHaveLength(1));
      expect(posts[0]).toMatchObject({ notation: "1d8+1d6+1" });
    });

    it("drops a smite taken on a row once no slot is left, and still rolls the row's damage", async () => {
      const smite = {
        source: "Divine Smite",
        dice: "2d8",
        bonus: 0,
        type: "radiant",
        offer: {
          condition: "on a melee weapon hit",
          oncePerTurn: false,
          slot: { max: 5, versus: "an undead or a fiend" },
        },
      };
      const { posts, puts } = renderRolling({
        ...derivedRecord(),
        spellSlots: [{ level: 1, total: { computed: 1, manual: null, terms: [] } }],
        pactSlots: null,
        attacks: [{ ...attack(0, 5), featureDamage: [smite] }],
        unarmedStrike: { ...unarmedStrike, featureDamage: [smite] },
      });
      const served = globalThis.fetch;
      vi.stubGlobal("fetch", async (url: RequestInfo | URL, init?: RequestInit) => {
        const response = await served(url, init);
        return init?.method === "PUT"
          ? Response.json({ ...stateRecord(), state: puts.at(-1) })
          : response;
      });
      const unarmed = () =>
        within(
          screen.getByRole("rowheader", { name: /^Unarmed Strike/ }).closest("tr") as HTMLElement,
        );
      fireEvent.click(await longsword().findByRole("checkbox", { name: /^Divine Smite/ }));
      fireEvent.click(unarmed().getByRole("checkbox", { name: /^Divine Smite/ }));
      fireEvent.click(
        screen.getByRole("button", { name: "Roll Longsword damage with Divine Smite" }),
      );
      await waitFor(() => expect(puts).toHaveLength(1));

      expect(await unarmed().findByText("No spell slot left")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Roll Unarmed Strike damage" }));
      await waitFor(() => expect(posts).toHaveLength(2));
      expect(posts[1]).toMatchObject({ label: "Unarmed Strike damage", notation: "1d1" });
      expect(puts).toHaveLength(1);
    });

    it("offers no trade on a row with no damage to roll", async () => {
      const trade = {
        source: "Sharpshooter",
        attack: -5,
        damage: 10,
        critical: null,
        dice: null,
        afterRoll: false,
        condition: "before",
      };
      renderRolling({
        ...derivedRecord(),
        attacks: [{ ...attack(0, 5), damage: null, options: [trade] }],
      });
      await screen.findByRole("button", { name: "Roll Longsword attack" });
      expect(screen.queryByRole("checkbox", { name: /Sharpshooter/ })).toBeNull();
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
      expect(longsword().queryByRole("button", { name: /damage$/ })).toBeNull();
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
