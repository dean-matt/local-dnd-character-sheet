import type { CharacterDefinition, CharacterRecord } from "@dnd/character";
import { QueryClient, QueryClientProvider, skipToken, useQuery } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, type Mock, vi } from "vitest";
import { characterKey } from "../../../../hooks/characterKeys.ts";
import { characterRecord, derivedRecord } from "../../../../test/records.ts";
import { LevelUp } from "./LevelUp.tsx";

vi.mock("@dnd/dice", () => ({ rollDice: () => ({ total: 5 }) }));

const WARLOCK = { name: "Warlock", source: "XPHB" };
const XPHB = (name: string) => ({ name, source: "XPHB" });
const feature = (name: string, level: number, extra: object = {}) => ({
  ...XPHB(name),
  level,
  json: XPHB(name),
  ...extra,
});
const grants = (level: number, invocations: number, features: object[]) => ({
  level,
  resources: [],
  spellSlots: [],
  optionalFeatures: invocations > 0 ? [{ featureType: "EI", known: invocations }] : [],
  features,
});
const page = (items: object[]) => ({ items, total: items.length });

const ROWS: Record<string, unknown> = {
  "/api/classes/Warlock/XPHB": {
    ...WARLOCK,
    edition: "one",
    hitDie: 8,
    json: {
      ...WARLOCK,
      classFeatures: [
        { classFeature: "Warlock Subclass|Warlock|XPHB|3", gainSubclassFeature: true },
      ],
    },
  },
  "/api/classes/Warlock/XPHB/subclasses?edition=one&limit=200": page([
    {
      name: "Fiend Patron",
      source: "XPHB",
      shortName: "Fiend",
      className: "Warlock",
      classSource: "XPHB",
      edition: "one",
      json: { name: "Fiend Patron", source: "XPHB", shortName: "Fiend" },
    },
  ]),
  "/api/classes/Warlock/XPHB/at/1": grants(1, 1, [feature("Pact Magic", 1)]),
  "/api/classes/Warlock/XPHB/at/2": grants(2, 3, [feature("Magical Cunning", 2)]),
  "/api/classes/Warlock/XPHB/at/3": grants(3, 3, [feature("Warlock Subclass", 3)]),
  "/api/classes/Warlock/XPHB/at/4": grants(4, 3, [
    feature("Ability Score Improvement", 4),
    feature("Pact Choice", 4, { choose: 1 }),
    feature("Pact of the Blade", 4, { offeredBy: XPHB("Pact Choice") }),
    feature("Pact of the Tome", 4, { offeredBy: XPHB("Pact Choice") }),
  ]),
  "/api/classes/Warlock/XPHB/subclasses/Fiend%20Patron/XPHB/at/3": grants(3, 0, [
    feature("Dark One's Blessing", 3),
  ]),
  "/api/feats?edition=one&limit=200": page([
    { ...XPHB("Alert"), edition: "one", json: { ...XPHB("Alert"), category: "G" } },
  ]),
};

/** Vex as a milestone Warlock of `count` levels, with an Armor Class override standing. */
function warlock(count: number, edit: Partial<CharacterDefinition> = {}): CharacterRecord {
  const record = characterRecord("1", "Vex");
  return {
    ...record,
    level: count,
    definition: {
      ...record.definition,
      levels: Array.from({ length: count }, () => ({ class: WARLOCK })),
      leveling: "milestone",
      overrides: { armorClass: 17 },
      ...edit,
    },
  };
}

function Seeded({ id }: { id: string }) {
  const { data } = useQuery<CharacterRecord>({ queryKey: characterKey(id), queryFn: skipToken });
  return data ? <LevelUp character={data} /> : null;
}

let writes: Mock;

function renderSeeded(character: CharacterRecord) {
  let stored = character.definition;
  writes = vi.fn(async (_url: string, init: RequestInit) => {
    stored = JSON.parse(String(init.body));
    return new Response(JSON.stringify({ ...character, definition: stored }));
  });
  vi.stubGlobal("fetch", async (url: RequestInfo | URL, init?: RequestInit) => {
    const path = String(url);
    if (path === "/api/characters/1/derived")
      return new Response(JSON.stringify(derivedRecord(stored)));
    if (init?.method === "PUT") return writes(path, init);
    if (path in ROWS) return new Response(JSON.stringify(ROWS[path]));
    return new Response(JSON.stringify({ error: `unstubbed ${path}` }), { status: 404 });
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(characterKey(character.id), character);
  render(
    <QueryClientProvider client={client}>
      <Seeded id={character.id} />
    </QueryClientProvider>,
  );
}

const sent = (): CharacterDefinition => JSON.parse(String(writes.mock.calls.at(-1)?.[1]?.body));
const dialog = () => screen.getByRole("dialog");
const applyButton = () => within(dialog()).getByRole("button", { name: "Apply level up" });

async function open() {
  fireEvent.click(screen.getByRole("button", { name: "Level up" }));
  await within(dialog()).findByText(/Choose how this level's hit points are found/);
}

function choose(name: string, option: string) {
  fireEvent.click(within(dialog()).getByRole("combobox", { name }));
  fireEvent.click(within(dialog()).getByRole("option", { name: option }));
}

afterEach(() => vi.unstubAllGlobals());

describe("LevelUp", () => {
  it("waits on the next level's experience where the character levels by it", () => {
    renderSeeded(warlock(1, { leveling: "xp", experience: 100 }));
    const button = screen.getByRole("button", { name: "Level up" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAccessibleDescription("200 XP to go");
    fireEvent.click(button);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("writes the level at the average as one edit, keeps an override, and lists what moved", async () => {
    renderSeeded(warlock(1));
    await open();
    expect(applyButton()).toHaveAttribute("aria-disabled", "true");
    expect(within(dialog()).getByText(/Magical Cunning/)).toBeVisible();

    fireEvent.click(within(dialog()).getByRole("button", { name: "Average (5)" }));
    expect(within(dialog()).getByText("Average 5 +2 Constitution = +7 hit points")).toBeVisible();
    fireEvent.click(applyButton());

    await waitFor(() => expect(writes).toHaveBeenCalledTimes(1));
    await within(dialog()).findByText("Hit point maximum");
    expect(writes).toHaveBeenCalledTimes(1);
    expect(sent().levels).toEqual([{ class: WARLOCK }, { class: WARLOCK }]);
    expect(sent().overrides).toEqual({ armorClass: 17 });
    expect(within(dialog()).getByText("10 → 17")).toBeVisible();
    expect(within(dialog()).getByText("Eldritch Invocation options known")).toBeVisible();
    expect(within(dialog()).getByText("1 → 3")).toBeVisible();
    expect(within(dialog()).getByText("New features:").parentElement).toHaveTextContent(
      "New features: Magical Cunning",
    );
  });

  it("shows a roll as it lands and stores the face rolled", async () => {
    renderSeeded(warlock(1));
    await open();
    fireEvent.click(within(dialog()).getByRole("button", { name: "Roll (d8)" }));
    expect(within(dialog()).getByText(/Rolled 5 on the d8/)).toBeVisible();
    fireEvent.click(applyButton());
    await waitFor(() => expect(writes).toHaveBeenCalledTimes(1));
    expect(sent().levels.at(-1)).toEqual({ class: WARLOCK, rolled: 5 });
  });

  it("writes nothing when abandoned part way", async () => {
    renderSeeded(warlock(1));
    await open();
    fireEvent.click(within(dialog()).getByRole("button", { name: "Average (5)" }));
    fireEvent.click(within(dialog()).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(writes).not.toHaveBeenCalled();
  });

  it("asks for the subclass at the class's subclass level and stores it on that level", async () => {
    renderSeeded(warlock(2));
    await open();
    fireEvent.click(within(dialog()).getByRole("button", { name: "Average (5)" }));
    expect(applyButton()).toHaveAttribute("aria-disabled", "true");

    choose("Warlock subclass", "Fiend Patron");
    expect(await within(dialog()).findByText(/Dark One's Blessing/)).toBeVisible();
    fireEvent.click(applyButton());
    await waitFor(() => expect(writes).toHaveBeenCalledTimes(1));
    expect(sent().levels.at(-1)).toEqual({ class: WARLOCK, subclass: XPHB("Fiend Patron") });
  });

  it("asks for the improvement and each feature's option the level brings", async () => {
    renderSeeded(warlock(3));
    await open();
    fireEvent.click(within(dialog()).getByRole("button", { name: "Average (5)" }));
    await within(dialog()).findByRole("combobox", { name: "Level 4 choice" });
    choose("Level 4 choice", "Alert");
    expect(applyButton()).toHaveAttribute("aria-disabled", "true");

    choose("Pact Choice", "Pact of the Tome");
    fireEvent.click(applyButton());
    await waitFor(() => expect(writes).toHaveBeenCalledTimes(1));
    expect(sent().feats).toContainEqual({
      ref: XPHB("Alert"),
      grantedBy: { kind: "class", ref: WARLOCK },
      level: 4,
    });
    expect(sent().featureChoices).toEqual([
      {
        feature: { className: "Warlock", classSource: "XPHB", ...XPHB("Pact Choice"), level: 4 },
        options: [XPHB("Pact of the Tome")],
      },
    ]);
  });
});
