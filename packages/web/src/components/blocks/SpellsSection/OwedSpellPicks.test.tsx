import type { CharacterSpells } from "@dnd/catalog";
import type { CharacterDefinition, CharacterDerived, CharacterRecord } from "@dnd/character";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterKey } from "../../../hooks/characterKeys.ts";
import { characterRecord } from "../../../test/records.ts";
import { OwedSpellPicks } from "./OwedSpellPicks.tsx";

const WARLOCK = { name: "Warlock", source: "PHB" };
const TOME = { name: "Pact of the Tome", source: "PHB" };
const INITIATE = { name: "Magic Initiate", source: "PHB" };

const json = (value: unknown) => new Response(JSON.stringify(value));
const offer = (picks: Partial<Record<"cantrips" | "spells", number>>, blocks: string[] = []) => ({
  spells: [],
  blocks,
  picks: { cantrips: 0, spells: 0, learned: 0, alternatives: blocks.length > 0, ...picks },
});

function holding(definition: Partial<CharacterDefinition>): CharacterRecord {
  const base = characterRecord("1", "Vex");
  return {
    ...base,
    edition: "classic",
    definition: {
      ...base.definition,
      edition: "classic",
      levels: [{ class: WARLOCK }],
      ...definition,
    },
  };
}

const tomePick = () =>
  holding({
    optionalFeatures: [
      { ref: TOME, featureType: "PB", grantedBy: { kind: "class", ref: WARLOCK }, level: 3 },
    ],
  });

/** Answers the grants by `granted`, the spells read with `sheet`, any search with Mage Hand, and a write with the record. */
function renderOwed(
  record: CharacterRecord,
  granted: Record<string, unknown>,
  sheet: CharacterSpells,
  sheetLoads = false,
  derived: Pick<CharacterDerived, "spellSlots" | "pactSlots"> = { spellSlots: [], pactSlots: null },
) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/characters/1/spells") {
      return sheetLoads ? new Promise<Response>(() => {}) : json(sheet);
    }
    if (url in granted) return json(granted[url]);
    if (url.startsWith("/api/spells/granted")) return new Response("no", { status: 400 });
    if (url.startsWith("/api/search")) {
      const hit = { type: "spell", name: "Mage Hand", source: "PHB", edition: "classic" };
      return json({ items: [hit], total: 1, limit: 200, offset: 0 });
    }
    return json({ ...record, definition: JSON.parse(String(init?.body)) });
  });
  vi.stubGlobal("fetch", fetchMock);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(characterKey(record.id), record);
  render(
    <QueryClientProvider client={client}>
      <OwedSpellPicks character={record} derived={derived} />
    </QueryClientProvider>,
  );
  return fetchMock;
}

const written = (fetchMock: ReturnType<typeof renderOwed>): CharacterDefinition | undefined => {
  const put = fetchMock.mock.calls.find(
    ([url, init]) => url === "/api/characters/1" && init?.method === "PUT",
  );
  return put && JSON.parse(String(put[1]?.body));
};

const TOME_GRANTS = {
  "/api/spells/granted?grantor=optionalFeature&name=Pact+of+the+Tome&source=PHB&level=1": offer({
    cantrips: 3,
  }),
};

afterEach(() => vi.unstubAllGlobals());

describe("OwedSpellPicks", () => {
  it("offers the cantrips an optional feature taken later leaves to a pick, and stores one under it", async () => {
    const fetchMock = renderOwed(tomePick(), TOME_GRANTS, { spells: [] });

    fireEvent.focus(await screen.findByRole("combobox", { name: /cantrip/i }));
    fireEvent.click(await screen.findByRole("option", { name: /Mage Hand/ }));

    await waitFor(() => expect(written(fetchMock)).toBeDefined());
    expect(written(fetchMock)?.spells).toEqual([
      {
        ref: { name: "Mage Hand", source: "PHB" },
        prepared: true,
        pickedFor: { kind: "optionalFeature", ref: TOME },
      },
    ]);
  });

  it("names the feature the picks come from and how many it offers", async () => {
    renderOwed(tomePick(), TOME_GRANTS, { spells: [] });

    expect(await screen.findByText("Cantrips from Pact of the Tome")).toBeInTheDocument();
    expect(screen.getByText("Choose 3 — 0 selected")).toBeInTheDocument();
  });

  it("draws nothing once every pick it owes is made", async () => {
    const pickedFor = { kind: "optionalFeature" as const, ref: TOME };
    const picks = ["Mage Hand", "Light", "Prestidigitation"];
    const record = tomePick();
    record.definition.spells = picks.map((name) => ({
      ref: { name, source: "PHB" },
      prepared: true,
      pickedFor,
    }));
    const sheet = {
      spells: picks.map((name) => ({
        resolved: true as const,
        name,
        source: "PHB",
        prepared: true,
        level: 0,
        school: "V",
        concentration: false,
        ritual: false,
        entries: [],
        pickedFor,
      })),
    };
    const fetchMock = renderOwed(record, TOME_GRANTS, sheet);

    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/spells/granted"))).toBe(
        true,
      ),
    );
    await waitFor(() => expect(screen.queryByText("Spell Picks")).toBeNull());
    expect(screen.queryByText("Cantrips from Pact of the Tome")).toBeNull();
  });

  it("asks which class a feat's spells come from before offering its picks", async () => {
    const record = holding({ feats: [{ ref: INITIATE }] });
    const granted = {
      "/api/spells/granted?grantor=feat&name=Magic+Initiate&source=PHB&level=1": offer(
        { cantrips: 2, spells: 1 },
        ["Bard Spells", "Cleric Spells"],
      ),
    };
    const fetchMock = renderOwed(record, granted, { spells: [] });

    fireEvent.click(await screen.findByRole("button", { name: "Cleric Spells" }));

    await waitFor(() => expect(written(fetchMock)).toBeDefined());
    expect(written(fetchMock)?.spellBlocks).toEqual([
      { grantor: { kind: "feat", ref: INITIATE }, block: 1 },
    ]);
    expect(screen.queryByText("Cantrips from Magic Initiate")).toBeNull();
  });

  it("draws nothing while the character's spells load, so picks made are not shown as owed", async () => {
    const record = tomePick();
    const fetchMock = renderOwed(record, TOME_GRANTS, { spells: [] }, true);

    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/spells/granted"))).toBe(
        true,
      ),
    );
    expect(screen.queryByText("Spell Picks")).toBeNull();
  });

  it("removes a pick and keeps the others", async () => {
    const pickedFor = { kind: "optionalFeature" as const, ref: TOME };
    const record = tomePick();
    record.definition.spells = ["Mage Hand", "Light"].map((name) => ({
      ref: { name, source: "PHB" },
      prepared: true,
      pickedFor,
    }));
    const sheet = {
      spells: ["Mage Hand", "Light"].map((name) => ({
        resolved: true as const,
        name,
        source: "PHB",
        prepared: true,
        level: 0,
        school: "V",
        concentration: false,
        ritual: false,
        entries: [],
        pickedFor,
      })),
    };
    const fetchMock = renderOwed(record, TOME_GRANTS, sheet);

    fireEvent.click(await screen.findByRole("button", { name: "Remove Mage Hand" }));

    await waitFor(() => expect(written(fetchMock)).toBeDefined());
    expect(written(fetchMock)?.spells.map(({ ref }) => ("name" in ref ? ref.name : ""))).toEqual([
      "Light",
    ]);
  });

  it("refuses a spell the character knows already and writes nothing", async () => {
    const record = tomePick();
    record.definition.spells = [{ ref: { name: "Mage Hand", source: "PHB" }, prepared: true }];
    const fetchMock = renderOwed(record, TOME_GRANTS, { spells: [] });

    fireEvent.focus(await screen.findByRole("combobox", { name: /cantrip/i }));
    const option = await screen.findByRole("option", { name: /Mage Hand/ });
    expect(option).toHaveTextContent("Known already");
    fireEvent.click(option);

    expect(written(fetchMock)).toBeUndefined();
  });

  it("says so when the offered spells cannot be looked up", async () => {
    renderOwed(tomePick(), {}, { spells: [] });
    expect(await screen.findByText(/Couldn't look up the spells/)).toBeInTheDocument();
  });

  describe("a class feature that has the player pick spells", () => {
    const ARCANUM = { name: "Mystic Arcanum (6th level)", source: "PHB" };

    it("offers nothing before the class reaches the feature", async () => {
      const record = holding({ levels: Array.from({ length: 10 }, () => ({ class: WARLOCK })) });
      const fetchMock = renderOwed(record, {}, { spells: [] });

      await waitFor(() =>
        expect(fetchMock.mock.calls.some(([url]) => url === "/api/characters/1/spells")).toBe(true),
      );
      expect(screen.queryByText("Spell Picks")).toBeNull();
    });

    it("offers a level 6 pick from the class's list at level 11, and stores it under the feature", async () => {
      const record = holding({ levels: Array.from({ length: 11 }, () => ({ class: WARLOCK })) });
      const fetchMock = renderOwed(record, {}, { spells: [] });

      expect(
        await screen.findByText("Level 6 spells from Mystic Arcanum (6th level), level 11"),
      ).toBeInTheDocument();
      fireEvent.focus(screen.getByRole("combobox", { name: /spell/i }));
      fireEvent.click(await screen.findByRole("option", { name: /Mage Hand/ }));

      await waitFor(() => expect(written(fetchMock)).toBeDefined());
      expect(written(fetchMock)?.spells).toEqual([
        {
          ref: { name: "Mage Hand", source: "PHB" },
          prepared: true,
          origin: WARLOCK,
          pickedFor: {
            kind: "classFeature",
            ref: ARCANUM,
            class: WARLOCK,
            level: 11,
          },
        },
      ]);
      const search = fetchMock.mock.calls
        .map(([url]) => String(url))
        .find((url) => url.startsWith("/api/search"));
      expect(search).toContain("class=Warlock%7CPHB");
      expect(search).toContain("minLevel=6");
      expect(search).toContain("maxLevel=6");
    });

    it("marks a spell the wizard already knows where the feature picks from the spellbook", async () => {
      const WIZARD = { name: "Wizard", source: "PHB" };
      const hand = { name: "Mage Hand", source: "PHB" };
      const record = holding({
        levels: Array.from({ length: 18 }, () => ({ class: WIZARD })),
        spells: [{ ref: hand, prepared: false }],
      });
      const fetchMock = renderOwed(record, {}, { spells: [] });

      await screen.findByText("Level 1 spells from Spell Mastery, level 18");
      fireEvent.focus(screen.getAllByRole("combobox", { name: /spell/i })[0] as HTMLElement);
      fireEvent.click(await screen.findByRole("option", { name: /Mage Hand/ }));

      await waitFor(() => expect(written(fetchMock)).toBeDefined());
      expect(written(fetchMock)?.spells).toEqual([
        {
          ref: hand,
          prepared: false,
          pickedFor: {
            kind: "classFeature",
            ref: { name: "Spell Mastery", source: "PHB" },
            class: WIZARD,
            level: 18,
          },
        },
      ]);
    });

    it("offers a pick with no level any spell up to the highest slot level, and stores it under the feature", async () => {
      const BARD = { name: "Bard", source: "PHB" };
      const record = holding({ levels: Array.from({ length: 10 }, () => ({ class: BARD })) });
      const fetchMock = renderOwed(record, {}, { spells: [] }, false, {
        spellSlots: [
          { level: 1, total: 4, used: 0 },
          { level: 5, total: 2, used: 0 },
        ],
        pactSlots: null,
      } as unknown as Pick<CharacterDerived, "spellSlots" | "pactSlots">);

      expect(await screen.findByText("Spells from Magical Secrets, level 10")).toBeInTheDocument();
      fireEvent.focus(screen.getAllByRole("combobox", { name: /spell/i })[0] as HTMLElement);
      fireEvent.click(await screen.findByRole("option", { name: /Mage Hand/ }));

      await waitFor(() => expect(written(fetchMock)).toBeDefined());
      expect(written(fetchMock)?.spells[0]).toMatchObject({
        origin: BARD,
        pickedFor: { kind: "classFeature", class: BARD, level: 10 },
      });
      const search = fetchMock.mock.calls
        .map(([url]) => String(url))
        .find((url) => url.startsWith("/api/search"));
      expect(search).toContain("minLevel=0");
      expect(search).toContain("maxLevel=5");
      expect(search).not.toContain("class=");
    });

    it("removes a Magical Secrets pick, which leaves the other owed", async () => {
      const hand = { name: "Mage Hand", source: "PHB" };
      const BARD = { name: "Bard", source: "PHB" };
      const pickedFor = {
        kind: "classFeature" as const,
        ref: { name: "Magical Secrets", source: "PHB" },
        class: BARD,
        level: 10,
      };
      const record = holding({
        levels: Array.from({ length: 10 }, () => ({ class: BARD })),
        spells: [{ ref: hand, prepared: true, origin: BARD, pickedFor }],
      });
      const sheet = {
        spells: [
          {
            resolved: true as const,
            name: "Mage Hand",
            source: "PHB",
            prepared: true,
            level: 0,
            school: "V",
            concentration: false,
            ritual: false,
            entries: [],
            pickedFor: { kind: pickedFor.kind, ref: pickedFor.ref },
          },
        ],
      };
      const fetchMock = renderOwed(record, {}, sheet);
      fireEvent.click(await screen.findByRole("button", { name: "Remove Mage Hand" }));

      await waitFor(() => expect(written(fetchMock)).toBeDefined());
      expect(written(fetchMock)?.spells).toEqual([]);
    });

    it("unmarks a spellbook spell and keeps it known", async () => {
      const WIZARD = { name: "Wizard", source: "PHB" };
      const hand = { name: "Mage Hand", source: "PHB" };
      const pickedFor = {
        kind: "classFeature" as const,
        ref: { name: "Signature Spells", source: "PHB" },
        class: WIZARD,
        level: 20,
      };
      const record = holding({
        levels: Array.from({ length: 20 }, () => ({ class: WIZARD })),
        spells: [{ ref: hand, prepared: false, pickedFor }],
      });
      const sheet = {
        spells: [
          {
            resolved: true as const,
            name: "Mage Hand",
            source: "PHB",
            prepared: false,
            level: 3,
            school: "V",
            concentration: false,
            ritual: false,
            entries: [],
            pickedFor: { kind: pickedFor.kind, ref: pickedFor.ref },
          },
        ],
      };
      const fetchMock = renderOwed(record, {}, sheet);

      fireEvent.click(await screen.findByRole("button", { name: "Remove Mage Hand" }));

      await waitFor(() => expect(written(fetchMock)).toBeDefined());
      expect(written(fetchMock)?.spells).toEqual([{ ref: hand, prepared: false }]);
    });
  });
});
