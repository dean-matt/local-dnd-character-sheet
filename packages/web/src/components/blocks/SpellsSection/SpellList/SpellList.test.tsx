import type { CharacterSpells, SheetSpell } from "@dnd/catalog";
import type { CharacterDefinition, CharacterDerived, CharacterRecord } from "@dnd/character";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterKey } from "../../../../hooks/characterKeys.ts";
import { characterRecord, derivedRecord } from "../../../../test/records.ts";
import { SpellList } from "./SpellList.tsx";

const WARLOCK = { name: "Warlock", source: "XPHB" };
const WIZARD = { name: "Wizard", source: "XPHB" };

const spell = (name: string, level: number, prepared = false): SheetSpell => ({
  resolved: true,
  name,
  source: "XPHB",
  prepared,
  level,
  school: "V",
  concentration: false,
  ritual: false,
  entries: [],
});

const hit = (name: string) => ({ type: "spell", name, source: "XPHB", edition: "one" });

/** Vex the Warlock, knowing Hex prepared and Armor of Agathys, and the spells read for them. */
function vex(spells: CharacterDefinition["spells"] = []) {
  const record = characterRecord("1", "Vex");
  return {
    ...record,
    definition: {
      ...record.definition,
      spells: [
        { ref: { name: "Hex", source: "XPHB" }, prepared: true },
        { ref: { name: "Armor of Agathys", source: "XPHB" }, prepared: false },
        ...spells,
      ],
    },
  };
}

const SHEET: CharacterSpells = { spells: [spell("Hex", 1, true), spell("Armor of Agathys", 1)] };

/**
 * Answers the spells read with `sheet`, the class list read with Hex and Hellish Rebuke,
 * any other search with Hex, Fireball and a homebrew Glimmer, and a write with the record.
 */
function stubServer(record: CharacterRecord, sheet: CharacterSpells) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const body = (value: unknown) => new Response(JSON.stringify(value));
    if (url === "/api/characters/1/spells") return body(sheet);
    if (url.startsWith("/api/search") && url.includes("class=")) {
      const items = [hit("Hex"), hit("Hellish Rebuke")];
      return body({ items, total: 2, limit: 200, offset: 0 });
    }
    if (url.startsWith("/api/search")) {
      const glimmer = { type: "spell", id: "hb-1", name: "Glimmer", edition: "one" };
      const items = [hit("Hex"), hit("Fireball"), hit("Hellish Rebuke"), glimmer];
      return body({ items, total: 4, limit: 20, offset: 0 });
    }
    return body({ ...record, definition: JSON.parse(String(init?.body)) });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const written = (fetchMock: ReturnType<typeof stubServer>): CharacterDefinition["spells"] => {
  const put = fetchMock.mock.calls.find(([url]) => url === "/api/characters/1");
  return put && JSON.parse(String(put[1]?.body)).spells;
};

function renderList(
  record: CharacterRecord = vex(),
  sheet: CharacterSpells = SHEET,
  derived: CharacterDerived = derivedRecord(record.definition),
) {
  const fetchMock = stubServer(record, sheet);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(characterKey(record.id), record);
  render(
    <QueryClientProvider client={client}>
      <SpellList character={record} derived={derived} />
    </QueryClientProvider>,
  );
  return fetchMock;
}

const computed = (value: number) => ({ computed: value, manual: null, terms: [] });

afterEach(() => vi.unstubAllGlobals());

describe("SpellList", () => {
  it("prepares and unprepares a leveled spell through its toggle", async () => {
    const fetchMock = renderList();

    const toggle = await screen.findByRole("button", { name: "Prepared, Armor of Agathys" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(toggle);

    await waitFor(() => expect(written(fetchMock)).toBeDefined());
    expect(written(fetchMock)[1]).toEqual({
      ref: { name: "Armor of Agathys", source: "XPHB" },
      prepared: true,
    });
  });

  it("forgets a spell with ×", async () => {
    const fetchMock = renderList();

    fireEvent.click(await screen.findByRole("button", { name: "Remove Hex" }));

    await waitFor(() => expect(written(fetchMock)).toBeDefined());
    expect(written(fetchMock)).toEqual([
      { ref: { name: "Armor of Agathys", source: "XPHB" }, prepared: false },
    ]);
  });

  it("reports preparing past the class's count without refusing it", async () => {
    const record = vex([{ ref: { name: "Hellish Rebuke", source: "XPHB" }, prepared: true }]);
    renderList(record, { spells: [...SHEET.spells, spell("Hellish Rebuke", 1, true)] });

    expect(
      await screen.findByText("Warlock: 2 of 2 prepared", { exact: false }),
    ).not.toHaveTextContent("more than");
    const over = {
      spells: [...SHEET.spells, spell("Hellish Rebuke", 1, true), spell("Blur", 2, true)],
    };
    renderList(record, over);
    expect(
      await screen.findByText("Warlock: 3 of 2 prepared — 1 more than Warlock may prepare"),
    ).toBeInTheDocument();
  });

  it("leaves granted spells and cantrips out of the prepared count", async () => {
    renderList(vex(), {
      spells: [
        ...SHEET.spells,
        { ...spell("Bane", 1, true), granted: true },
        spell("Eldritch Blast", 0, true),
      ],
    });

    expect(await screen.findByText("Warlock: 1 of 2 prepared")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Prepared, Eldritch Blast" })).toBeNull();
  });

  it("marks a spell known where its class knows rather than prepares, or a granted one", async () => {
    const [warlock] = derivedRecord().spellcasting;
    const { preparedSpells: _, ...knower } = warlock as CharacterDerived["spellcasting"][number];
    renderList(
      vex(),
      { spells: [...SHEET.spells, { ...spell("Bane", 1, true), granted: true }] },
      { ...derivedRecord(), spellcasting: [knower] },
    );

    const agathys = (await screen.findByText("Armor of Agathys")).closest("li") as HTMLElement;
    expect(agathys).toHaveTextContent("Known");
    expect(screen.queryByRole("button", { name: /^Prepared, / })).toBeNull();
    expect(screen.queryByText(/prepared$/)).toBeNull();
    cleanup();

    renderList(vex(), { spells: [...SHEET.spells, { ...spell("Bane", 1, true), granted: true }] });
    const bane = (await screen.findByText("Bane")).closest("li") as HTMLElement;
    expect(bane).toHaveTextContent("Prepared");
    expect(screen.queryByRole("button", { name: "Prepared, Bane" })).toBeNull();
  });

  it("learns a spell on the class's list, offering one off it only with the reason", async () => {
    const fetchMock = renderList();

    fireEvent.focus(await screen.findByRole("combobox", { name: "Learn a Warlock spell" }));
    expect(await screen.findByRole("option", { name: /Fireball/ })).toHaveTextContent(
      "Not on the Warlock spell list",
    );
    expect(screen.getByRole("option", { name: /Hex/ })).toHaveTextContent("Known already");
    fireEvent.click(screen.getByRole("option", { name: /Fireball/ }));
    expect(written(fetchMock)).toBeUndefined();

    fireEvent.click(screen.getByRole("option", { name: /Hellish Rebuke/ }));
    await waitFor(() => expect(written(fetchMock)).toBeDefined());
    expect(written(fetchMock)[2]).toEqual({
      ref: { name: "Hellish Rebuke", source: "XPHB" },
      prepared: false,
      origin: WARLOCK,
    });
  });

  it("learns a homebrew spell like any other", async () => {
    const fetchMock = renderList();

    fireEvent.focus(await screen.findByRole("combobox", { name: "Learn a Warlock spell" }));
    await screen.findByRole("option", { name: /Hellish Rebuke/ });
    fireEvent.click(screen.getByRole("option", { name: /Glimmer/ }));

    await waitFor(() => expect(written(fetchMock)).toBeDefined());
    expect(written(fetchMock)[2]).toEqual({
      ref: { homebrewId: "hb-1" },
      prepared: false,
      origin: WARLOCK,
    });
  });

  it("learns per class for a multiclassed caster, and names each spell's class", async () => {
    const base = vex([{ ref: { name: "Shield", source: "XPHB" }, prepared: true, origin: WIZARD }]);
    const record = {
      ...base,
      definition: {
        ...base.definition,
        levels: [...base.definition.levels, { class: WIZARD }],
      },
    };
    const [warlock] = derivedRecord().spellcasting;
    const derived = {
      ...derivedRecord(),
      spellcasting: [
        warlock as CharacterDerived["spellcasting"][number],
        {
          class: WIZARD,
          ability: "int" as const,
          saveDc: computed(10),
          attackBonus: computed(2),
          preparedSpells: computed(4),
        },
      ],
    };
    const fetchMock = renderList(
      record,
      { spells: [...SHEET.spells, { ...spell("Shield", 1, true), origin: WIZARD }] },
      derived,
    );

    const shield = (await screen.findByText("Shield")).closest("li") as HTMLElement;
    expect(shield).toHaveTextContent("Wizard");
    const hex = screen.getByText("Hex").closest("li") as HTMLElement;
    expect(hex).toHaveTextContent("Warlock");
    expect(screen.getByText("Wizard: 1 of 4 prepared")).toBeInTheDocument();
    expect(screen.getByText("Warlock: 1 of 2 prepared")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("combobox", { name: "Learn as" }));
    fireEvent.click(screen.getByRole("option", { name: "Wizard" }));
    fireEvent.focus(screen.getByRole("combobox", { name: "Learn a Wizard spell" }));
    const hexOption = await screen.findByRole("option", { name: /Hex/ });
    await waitFor(() => expect(hexOption).not.toHaveTextContent("Checking"));
    expect(hexOption).not.toHaveTextContent("Known already");
    fireEvent.click(hexOption);

    await waitFor(() => expect(written(fetchMock)).toBeDefined());
    expect(written(fetchMock)[3]).toEqual({
      ref: { name: "Hex", source: "XPHB" },
      prepared: false,
      origin: WIZARD,
    });
    const listRead = fetchMock.mock.calls
      .map(([url]) => String(url))
      .find((url) => url.includes("Wizard"));
    expect(listRead).toContain("class=Wizard%7CXPHB");
    expect(listRead).toContain("classLevel=1");
  });
});
