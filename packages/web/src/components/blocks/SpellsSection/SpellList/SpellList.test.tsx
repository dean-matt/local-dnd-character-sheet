import type { CharacterSpells, SheetSpell } from "@dnd/catalog";
import type { CharacterDefinition, CharacterDerived, CharacterRecord } from "@dnd/character";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { characterKey } from "../../../../hooks/characterKeys.ts";
import { characterRecord, derivedRecord } from "../../../../test/records.ts";
import { SpellList } from "./SpellList.tsx";

const WARLOCK = { name: "Warlock", source: "XPHB" };
const WIZARD = { name: "Wizard", source: "XPHB" };

const spell = (name: string, level: number, prepared = false, school = "V"): SheetSpell => ({
  resolved: true,
  name,
  source: "XPHB",
  prepared,
  level,
  school,
  concentration: false,
  ritual: false,
  entries: [],
});

type HomebrewSpell = { id: string; name: string; level: number; json: Record<string, unknown> };

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

/** The class list's first page: Hex and 199 others, so Hellish Rebuke sits on the second. */
const FIRST_PAGE = [hit("Hex"), ...Array.from({ length: 199 }, (_, n) => hit(`Filler ${n}`))];

const json = (value: unknown) => new Response(JSON.stringify(value));
const page = (items: unknown[], total = items.length) =>
  json({ items, total, limit: 200, offset: 0 });

/** A class's row or its table, or `undefined` for another URL. */
function classAnswer(url: string) {
  if (!url.startsWith("/api/classes/")) return undefined;
  if (url.includes("/at/")) {
    const spellSlots = [{ slotLevel: 1, slots: 1 }];
    return json({ level: 1, resources: [], spellSlots, optionalFeatures: [], features: [] });
  }
  return json({
    ...WARLOCK,
    edition: "one",
    hitDie: 8,
    json: { ...WARLOCK, casterProgression: "pact" },
  });
}

/** A class's list, or any other search, or `undefined` for another URL. */
function searchAnswer(url: string) {
  if (!url.startsWith("/api/search")) return undefined;
  if (url.includes("class=")) {
    if (url.includes("minLevel=2")) return page([hit("Darkness")]);
    if (url.includes("offset=200")) return page([hit("Hellish Rebuke"), hit("Darkness")], 202);
    return page(FIRST_PAGE, 202);
  }
  const glimmer = { type: "spell", id: "hb-1", name: "Glimmer", edition: "one" };
  return page([hit("Hex"), hit("Fireball"), hit("Hellish Rebuke"), hit("Darkness"), glimmer]);
}

/**
 * Answers the spells read with `sheet`; a Warlock row casting by pact; its table with a
 * 1st-level slot; its list over two pages, the second holding Hellish Rebuke and the
 * 2nd-level Darkness, or Darkness alone from 2nd level; any other search with Hex,
 * Fireball, Hellish Rebuke, Darkness and a homebrew Glimmer; and a write with the record.
 */
function stubServer(record: CharacterRecord, sheet: CharacterSpells, homebrew?: HomebrewSpell) {
  let spells = sheet;
  let row = homebrew;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/characters/1/spells") return json(spells);
    if (row && url === `/api/homebrew/spells/${row.id}`) {
      if (init?.method === "PUT") {
        const { level, name } = JSON.parse(String(init.body));
        const saved = { ...row, name, level };
        row = saved;
        spells = {
          spells: spells.spells.map((it) =>
            it.homebrewId === saved.id ? { ...it, name, level } : it,
          ),
        };
      }
      return json(row);
    }
    return (
      classAnswer(url) ??
      searchAnswer(url) ??
      json({ ...record, definition: JSON.parse(String(init?.body)) })
    );
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
  homebrew?: HomebrewSpell,
) {
  const fetchMock = stubServer(record, sheet, homebrew);
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

// Edit loads the editor as its own chunk; loaded here, no test's wait has to cover the import.
beforeAll(async () => {
  await import("../../../HomebrewEditor/HomebrewEditor.tsx");
});

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

  it("cites the item behind a spell it lets the character cast, with no × to forget it", async () => {
    renderList(vex(), {
      spells: [
        ...SHEET.spells,
        { ...spell("Fireball", 3, true), granted: true, fromItem: "Staff of Power" },
      ],
    });

    const row = (await screen.findByText("Fireball")).closest("li") as HTMLElement;
    expect(row).toHaveTextContent("Staff of Power");
    expect(screen.queryByRole("button", { name: "Remove Fireball" })).toBeNull();
    expect(screen.getByText("Warlock: 1 of 2 prepared")).toBeInTheDocument();
  });

  it("holds a spell picked for a feat apart from the class", async () => {
    const pickedFor = { kind: "feat" as const, ref: { name: "Magic Initiate", source: "XPHB" } };
    const rebuke = { ref: { name: "Hellish Rebuke", source: "XPHB" }, prepared: true, pickedFor };
    renderList(vex([rebuke]), {
      spells: [...SHEET.spells, { ...spell("Hellish Rebuke", 1, true), pickedFor }],
    });

    expect(await screen.findByText("Warlock: 1 of 2 prepared")).toBeInTheDocument();
    const row = screen.getByText("Hellish Rebuke").closest("li") as HTMLElement;
    expect(row).toHaveTextContent("Prepared");
    expect(screen.queryByRole("button", { name: "Prepared, Hellish Rebuke" })).toBeNull();

    fireEvent.focus(screen.getByRole("combobox", { name: "Learn a Warlock spell" }));
    expect(await screen.findByRole("option", { name: /Hellish Rebuke/ })).not.toHaveTextContent(
      "Known already",
    );
  });

  it("shows an always-prepared spell the Prepared pill and an info icon that says why", async () => {
    const pickedFor = {
      kind: "feat" as const,
      ref: { name: "Strixhaven Initiate", source: "SCC" },
    };
    renderList(vex(), {
      spells: [
        ...SHEET.spells,
        { ...spell("Catapult", 1, true), pickedFor },
        { ...spell("Shield", 1, true), granted: true },
      ],
    });

    const row = (await screen.findByText("Catapult")).closest("li") as HTMLElement;
    expect(within(row).getByText("Prepared")).toBeInTheDocument();
    expect(within(row).queryByRole("button", { name: /^Prepared, / })).toBeNull();

    const icon = within(row).getByRole("button", { name: "Why Catapult is always prepared" });
    expect(screen.getAllByRole("tooltip", { hidden: true })[0]).not.toBeVisible();
    fireEvent.focus(icon);
    const tip = within(row).getByRole("tooltip");
    expect(tip).toHaveTextContent("Always prepared: Strixhaven Initiate");
    expect(tip).toHaveTextContent("does not count against the prepared limit");
    expect(icon).toHaveAccessibleDescription(tip.textContent ?? "");
    fireEvent.keyDown(icon, { key: "Escape" });
    expect(tip).not.toBeVisible();
    fireEvent.focus(icon);
    fireEvent.blur(icon);
    expect(tip).not.toBeVisible();
    fireEvent.mouseEnter(icon);
    expect(tip).toBeVisible();

    const shield = (await screen.findByText("Shield")).closest("li") as HTMLElement;
    fireEvent.focus(within(shield).getByRole("button", { name: "Why Shield is always prepared" }));
    expect(within(shield).getByRole("tooltip")).toHaveTextContent("this spell is granted");
    expect(within(shield).getByRole("tooltip")).not.toHaveTextContent("Strixhaven");
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
    expect(screen.getByRole("option", { name: /Darkness/ })).toHaveTextContent(
      "Above the highest level a Warlock slot casts",
    );
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

  it("lets a pact caster with Mystic Arcanum learn past its slots", async () => {
    const base = vex();
    const levels = Array.from({ length: 11 }, () => ({ class: WARLOCK }));
    const fetchMock = renderList({ ...base, definition: { ...base.definition, levels } });

    fireEvent.focus(await screen.findByRole("combobox", { name: "Learn a Warlock spell" }));
    const darkness = await screen.findByRole("option", { name: /Darkness/ });
    await waitFor(() => expect(darkness).not.toHaveTextContent("Checking"));
    expect(darkness).not.toHaveTextContent("Above");
    fireEvent.click(darkness);

    await waitFor(() => expect(written(fetchMock)).toBeDefined());
    expect(written(fetchMock)[2]?.ref).toEqual({ name: "Darkness", source: "XPHB" });
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

  describe("a homebrew spell's detail", () => {
    const glimmer: HomebrewSpell & Record<string, unknown> = {
      id: "hb-1",
      name: "Glimmer",
      edition: "one",
      level: 1,
      school: "V",
      concentration: false,
      ritual: false,
      json: {
        name: "Glimmer",
        source: "HB",
        level: 1,
        school: "V",
        time: [{ number: 1, unit: "action" }],
        range: { type: "point", distance: { type: "self" } },
        components: { v: true },
        duration: [{ type: "instant" }],
        entries: ["A faint light."],
      },
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    const sheet: CharacterSpells = {
      spells: [
        spell("Hex", 1, true),
        { ...spell("Glimmer", 1), source: undefined, homebrewId: "hb-1" },
        { resolved: false, name: "Homebrew", homebrewId: "gone", prepared: false },
      ],
    };
    const record = vex([
      { ref: { homebrewId: "hb-1" }, prepared: false },
      { ref: { homebrewId: "gone" }, prepared: false },
    ]);
    const dialogs = () => [...document.querySelectorAll<HTMLElement>("dialog[open]")];

    it("offers Edit on a homebrew spell's detail, and none on a catalog one or a missing one", async () => {
      renderList(record, sheet, undefined, glimmer);

      fireEvent.click(await screen.findByRole("button", { name: "Glimmer" }));
      expect(
        await within(dialogs()[0] as HTMLElement).findByRole("button", { name: "Edit" }),
      ).toBeInTheDocument();
      fireEvent(dialogs()[0] as HTMLElement, new Event("cancel", { cancelable: true }));

      fireEvent.click(screen.getByRole("button", { name: "Hex" }));
      expect(
        within(dialogs()[0] as HTMLElement).queryByRole("button", { name: "Edit" }),
      ).toBeNull();
      fireEvent(dialogs()[0] as HTMLElement, new Event("cancel", { cancelable: true }));

      expect(screen.queryByRole("button", { name: "Homebrew" })).toBeNull();
    });

    it("moves the spell under its new level once a level change from the sheet saves", async () => {
      renderList(record, sheet, undefined, glimmer);

      fireEvent.click(await screen.findByRole("button", { name: "Glimmer" }));
      fireEvent.click(
        await within(dialogs()[0] as HTMLElement).findByRole("button", { name: "Edit" }),
      );
      await waitFor(() => expect(dialogs()).toHaveLength(2));
      const editor = dialogs()[1] as HTMLElement;
      fireEvent.click(within(editor).getByRole("combobox", { name: "Level" }));
      fireEvent.click(screen.getByRole("option", { name: "Level 3" }));
      fireEvent.click(within(editor).getByRole("button", { name: "Save" }));

      const third = await screen.findByRole("heading", { name: "3rd Level" });
      expect(third.parentElement).toHaveTextContent("Glimmer");
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

  describe("filter", () => {
    const FILTERED: CharacterSpells = {
      spells: [
        spell("Hex", 1, true, "E"),
        spell("Armor of Agathys", 1, false, "A"),
        spell("Fire Bolt", 0, false, "V"),
        spell("Darkness", 2, false, "E"),
      ],
    };
    const filtered = () =>
      vex([
        { ref: { name: "Fire Bolt", source: "XPHB" }, prepared: false },
        { ref: { name: "Darkness", source: "XPHB" }, prepared: false },
      ]);
    const open = () =>
      fireEvent.click(screen.getByRole("button", { name: /^Filter Known Spells/ }));
    async function addSchool(option: string) {
      fireEvent.click(screen.getByRole("combobox", { name: "Add school" }));
      fireEvent.click(await screen.findByRole("option", { name: option }));
    }
    const level = (end: "Minimum" | "Maximum", value: string) =>
      fireEvent.change(screen.getByLabelText(`${end} spell level`), { target: { value } });

    it("narrows by any school picked and by level, badging the button", async () => {
      renderList(filtered(), FILTERED);
      await screen.findByText("Hex");

      open();
      await addSchool("Enchantment");
      await addSchool("Abjuration");
      expect(screen.queryByText("Fire Bolt")).toBeNull();
      expect(screen.getByText("Darkness")).toBeInTheDocument();
      expect(screen.getByText("Armor of Agathys")).toBeInTheDocument();

      level("Minimum", "2");
      expect(screen.getByText("Darkness")).toBeInTheDocument();
      expect(screen.queryByText("Hex")).toBeNull();
      level("Maximum", "1");
      expect(screen.getByText("Nothing matches the filter.")).toBeInTheDocument();
      expect(screen.queryByText(/has no spells yet/)).toBeNull();
      expect(screen.getByRole("button", { name: "Filter Known Spells (2 active)" })).toBeVisible();
    });

    it("removes a chip by its ×, offers a picked school no more, and resets both facets", async () => {
      renderList(filtered(), FILTERED);
      await screen.findByText("Hex");

      open();
      await addSchool("Evocation");
      fireEvent.click(screen.getByRole("combobox", { name: "Add school" }));
      expect(screen.queryByRole("option", { name: "Evocation" })).toBeNull();
      fireEvent.keyDown(screen.getByRole("combobox", { name: "Add school" }), { key: "Escape" });
      fireEvent.click(screen.getByRole("button", { name: "Remove Evocation" }));
      expect(screen.getByText("Showing all")).toBeInTheDocument();

      await addSchool("Evocation");
      level("Minimum", "3");
      fireEvent.click(screen.getByRole("button", { name: "Reset" }));
      expect(screen.getByRole("button", { name: "Filter Known Spells" })).toBeInTheDocument();
      expect(screen.getByText("Hex")).toBeInTheDocument();
      expect(screen.getByText("Fire Bolt")).toBeInTheDocument();
    });

    it("hides a spell that did not resolve under a school or level filter, and shows it again on Reset", async () => {
      const gone: SheetSpell = {
        resolved: false,
        name: "Lost Spell",
        source: "XPHB",
        prepared: false,
      };
      const record = vex([{ ref: { name: "Lost Spell", source: "XPHB" }, prepared: false }]);
      renderList(record, { spells: [...FILTERED.spells, gone] });
      await screen.findByText("Lost Spell");

      open();
      await addSchool("Enchantment");
      expect(screen.queryByText("Lost Spell")).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Reset" }));
      expect(screen.getByText("Lost Spell")).toBeInTheDocument();

      level("Maximum", "9");
      expect(screen.queryByText("Lost Spell")).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Reset" }));
      expect(screen.getByText("Lost Spell")).toBeInTheDocument();
    });

    it("closes on Escape with focus back on the button", async () => {
      renderList(filtered(), FILTERED);
      await screen.findByText("Hex");

      const button = screen.getByRole("button", { name: "Filter Known Spells" });
      button.focus();
      fireEvent.click(button);
      screen.getByLabelText("Minimum spell level").focus();
      fireEvent.keyDown(screen.getByLabelText("Minimum spell level"), { key: "Escape" });
      expect(screen.queryByRole("group", { name: "Known Spells filter" })).toBeNull();
      expect(button).toHaveFocus();
    });

    it("still prepares the right spell while narrowed", async () => {
      const fetchMock = renderList(filtered(), FILTERED);
      await screen.findByText("Hex");

      open();
      level("Minimum", "2");
      fireEvent.click(screen.getByRole("button", { name: "Prepared, Darkness" }));
      await waitFor(() => expect(written(fetchMock)).toBeDefined());
      expect(written(fetchMock)[3]).toEqual({
        ref: { name: "Darkness", source: "XPHB" },
        prepared: true,
      });
    });

    it("keeps the empty card's own note", async () => {
      renderList(vex(), { spells: [] });
      await screen.findByText(/has no spells yet/);
      expect(screen.queryByText("Nothing matches the filter.")).toBeNull();
    });
  });
});
