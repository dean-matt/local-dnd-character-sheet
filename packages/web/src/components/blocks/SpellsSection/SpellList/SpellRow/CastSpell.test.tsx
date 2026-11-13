import type { SheetSpell } from "@dnd/catalog";
import type { CharacterDerived, CharacterState, RollRecord } from "@dnd/character";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterKey } from "../../../../../hooks/characterKeys.ts";
import { characterRecord, derivedRecord, stateRecord } from "../../../../../test/records.ts";
import { CastSpell } from "./CastSpell.tsx";

const computed = (value: number) => ({ computed: value, manual: null, terms: [] });

const derived: CharacterDerived = {
  ...derivedRecord(),
  spellSlots: [
    { level: 1, total: computed(4) },
    { level: 2, total: computed(2) },
    { level: 3, total: computed(1) },
  ],
  pactSlots: null,
};

type Resolved = Extract<SheetSpell, { resolved: true }>;

const spell = (name: string, level: number, more: Partial<Resolved> = {}): Resolved => ({
  resolved: true,
  name,
  source: "XPHB",
  prepared: true,
  level,
  school: "V",
  concentration: false,
  ritual: false,
  entries: [],
  ...more,
});

let posted: RollRecord[] = [];
let refuseRolls = false;
let bothWrites: { definition: { inventory: { quantity: number }[] }; state: CharacterState }[] = [];

const HEX = { name: "Hex", source: "XPHB" };

function answerRoll(init: RequestInit) {
  if (refuseRolls) return new Response("{}", { status: 500 });
  const roll = JSON.parse(String(init.body)) as RollRecord;
  posted.push(roll);
  return Response.json(
    {
      ...roll,
      id: posted.length,
      characterId: "1",
      characterName: "Ada",
      rolledAt: "2026-01-01T00:00:00.000Z",
    },
    { status: 201 },
  );
}

const inventoryAnswer = (held: { name: string; quantity: number }[]) =>
  Response.json({
    items: held.map(({ name, quantity }) => ({
      resolved: false,
      name,
      source: "XPHB",
      quantity,
      carried: true,
      equipped: false,
      attuned: false,
    })),
  });

/**
 * Renders the button over a stand-in API that keeps each state write and answers reads with it.
 * `refuse`, where given, answers each write in its place and keeps nothing.
 */
function renderCast(
  cast: Resolved,
  state: Partial<CharacterState> = {},
  sheet: CharacterDerived = derived,
  refuse?: () => Promise<Response>,
  waiveComponents = false,
  held: { name: string; quantity: number }[] = [],
) {
  const inventory = held.map(({ name, quantity }) => ({
    ref: { name, source: "XPHB" },
    quantity,
    carried: true,
    equipped: false,
    attuned: false,
  }));
  const base = characterRecord("1", "Ada");
  const character = { ...base, definition: { ...base.definition, inventory } };
  let stored = { ...stateRecord(), state: { ...stateRecord().state, ...state } };
  const writes: CharacterState[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") return answerRoll(init);
      const url = String(_input);
      if (url.endsWith("/inventory")) return inventoryAnswer(held);
      if (init?.method === "PUT" && url.endsWith("/definition-and-state")) {
        if (refuse) return refuse();
        const body = JSON.parse(String(init.body));
        bothWrites.push(body);
        writes.push(body.state);
        stored = { ...stored, state: body.state };
        return Response.json({
          character: { ...character, definition: body.definition },
          state: stored,
        });
      }
      if (init?.method === "PUT") {
        if (refuse) return refuse();
        const written = JSON.parse(String(init.body));
        writes.push(written);
        stored = { ...stored, state: written };
      }
      return new Response(JSON.stringify(stored), { status: 200 });
    }),
  );
  const client = new QueryClient();
  client.setQueryData(characterKey("1"), character);
  render(
    <CastSpell
      characterId="1"
      derived={sheet}
      characterLevel={5}
      waiveComponents={waiveComponents}
      spell={cast}
    />,
    {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    },
  );
  return writes;
}

async function openDialog(name: string) {
  const button = screen.getByRole("button", { name: `Cast ${name}` });
  await waitFor(() => expect(button).not.toHaveAttribute("aria-disabled"));
  fireEvent.click(button);
  return within(screen.getByRole("dialog"));
}

const castButton = (dialog: ReturnType<typeof within>) =>
  dialog.getByRole("button", { name: "Cast" });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  posted = [];
  refuseRolls = false;
  bothWrites = [];
});

describe("CastSpell", () => {
  it("names a consumed, costly component and its cost before the cast", async () => {
    renderCast(
      spell("Revivify", 3, {
        components: {
          v: true,
          s: true,
          m: {
            text: "a diamond worth 300+ GP, which the spell consumes",
            cost: 30000,
            consume: true,
          },
        },
      }),
    );
    const dialog = await openDialog("Revivify");

    expect(
      dialog.getByText("Consumes a diamond worth 300+ GP, which the spell consumes (300 gp)."),
    ).toBeInTheDocument();
  });

  it("names no consumed component where the house rule waives material components", async () => {
    renderCast(
      spell("Revivify", 3, {
        components: {
          v: true,
          s: true,
          m: { text: "a diamond worth 300+ GP", cost: 30000, consume: true },
        },
      }),
      {},
      derived,
      undefined,
      true,
    );
    const dialog = await openDialog("Revivify");

    expect(dialog.queryByText(/Consumes/)).toBeNull();
  });

  describe("a consumed, costly component", () => {
    const revivify = spell("Revivify", 3, {
      components: {
        v: true,
        s: true,
        m: { text: "a diamond worth 300+ GP", cost: 30000, consume: true },
      },
    });
    const diamond = { name: "Diamond", quantity: 2 };

    async function pick(held: { name: string; quantity: number }[], choice: string) {
      const writes = renderCast(revivify, {}, derived, undefined, false, held);
      const dialog = await openDialog("Revivify");
      await waitFor(() => expect(dialog.getAllByRole("option").length).toBeGreaterThan(2));
      if (choice) {
        fireEvent.change(dialog.getByLabelText("Spend from the inventory"), {
          target: { value: choice },
        });
      }
      return { writes, dialog };
    }

    it("refuses the cast until the player picks an entry or casts without one", async () => {
      const { dialog } = await pick([diamond], "");

      expect(castButton(dialog)).toHaveAttribute("aria-disabled", "true");
    });

    it("spends one from the entry in the same write as the cast, announced", async () => {
      const { writes, dialog } = await pick([diamond], "0");
      fireEvent.click(castButton(dialog));

      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent(
          "Cast Revivify with a level 3 slot, 0 left; spent one Diamond",
        ),
      );
      expect(bothWrites).toHaveLength(1);
      expect(bothWrites[0]?.definition.inventory.map((entry) => entry.quantity)).toEqual([1]);
      expect(writes[0]?.spellSlots).toEqual([{ level: 3, total: 1, expended: 1 }]);
    });

    it("removes an entry at quantity 1", async () => {
      const { dialog } = await pick([{ name: "Diamond", quantity: 1 }], "0");
      fireEvent.click(castButton(dialog));

      await waitFor(() => expect(bothWrites).toHaveLength(1));
      expect(bothWrites[0]?.definition.inventory).toEqual([]);
    });

    it("casts without spending one, as a state write alone", async () => {
      const { writes, dialog } = await pick([diamond], "none");
      fireEvent.click(castButton(dialog));

      await waitFor(() => expect(writes).toHaveLength(1));
      expect(bothWrites).toEqual([]);
    });

    it("keeps the dialog open and the inventory as it was on a failed write", async () => {
      renderCast(
        revivify,
        {},
        derived,
        async () => Response.json({ error: "disk full" }, { status: 500 }),
        false,
        [diamond],
      );
      const dialog = await openDialog("Revivify");
      await waitFor(() => expect(dialog.getAllByRole("option").length).toBeGreaterThan(2));
      fireEvent.change(dialog.getByLabelText("Spend from the inventory"), {
        target: { value: "0" },
      });
      fireEvent.click(castButton(dialog));

      expect(await dialog.findByRole("alert")).toHaveTextContent(
        "Revivify was not cast: disk full",
      );
      expect(bothWrites).toEqual([]);
    });

    it("offers no entry to spend where the house rule waives components", async () => {
      renderCast(revivify, {}, derived, undefined, true, [diamond]);
      const dialog = await openDialog("Revivify");

      expect(dialog.queryByLabelText("Spend from the inventory")).toBeNull();
      fireEvent.click(castButton(dialog));
      await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Cast Revivify"));
      expect(bothWrites).toEqual([]);
    });
  });

  it("names no component for a spell that consumes none", async () => {
    renderCast(spell("Shatter", 2, { components: { v: true, m: "a chip of mica" } }));
    const dialog = await openDialog("Shatter");

    expect(dialog.queryByText(/Consumes/)).toBeNull();
  });

  it("offers each slot level from the spell's own up, refusing one with none left", async () => {
    renderCast(spell("Shatter", 2), { spellSlots: [{ level: 2, total: 2, expended: 2 }] });
    const dialog = await openDialog("Shatter");

    const radios = dialog.getAllByRole("radio");
    expect(radios.map((radio) => radio.parentElement?.textContent)).toEqual([
      "Level 2 slot, none left",
      "Level 3 slot, 1 left",
    ]);
    expect(radios[0]).toBeDisabled();
    expect(radios[1]).toBeChecked();
  });

  it("spends the chosen slot in one write, announced, and hands focus back", async () => {
    const writes = renderCast(spell("Magic Missile", 1));
    const dialog = await openDialog("Magic Missile");
    fireEvent.click(dialog.getByRole("radio", { name: "Level 2 slot, 2 left" }));
    fireEvent.click(castButton(dialog));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Cast Magic Missile with a level 2 slot, 1 left",
      ),
    );
    expect(writes).toHaveLength(1);
    expect(writes[0]?.spellSlots).toEqual([{ level: 2, total: 2, expended: 1 }]);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Cast Magic Missile" })).toHaveFocus();
  });

  it("casts a cantrip with no slot and writes nothing", async () => {
    const writes = renderCast(spell("Fire Bolt", 0));
    const dialog = await openDialog("Fire Bolt");

    expect(dialog.queryAllByRole("radio")).toEqual([]);
    expect(dialog.getByText("A cantrip spends no slot.")).toBeInTheDocument();
    fireEvent.click(castButton(dialog));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Cast Fire Bolt"));
    expect(writes).toEqual([]);
  });

  it("offers a ritual cast beside the slots, which spends no slot", async () => {
    const writes = renderCast(spell("Detect Magic", 1, { ritual: true, concentration: true }));
    const dialog = await openDialog("Detect Magic");
    fireEvent.click(dialog.getByRole("radio", { name: "As a ritual, spending no slot" }));
    fireEvent.click(castButton(dialog));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Cast Detect Magic as a ritual; concentrating on Detect Magic",
      ),
    );
    expect(writes[0]?.spellSlots).toEqual([]);
    expect(writes[0]?.concentration).toEqual({
      spell: { name: "Detect Magic", source: "XPHB" },
      level: 1,
    });
  });

  it("offers the pact slot at its own level for a spell of that level or lower", async () => {
    const writes = renderCast(
      spell("Hellish Rebuke", 1),
      {},
      { ...derived, spellSlots: [], pactSlots: { level: 3, total: computed(2) } },
    );
    const dialog = await openDialog("Hellish Rebuke");
    expect(dialog.getByRole("radio", { name: "Pact slot, level 3, 2 left" })).toBeChecked();
    fireEvent.click(castButton(dialog));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]?.pactSlots).toEqual({ level: 3, total: 2, expended: 1 });
  });

  it("names the concentration it ends, then spends and concentrates in one write", async () => {
    const writes = renderCast(spell("Bless", 1, { concentration: true }), {
      concentration: { spell: HEX, level: 1 },
    });
    const dialog = await openDialog("Bless");
    expect(dialog.getByText("Ends concentration on Hex.")).toBeInTheDocument();
    fireEvent.click(castButton(dialog));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Cast Bless with a level 1 slot, 3 left; concentrating on Bless; Hex ended",
      ),
    );
    expect(writes).toHaveLength(1);
    expect(writes[0]?.spellSlots).toEqual([{ level: 1, total: 4, expended: 1 }]);
    expect(writes[0]?.concentration).toEqual({
      spell: { name: "Bless", source: "XPHB" },
      level: 1,
    });
  });

  it("leaves each part out where it is switched off", async () => {
    const writes = renderCast(spell("Bless", 1, { concentration: true }), {
      spellSlots: [{ level: 1, total: 4, expended: 4 }],
    });
    let dialog = await openDialog("Bless");
    fireEvent.click(dialog.getByRole("checkbox", { name: "Spend the slot" }));
    fireEvent.click(dialog.getByRole("radio", { name: "Level 1 slot, none left" }));
    fireEvent.click(castButton(dialog));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]?.spellSlots).toEqual([{ level: 1, total: 4, expended: 4 }]);
    expect(writes[0]?.concentration).toEqual({
      spell: { name: "Bless", source: "XPHB" },
      level: 1,
    });

    dialog = await openDialog("Bless");
    fireEvent.click(dialog.getByRole("checkbox", { name: "Concentrate" }));
    fireEvent.click(castButton(dialog));
    await waitFor(() => expect(writes).toHaveLength(2));
    expect(writes[1]?.spellSlots).toEqual([
      { level: 1, total: 4, expended: 4 },
      { level: 2, total: 2, expended: 1 },
    ]);
  });

  it("closes on Cancel with nothing written", async () => {
    const writes = renderCast(spell("Shield", 1));
    const dialog = await openDialog("Shield");
    fireEvent.click(dialog.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(writes).toEqual([]);
  });

  it("keeps the dialog open on a failed write, naming the error and announcing nothing", async () => {
    renderCast(spell("Shield", 1), {}, derived, async () =>
      Response.json({ error: "disk full" }, { status: 500 }),
    );
    const dialog = await openDialog("Shield");
    fireEvent.click(castButton(dialog));

    expect(await dialog.findByRole("alert")).toHaveTextContent("Shield was not cast: disk full");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("holds the dialog open on Cancel while the write is in flight", async () => {
    renderCast(spell("Shield", 1), {}, derived, () => new Promise<Response>(() => {}));
    const dialog = await openDialog("Shield");
    fireEvent.click(castButton(dialog));
    const cancel = dialog.getByRole("button", { name: "Cancel" });
    await waitFor(() => expect(cancel).toHaveAttribute("aria-disabled", "true"));
    fireEvent.click(cancel);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("names a spell no slot can cast and refuses the cast", async () => {
    renderCast(spell("Fireball", 4));
    const dialog = await openDialog("Fireball");

    expect(dialog.getByRole("alert")).toHaveTextContent("No spell slot can cast Fireball.");
    expect(dialog.queryAllByRole("radio")).toEqual([]);
    expect(castButton(dialog)).toHaveAttribute("aria-disabled", "true");
  });

  describe("rolling", () => {
    const withCaster: CharacterDerived = {
      ...derived,
      spellcasting: [
        {
          class: { name: "Wizard", source: "XPHB" },
          ability: "int",
          saveDc: computed(14),
          attackBonus: computed(6),
        },
      ],
    };
    const fireBolt = spell("Fire Bolt", 0, {
      attack: true,
      damageDice: "1d10",
      damageTiers: [
        { level: 1, dice: "1d10" },
        { level: 5, dice: "2d10" },
      ],
    });
    const fireball = spell("Fireball", 3, { damageDice: "8d6", damageUpcast: "1d6" });

    it("rolls a cantrip's attack and its damage at the character's level, logging each", async () => {
      vi.spyOn(Math, "random").mockReturnValue(0);
      renderCast(fireBolt, {}, withCaster);
      const dialog = await openDialog("Fire Bolt");
      fireEvent.click(castButton(dialog));

      await waitFor(() => expect(posted).toHaveLength(2));
      expect(posted).toMatchObject([
        {
          type: "spell-attack",
          label: "Fire Bolt attack",
          origin: "Fire Bolt",
          notation: "1d20+6",
        },
        { type: "spell-damage", label: "Fire Bolt damage", origin: "Fire Bolt", notation: "2d10" },
      ]);
      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent("Cast Fire Bolt; attack 7, damage 2"),
      );
    });

    it("rolls a spell's damage at the slot level it is cast at, and no attack where it makes none", async () => {
      renderCast(fireball, {}, withCaster);
      const dialog = await openDialog("Fireball");
      fireEvent.click(dialog.getByRole("radio", { name: "Level 3 slot, 1 left" }));
      fireEvent.click(castButton(dialog));

      await waitFor(() => expect(posted).toHaveLength(1));
      expect(posted[0]).toMatchObject({ type: "spell-damage", notation: "8d6" });
    });

    it("upcasts the damage by each level above the spell's", async () => {
      renderCast(
        fireball,
        { spellSlots: [{ level: 3, total: 1, expended: 1 }] },
        {
          ...withCaster,
          spellSlots: [
            { level: 3, total: computed(1) },
            { level: 5, total: computed(1) },
          ],
        },
      );
      const dialog = await openDialog("Fireball");
      fireEvent.click(dialog.getByRole("radio", { name: "Level 5 slot, 1 left" }));
      fireEvent.click(castButton(dialog));

      await waitFor(() => expect(posted).toHaveLength(1));
      expect(posted[0]).toMatchObject({ notation: "10d6" });
    });

    it("calls out a natural 20 on the attack as a critical hit", async () => {
      vi.spyOn(Math, "random").mockReturnValue(0.99);
      renderCast(fireBolt, {}, withCaster);
      const dialog = await openDialog("Fire Bolt");
      fireEvent.click(castButton(dialog));

      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent(
          "Cast Fire Bolt; attack 26, critical hit, damage 20",
        ),
      );
    });

    const twoCasters: CharacterDerived = {
      ...withCaster,
      spellcasting: [
        ...withCaster.spellcasting,
        {
          class: { name: "Cleric", source: "XPHB" },
          ability: "wis",
          saveDc: computed(8),
          attackBonus: computed(-1),
        },
      ],
    };

    it("rolls with the bonus of the class the spell came from, signed where negative", async () => {
      renderCast({ ...fireBolt, origin: { name: "Cleric", source: "XPHB" } }, {}, twoCasters);
      const dialog = await openDialog("Fire Bolt");
      fireEvent.click(castButton(dialog));

      await waitFor(() => expect(posted).toHaveLength(2));
      expect(posted[0]).toMatchObject({ type: "spell-attack", notation: "1d20-1" });
    });

    it("falls back to the first casting class where the spell names none", async () => {
      renderCast(fireBolt, {}, twoCasters);
      const dialog = await openDialog("Fire Bolt");
      fireEvent.click(castButton(dialog));

      await waitFor(() => expect(posted).toHaveLength(2));
      expect(posted[0]).toMatchObject({ notation: "1d20+6" });
    });

    it("announces a roll that fails to log as not logged", async () => {
      refuseRolls = true;
      vi.spyOn(Math, "random").mockReturnValue(0);
      renderCast(fireBolt, {}, withCaster);
      const dialog = await openDialog("Fire Bolt");
      fireEvent.click(castButton(dialog));

      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent(
          "attack 7, not logged, damage 2, not logged",
        ),
      );
    });

    it("rolls no attack for a character with no spellcasting, damage alone where printed", async () => {
      renderCast(fireBolt, {}, { ...derived, spellcasting: [] });
      const dialog = await openDialog("Fire Bolt");
      fireEvent.click(castButton(dialog));

      await waitFor(() => expect(posted).toHaveLength(1));
      expect(posted[0]).toMatchObject({ type: "spell-damage" });
    });

    it("rolls nothing where the roll is switched off", async () => {
      renderCast(fireBolt, {}, withCaster);
      const dialog = await openDialog("Fire Bolt");
      fireEvent.click(dialog.getByRole("checkbox", { name: "Roll attack and damage" }));
      fireEvent.click(castButton(dialog));

      await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Cast Fire Bolt"));
      expect(screen.getByRole("status")).not.toHaveTextContent("attack");
      expect(posted).toEqual([]);
    });

    it("offers no roll for a spell with neither an attack nor damage", async () => {
      renderCast(spell("Shield", 1), {}, withCaster);
      const dialog = await openDialog("Shield");

      expect(dialog.queryByRole("checkbox", { name: "Roll attack and damage" })).toBeNull();
    });
  });
});
