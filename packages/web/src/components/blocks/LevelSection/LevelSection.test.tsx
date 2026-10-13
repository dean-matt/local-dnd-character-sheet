import type { CharacterDefinition, CharacterRecord } from "@dnd/character";
import { QueryClient, QueryClientProvider, skipToken, useQuery } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
let classGrants: unknown;
let writes: Mock;

/**
 * Answers the class and feat reads `Improvements` makes, refuses the derived read the
 * history's hit points wait on, and hands every other call to `writes`.
 */
beforeEach(() => {
  classGrants = NO_GRANTS;
  writes = vi.fn();
  vi.stubGlobal("fetch", async (url: RequestInfo | URL, init?: RequestInit) => {
    const path = String(url);
    if (path.startsWith("/api/classes/")) return new Response(JSON.stringify(classGrants));
    if (path.startsWith("/api/feats?"))
      return new Response(JSON.stringify({ items: [], total: 0 }));
    if (path.endsWith("/derived")) return new Response("{}", { status: 404 });
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
  const rows = () =>
    within(history())
      .getAllByRole("listitem")
      .map((row) => row.textContent);

  it("lists each level oldest first with its hit points, subclass, features and improvement", async () => {
    const character = warlock();
    stubHistory(character);
    renderSeeded(character);

    await waitFor(() =>
      expect(rows()).toEqual([
        "Level 1 · Warlock 1Hit points: +10 (Level 1: d8 highest 8 +2 Con)Features: Pact Magic",
        "Level 2 · Warlock 2Hit points: +7 (Level 2: d8 average 5 +2 Con)Features: Magical Cunning",
        "Level 3 · Warlock 3Hit points: +7 (Level 3: d8 average 5 +2 Con)Subclass: Fiend PatronFeatures: Dark One's Blessing",
        "Level 4 · Warlock 4Hit points: +7 (Level 4: d8 average 5 +2 Con)Features: Ability Score ImprovementTook: +2 Charisma",
      ]),
    );
  });

  it("opens a feature's rules text from its name", async () => {
    const character = warlock();
    stubHistory(character);
    renderSeeded(character);

    fireEvent.click(await within(history()).findByRole("button", { name: "Dark One's Blessing" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Dark One's Blessing rules text.")).toBeVisible();
  });

  it("follows a level-up without a reload", async () => {
    const before = warlock(4);
    stubHistory(before);
    const client = renderSeeded(before);
    await waitFor(() => expect(rows()).toHaveLength(4));

    const after = warlock(5);
    stubHistory(after);
    client.setQueryData(characterKey(after.id), after);
    await client.invalidateQueries({ queryKey: characterKey(after.id) });

    await waitFor(() => expect(rows()[4]).toContain("Features: Pact Boon"));
    expect(rows()).toHaveLength(5);
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

    await waitFor(() => expect(rows()[0]).toContain("Hit points: unavailable"));
    expect(within(history()).getByText("Some class features could not load.")).toBeVisible();
  });
});
