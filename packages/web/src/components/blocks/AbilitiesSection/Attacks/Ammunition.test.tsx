import {
  type CharacterDefinition,
  type CharacterDerived,
  characterDefinitionSchema,
} from "@dnd/character";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterKey, characterStateKey } from "../../../../hooks/characterKeys.ts";
import { characterRecord, derivedRecord, stateRecord } from "../../../../test/records.ts";
import { OnRolled, RollingFor } from "../../../rollerContext.ts";
import { Attacks } from "./Attacks.tsx";

const NAMES = ["Shortbow", "Arrow", "Arrow"];

function archer(quantities: number[]) {
  const record = characterRecord("1", "Vex");
  const definition = characterDefinitionSchema.parse({
    ...record.definition,
    inventory: [
      { ref: { name: "Shortbow", source: "PHB" }, equipped: true },
      ...quantities.map((quantity) => ({ ref: { name: "Arrow", source: "PHB" }, quantity })),
    ],
  });
  return { ...record, definition };
}

const bowAttack = (
  stacks: { entry: number; quantity: number }[],
): CharacterDerived["attacks"][number] => ({
  entry: 0,
  ability: "dex",
  attackBonus: { computed: 5, manual: null, terms: [] },
  critThreshold: { computed: 20, manual: null, terms: [] },
  damage: null,
  grip: null,
  mastery: [],
  range: { normal: 80, long: 320 },
  ammunition: { type: "arrow|phb", stacks },
  reload: null,
});

let posts: unknown[] = [];
let writes: { definition: CharacterDefinition }[] = [];
let failWrites = false;

function renderBow(quantities: number[]) {
  posts = [];
  writes = [];
  failWrites = false;
  const character = archer(quantities);
  const stacks = quantities.map((quantity, index) => ({ entry: index + 1, quantity }));
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/inventory")) {
        return Response.json({
          items: character.definition.inventory.map((_, i) => ({ name: NAMES[Math.min(i, 1)] })),
        });
      }
      if (url.endsWith("/rolls")) {
        posts.push(JSON.parse(String(init?.body)));
        return Response.json(
          {
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
          },
          { status: 201 },
        );
      }
      if (init?.method !== "PUT") return Response.json({ refs: [] });
      if (failWrites) return Response.json({ error: "down" }, { status: 500 });
      const body = JSON.parse(String(init?.body));
      writes.push(body);
      return Response.json({
        character: { ...character, definition: body.definition },
        state: stateRecord(),
      });
    }),
  );
  const client = new QueryClient();
  client.setQueryData(characterKey("1"), character);
  client.setQueryData(characterStateKey("1"), stateRecord());
  render(
    <QueryClientProvider client={client}>
      <RollingFor value="1">
        <OnRolled value={vi.fn()}>
          <Attacks
            character={character}
            derived={{ ...derivedRecord(), spellcasting: [], attacks: [bowAttack(stacks)] }}
          />
        </OnRolled>
      </RollingFor>
    </QueryClientProvider>,
  );
}

const fire = () => fireEvent.click(screen.getByRole("button", { name: "Roll Shortbow attack" }));

afterEach(() => vi.unstubAllGlobals());

describe("firing ammunition", () => {
  it("shows the count left across the loose stacks", async () => {
    renderBow([3, 4]);

    expect(await screen.findByRole("rowheader", { name: /Shortbow/ })).toHaveTextContent(
      "(7 left)",
    );
  });

  it("spends one piece from the stack with the attack roll, in one definition and state write", async () => {
    renderBow([3]);
    fire();

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(writes).toHaveLength(1);
    expect(writes[0]?.definition.inventory[1]?.quantity).toBe(2);
    expect(await screen.findByText("Spent one Arrow, 2 left")).toBeInTheDocument();
  });

  it("removes the entry when its last piece is spent", async () => {
    renderBow([1]);
    fire();

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(writes[0]?.definition.inventory).toHaveLength(1);
  });

  it("spends from the stack the player picks", async () => {
    renderBow([3, 4]);
    fireEvent.change(await screen.findByRole("combobox", { name: "Spend from" }), {
      target: { value: "2" },
    });
    fire();

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(writes[0]?.definition.inventory.map((entry) => entry.quantity)).toEqual([1, 3, 3]);
  });

  it("refuses the roll with a message at none left, rolling and spending nothing", async () => {
    renderBow([]);
    fire();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Shortbow has no ammunition left to fire.",
    );
    expect(posts).toHaveLength(0);
    expect(writes).toHaveLength(0);
  });

  it("does not roll when the spend fails, and says the weapon was not fired", async () => {
    renderBow([3]);
    failWrites = true;
    fire();

    expect(await screen.findByRole("alert")).toHaveTextContent("Shortbow was not fired");
    expect(posts).toHaveLength(0);
  });
});
