import type { CharacterDefinition, CharacterRecord } from "@dnd/character";
import { QueryClient, QueryClientProvider, skipToken, useQuery } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { characterKey } from "../../../hooks/characterKeys.ts";
import { characterRecord, derivedRecord, identityRecord } from "../../../test/records.ts";
import { saveToasts } from "../../../test/saveToasts.ts";
import { stubFetchByUrl } from "../../../test/stubFetch.ts";
import { SaveToasts } from "../../SaveToasts.tsx";
import { LevelSection } from "./LevelSection.tsx";

/** Reads the character from the cache, as the sheet does, so a write's response reaches it. */
function Seeded({ id }: { id: string }) {
  const { data } = useQuery<CharacterRecord>({ queryKey: characterKey(id), queryFn: skipToken });
  return <LevelSection character={data} />;
}

/** `identityRecord`'s Vex, a level 3 character, with `edit` laid over the definition. */
function record(edit: Partial<CharacterDefinition> = {}): CharacterRecord {
  const base = identityRecord();
  return { ...base, definition: { ...base.definition, ...edit } };
}

function renderSeeded(character = record()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(characterKey(character.id), character);
  render(
    <QueryClientProvider client={client}>
      <Seeded id={character.id} />
      <SaveToasts />
    </QueryClientProvider>,
  );
  return client;
}

const card = () => screen.getByRole("region", { name: "Level" });
const adjust = () => screen.getByRole("spinbutton", { name: /Adjust experience points/ });
const applyButton = () => screen.getByRole("button", { name: "Apply" });
const sentBody = (fetchMock: Mock) => JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body));

function applyXp(amount: string) {
  fireEvent.change(adjust(), { target: { value: amount } });
  fireEvent.click(applyButton());
}

const FIGHTER = { name: "Fighter", source: "XPHB" };
const NO_GRANTS = { level: 1, resources: [], spellSlots: [], optionalFeatures: [], features: [] };
const CLASS_ROW = /^\/api\/classes\/[^/]+\/[^/]+$/;
const classRow = (path: string) => {
  const [name = "", source = ""] = path.split("/").slice(3);
  return { name, source, edition: "one", hitDie: 8, json: { name, source } };
};
let classGrants: unknown;
let writes: Mock;

/**
 * Answers the class and feat reads `Improvements` and the history's hit dice make and the
 * homebrew name reads, refuses the derived read the history's hit points wait on, and hands
 * every other call to `writes`.
 */
beforeEach(() => {
  classGrants = NO_GRANTS;
  writes = vi.fn();
  vi.stubGlobal("fetch", async (url: RequestInfo | URL, init?: RequestInit) => {
    const path = String(url);
    if (CLASS_ROW.test(path)) return new Response(JSON.stringify(classRow(path)));
    if (path.startsWith("/api/classes/")) return new Response(JSON.stringify(classGrants));
    if (path.startsWith("/api/feats?"))
      return new Response(JSON.stringify({ items: [], total: 0 }));
    if (path.endsWith("/derived")) return new Response("{}", { status: 404 });
    if (path.startsWith("/api/homebrew/")) return new Response("[]");
    return writes(url, init);
  });
});

function stubWrite(response: Response) {
  writes.mockResolvedValue(response);
  return writes;
}

afterEach(() => vi.unstubAllGlobals());

describe("LevelSection", () => {
  it("shows the total level beside a chip per class", () => {
    renderSeeded();

    expect(within(card()).getByText("3")).toHaveClass("text-[32px]", "font-bold");
    expect(
      within(card())
        .queryAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Warlock 2 (Fiend Patron)", "Fighter 1"]);
  });

  it("names a homebrew class from its row, and follows a rename with the sheet still mounted", async () => {
    const warden = (name: string) => [
      {
        id: "hc-1",
        name,
        edition: "one",
        hitDie: 10,
        json: { name, source: "HB", hd: { number: 1, faces: 10 } },
        createdAt: "2026-10-28T00:00:00.000Z",
      },
    ];
    const homebrewClass = { homebrewId: "hc-1" };
    const client = renderSeeded(
      record({ levels: [{ class: homebrewClass }, { class: homebrewClass }] }),
    );
    const chips = () =>
      within(card())
        .queryAllByRole("listitem")
        .map((item) => item.textContent);
    expect(chips()).toEqual(["Homebrew 2"]);
    await waitFor(() => expect(client.isFetching()).toBe(0));

    act(() => client.setQueryData(["homebrew", "classes"], warden("Warden")));
    await waitFor(() => expect(chips()).toEqual(["Warden 2"]));

    act(() => client.setQueryData(["homebrew", "classes"], warden("Sentinel")));
    await waitFor(() => expect(chips()).toEqual(["Sentinel 2"]));
  });

  it("follows the Level card with the improvements the classes grant", async () => {
    const asi = { name: "Ability Score Improvement", source: "XPHB", level: 4 };
    classGrants = { ...NO_GRANTS, level: 4, features: [{ ...asi, json: asi }] };
    renderSeeded(record({ levels: Array.from({ length: 4 }, () => ({ class: FIGHTER })) }));

    const improvements = await screen.findByRole("region", { name: "Ability Score Improvements" });
    expect(within(improvements).getByText("Level 4 · Fighter 4:")).toBeVisible();
    expect(card().compareDocumentPosition(improvements)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("shows no improvements card where no class grants one", async () => {
    const client = renderSeeded();

    await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(
      screen.queryByRole("region", { name: "Ability Score Improvements" }),
    ).not.toBeInTheDocument();
  });

  it("measures experience toward the next level's threshold", () => {
    renderSeeded(record({ experience: 1500 }));

    expect(screen.getByRole("combobox", { name: "Leveling" })).toHaveTextContent("Experience");
    expect(within(card()).getByText("1,500 XP")).toBeInTheDocument();
    expect(within(card()).getByText("2,700 XP")).toBeInTheDocument();
    expect(within(card()).getByText("1,200 XP to Level 4")).toBeInTheDocument();
  });

  it("says a character at the threshold can level up, and leaves the level alone", () => {
    renderSeeded(record({ experience: 2700 }));

    expect(within(card()).getByText("Enough XP to level up.")).toBeInTheDocument();
    expect(within(card()).getByText("3")).toBeInTheDocument();
  });

  it("names no next threshold at level 20", () => {
    const fighter = { class: { name: "Fighter", source: "XPHB" } };
    renderSeeded(record({ levels: Array.from({ length: 20 }, () => fighter), experience: 400000 }));

    expect(within(card()).getByText("Max level")).toBeInTheDocument();
    expect(
      within(card()).getByText("Level 20 — no further experience needed."),
    ).toBeInTheDocument();
  });

  it("holds Level up until the next threshold, citing the experience caption", () => {
    renderSeeded(record({ experience: 1500 }));

    const button = within(card()).getByRole("button", { name: "Level up" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAccessibleDescription("1,200 XP to Level 4");
  });

  it("offers Level up in milestone mode, and says why it stops at level 20", () => {
    const fighter = { class: FIGHTER };
    renderSeeded(record({ leveling: "milestone" }));
    expect(within(card()).getByRole("button", { name: "Level up" })).toHaveAttribute(
      "aria-disabled",
      "false",
    );

    cleanup();
    renderSeeded(
      record({ leveling: "milestone", levels: Array.from({ length: 20 }, () => fighter) }),
    );
    expect(within(card()).getByRole("button", { name: "Level up" })).toHaveAccessibleDescription(
      "Level 20 is the highest level.",
    );
  });

  it("shows the milestone copy and no experience in milestone mode", () => {
    renderSeeded(record({ leveling: "milestone", experience: 1500 }));

    expect(within(card()).getByText(/Milestone leveling — the DM says/)).toBeInTheDocument();
    expect(within(card()).queryByText("1,500 XP")).not.toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  });

  it("saves a picked leveling mode", async () => {
    const saved = record({ leveling: "milestone" });
    const fetchMock = stubWrite(new Response(JSON.stringify(saved)));
    renderSeeded();

    fireEvent.click(screen.getByRole("combobox", { name: "Leveling" }));
    fireEvent.click(screen.getByRole("option", { name: "Milestone" }));

    await waitFor(() => expect(within(card()).getByText(/Milestone leveling/)).toBeInTheDocument());
    expect(sentBody(fetchMock).leveling).toBe("milestone");
  });

  it("adds experience to the stored total and clears the field", async () => {
    const fetchMock = stubWrite(new Response(JSON.stringify(record({ experience: 1750 }))));
    renderSeeded(record({ experience: 1500 }));

    applyXp("250");

    expect(adjust()).toHaveValue(null);
    await waitFor(() => expect(within(card()).getByText("1,750 XP")).toBeInTheDocument());
    expect(sentBody(fetchMock).experience).toBe(1750);
  });

  it("removes experience with a negative amount, never below zero", async () => {
    const fetchMock = stubWrite(new Response(JSON.stringify(record({ experience: 0 }))));
    renderSeeded(record({ experience: 100 }));

    applyXp("-300");

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(sentBody(fetchMock).experience).toBe(0);
  });

  it.each(["", "0", "1.5"])("offers no Apply for %j", (amount) => {
    renderSeeded();
    fireEvent.change(adjust(), { target: { value: amount } });
    expect(applyButton()).toBeDisabled();
  });

  it("keeps the total on a failed save and retries the same amount", async () => {
    const fetchMock = stubWrite(
      new Response(JSON.stringify({ error: "disk full" }), { status: 500 }),
    );
    renderSeeded(record({ experience: 1500 }));

    applyXp("250");

    expect(
      await saveToasts().findByText("Experience: Couldn't save +250 XP: disk full"),
    ).toBeInTheDocument();
    expect(adjust()).toHaveAttribute("aria-invalid", "true");
    expect(within(card()).getByText("1,500 XP")).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(record({ experience: 1750 }))));
    fireEvent.click(saveToasts().getByRole("button", { name: /^Retry / }));

    await waitFor(() => expect(within(card()).getByText("1,750 XP")).toBeInTheDocument());
    expect(sentBody(fetchMock).experience).toBe(1750);
  });
});

/**
 * A server that keeps the definition it is sent and derives the hit points from it;
 * returns the definitions it was sent and each write's `Undo-Entry` header.
 */
function stubServer(character: CharacterRecord) {
  let stored = character;
  const puts: CharacterDefinition[] = [];
  const undoEntries: (string | undefined)[] = [];
  const answer = (path: string, init?: RequestInit): unknown => {
    if (init?.method === "PUT") {
      const definition = JSON.parse(String(init.body)) as CharacterDefinition;
      puts.push(definition);
      undoEntries.push((init.headers as Record<string, string>)["Undo-Entry"]);
      stored = { ...stored, definition };
      return stored;
    }
    if (path.endsWith("/derived")) return derivedRecord(stored.definition);
    if (CLASS_ROW.test(path)) return classRow(path);
    return path.startsWith("/api/classes/") && !path.includes("/subclasses?")
      ? NO_GRANTS
      : { items: [], total: 0 };
  };
  vi.stubGlobal(
    "fetch",
    async (url: RequestInfo | URL, init?: RequestInit) =>
      new Response(JSON.stringify(answer(String(url), init))),
  );
  return { puts, undoEntries };
}

describe("LevelHistory", () => {
  const WARLOCK = { name: "Warlock", source: "XPHB" };
  const FIEND = { name: "Fiend Patron", source: "XPHB" };
  const feature = (name: string, level: number) => ({
    name,
    source: "XPHB",
    level,
    json: { name, source: "XPHB", entries: [`${name} rules text.`] },
  });
  const grants = (level: number, features: object[]) => ({ ...NO_GRANTS, level, features });

  /** Vex at Warlock 4, a Fiend Patron from the third level and +2 Charisma at the fourth. */
  function warlock(levels = 4): CharacterRecord {
    const base = characterRecord("1", "Vex");
    return {
      ...base,
      definition: {
        ...base.definition,
        levels: Array.from({ length: levels }, (_, index) =>
          index === 2 ? { class: WARLOCK, subclass: FIEND } : { class: WARLOCK },
        ),
        abilityIncreases: [{ ability: "cha", amount: 2, grantedBy: "class", level: 4 }],
      },
    };
  }

  function stubHistory(character: CharacterRecord) {
    const level = character.definition.levels.length;
    stubFetchByUrl({
      [`/api/classes/Warlock/XPHB/at/${level}`]: grants(level, [
        feature("Pact Magic", 1),
        feature("Magical Cunning", 2),
        feature("Ability Score Improvement", 4),
        feature("Pact Boon", 5),
      ]),
      [`/api/classes/Warlock/XPHB/subclasses/Fiend%20Patron/XPHB/at/${level}`]: grants(level, [
        feature("Dark One's Blessing", 3),
      ]),
      "/api/characters/1/derived": derivedRecord(character.definition),
      "/api/feats?edition=one&limit=200": { items: [], total: 0 },
    });
  }

  const history = () => screen.getByRole("region", { name: "Level History" });
  /** Each body row's cells, the header row dropped. */
  const rows = () =>
    within(history())
      .getAllByRole("row")
      .slice(1)
      .map((row) =>
        [...row.querySelectorAll("th, td")].map((cell) => {
          const lines = [...cell.querySelectorAll("p")];
          return lines.length > 0 ? lines.map((line) => line.textContent) : cell.textContent;
        }),
      );

  it("tables each level oldest first with its class, hit points and what it gained", async () => {
    const character = warlock();
    stubHistory(character);
    renderSeeded(character);

    await waitFor(() =>
      expect(rows()).toEqual([
        ["1", "Warlock 1", "+10 (Level 1: d8 highest 8 +2 Con)", ["Pact Magic"], ""],
        ["2", "Warlock 2", "+7 (Level 2: d8 average 5 +2 Con)", ["Magical Cunning"], ""],
        [
          "3",
          "Warlock 3",
          "+7 (Level 3: d8 average 5 +2 Con)",
          ["Subclass: Fiend Patron", "Dark One's Blessing"],
          "",
        ],
        [
          "4",
          "Warlock 4",
          "+7 (Level 4: d8 average 5 +2 Con)",
          ["Ability Score Improvement", "Improvement: +2 Charisma"],
          "",
        ],
      ]),
    );
    expect(
      within(history())
        .getAllByRole("columnheader")
        .map((cell) => cell.textContent),
    ).toEqual(["Lvl", "Class", "HP", "Gained", "Edit"]);
    expect(within(history()).getByRole("rowheader", { name: "3" })).toBeVisible();
  });

  it("opens a feature's rules text from its name", async () => {
    const character = warlock();
    stubHistory(character);
    renderSeeded(character);

    fireEvent.click(await within(history()).findByRole("button", { name: "Dark One's Blessing" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Dark One's Blessing rules text.")).toBeVisible();
  });

  it("follows a level-up without a reload, holding hit points until they are recomputed", async () => {
    const before = warlock(4);
    stubHistory(before);
    const client = renderSeeded(before);
    await waitFor(() => expect(rows()).toHaveLength(4));

    const after = warlock(5);
    stubHistory(after);
    client.setQueryData(characterKey(after.id), after);
    await waitFor(() => expect(rows()).toHaveLength(5));
    expect(rows().map((row) => row[2])).toEqual(["…", "…", "…", "…", "…"]);
    await client.invalidateQueries({ queryKey: characterKey(after.id) });

    await waitFor(() => expect(rows()[4]?.[3]).toEqual(["Pact Boon"]));
    expect(rows()[4]?.[2]).toBe("+7 (Level 5: d8 average 5 +2 Con)");
  });

  it("tells apart two features of one name at a level by their grantors", async () => {
    const character = warlock(3);
    stubFetchByUrl({
      "/api/classes/Warlock/XPHB/at/3": grants(3, [feature("Channel Divinity", 3)]),
      "/api/classes/Warlock/XPHB/subclasses/Fiend%20Patron/XPHB/at/3": grants(3, [
        feature("Channel Divinity", 3),
      ]),
      "/api/characters/1/derived": derivedRecord(character.definition),
    });
    renderSeeded(character);

    expect(
      await within(history()).findByRole("button", { name: "Channel Divinity (Warlock 3)" }),
    ).toBeVisible();
    expect(
      within(history()).getByRole("button", { name: "Channel Divinity (Fiend Patron 3)" }),
    ).toBeVisible();
  });

  it("says so where the hit points cannot be read", async () => {
    const character = warlock(1);
    stubFetchByUrl({});
    renderSeeded(character);

    await waitFor(() => expect(rows()[0]?.[2]).toBe("unavailable"));
    expect(within(history()).getByText("Some class features could not load.")).toBeVisible();
  });

  describe("changing a level's hit point gain", () => {
    let puts: CharacterDefinition[];
    let undoEntries: (string | undefined)[];
    const serve = (character: CharacterRecord) => {
      ({ puts, undoEntries } = stubServer(character));
    };

    const hp = (level: number) => rows()[level - 1]?.[2];
    const dialog = () => {
      const open = document.querySelector<HTMLElement>("dialog[open]");
      if (!open) throw new Error("no dialog is open");
      return open;
    };
    const gains = () =>
      puts.map((each) =>
        each.levels.map(({ rolled, typed }) => ({
          ...(rolled && { rolled }),
          ...(typed && { typed }),
        })),
      );
    const changeLevel2 = async () => {
      fireEvent.click(await within(history()).findByRole("button", { name: "Edit level 2" }));
      await within(dialog()).findByRole("spinbutton", { name: "Level 2 typed gain" });
    };
    const type = (text: string) =>
      fireEvent.change(within(dialog()).getByRole("spinbutton", { name: "Level 2 typed gain" }), {
        target: { value: text },
      });
    const apply = async () => {
      const button = within(dialog()).getByRole("button", { name: "Apply changes" });
      await waitFor(() => expect(button).toHaveAttribute("aria-disabled", "false"));
      fireEvent.click(button);
    };
    const closed = () => expect(document.querySelector("dialog[open]")).toBeNull();

    afterEach(() => vi.restoreAllMocks());

    it("drafts a gain in the dialog and writes it on Apply, one write and undo entry each", async () => {
      vi.spyOn(Math, "random").mockReturnValue(0.99);
      serve(warlock(3));
      renderSeeded(warlock(3));
      await waitFor(() => expect(hp(2)).toBe("+7 (Level 2: d8 average 5 +2 Con)"));
      await changeLevel2();

      fireEvent.click(within(dialog()).getByRole("button", { name: "Roll (d8)" }));
      expect(within(dialog()).getByText("Rolled 8 on the d8")).toBeInTheDocument();
      expect(within(dialog()).getByRole("spinbutton", { name: "Level 2 typed gain" })).toHaveValue(
        8,
      );
      expect(puts).toEqual([]);
      await apply();
      await waitFor(closed);
      await waitFor(() => expect(hp(2)).toBe("+10 (Level 2: d8 rolled 8 +2 Con)"));
      expect(gains()).toEqual([[{}, { rolled: 8 }, {}]]);
      await waitFor(() =>
        expect(within(history()).getByRole("button", { name: "Edit level 2" })).toHaveFocus(),
      );

      await changeLevel2();
      type("12");
      await apply();
      await waitFor(() => expect(hp(2)).toBe("+14 (Level 2: d8 typed 12 +2 Con)"));
      expect(gains().at(-1)?.[1]).toEqual({ rolled: 12, typed: true });
      expect(puts.at(-1)?.departures).toEqual([
        { field: "levels.1.rolled", note: "Level 2 gains 12 hit points, outside the d8's 1 to 8." },
      ]);

      await changeLevel2();
      fireEvent.click(within(dialog()).getByRole("button", { name: "Average (5)" }));
      await apply();
      await waitFor(() => expect(hp(2)).toBe("+7 (Level 2: d8 average 5 +2 Con)"));
      expect(gains().at(-1)).toEqual([{}, {}, {}]);
      expect(puts.at(-1)?.departures).toEqual([]);
      expect(puts).toHaveLength(3);
      expect(undoEntries).toEqual(["own", "own", "own"]);
    });

    it("writes a gain alone where a read the choices need fails", async () => {
      serve(warlock(3));
      const served = globalThis.fetch;
      vi.stubGlobal("fetch", (url: RequestInfo | URL, init?: RequestInit) =>
        String(url) === "/api/classes/Warlock/XPHB/at/2"
          ? Promise.resolve(new Response("{}", { status: 500 }))
          : served(url, init),
      );
      renderSeeded(warlock(3));
      await changeLevel2();

      fireEvent.click(within(dialog()).getByRole("button", { name: "Average (5)" }));
      await apply();
      await waitFor(closed);
      expect(puts).toHaveLength(1);
    });

    it("holds Apply until the gain or a choice changes, and discards a drafted gain on Cancel", async () => {
      serve(warlock(3));
      renderSeeded(warlock(3));
      await changeLevel2();
      const button = within(dialog()).getByRole("button", { name: "Apply changes" });
      expect(button).toHaveAttribute("aria-disabled", "true");

      fireEvent.click(within(dialog()).getByRole("button", { name: "Roll (d8)" }));
      await waitFor(() => expect(button).toHaveAttribute("aria-disabled", "false"));
      fireEvent.click(within(dialog()).getByRole("button", { name: "Cancel" }));
      closed();

      await changeLevel2();
      expect(within(dialog()).queryByText(/^Rolled/)).toBeNull();
      expect(puts).toEqual([]);
    });

    it("refuses a typed gain below 1 or not whole on Apply, with a message and no write", async () => {
      serve(warlock(3));
      renderSeeded(warlock(3));
      await changeLevel2();

      for (const text of ["0", "-3", "2.5"]) {
        type(text);
        await apply();
        expect(
          await within(dialog()).findByText("A typed gain is a whole number from 1 to 999."),
        ).toBeVisible();
        expect(
          within(dialog()).getByRole("spinbutton", { name: "Level 2 typed gain" }),
        ).toBeInvalid();
      }
      expect(puts).toEqual([]);
    });

    it("says the first level takes the die's highest face instead of offering a change", async () => {
      serve(warlock(3));
      renderSeeded(warlock(3));

      fireEvent.click(await within(history()).findByRole("button", { name: "Edit level 1" }));

      expect(
        await within(dialog()).findByText("Highest face of the d8; a roll cannot change it."),
      ).toBeVisible();
      expect(within(dialog()).queryByRole("button", { name: /^Roll/ })).not.toBeInTheDocument();
    });
  });
});
