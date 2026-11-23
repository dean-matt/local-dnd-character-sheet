import type { CharacterSpells } from "@dnd/catalog";
import type { CharacterDefinition, CharacterRecord } from "@dnd/character";
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
) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/characters/1/spells") return json(sheet);
    if (url in granted) return json(granted[url]);
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
      <OwedSpellPicks character={record} />
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
});
