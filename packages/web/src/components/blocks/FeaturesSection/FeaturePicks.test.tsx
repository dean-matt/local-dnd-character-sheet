import type { SheetFeature } from "@dnd/catalog";
import type { CharacterDefinition, CharacterRecord } from "@dnd/character";
import { QueryClient, QueryClientProvider, skipToken, useQuery } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterKey } from "../../../hooks/characterKeys.ts";
import { characterRecord, derivedRecord } from "../../../test/records.ts";
import { FeaturePicks } from "./FeaturePicks.tsx";

const ARCANA = { name: "Arcana", source: "XPHB" };
const HISTORY = { name: "History", source: "XPHB" };
const EXPERTISE = {
  name: "Expertise",
  source: "PHB",
  className: "Rogue",
  classSource: "PHB",
  level: 1,
};
const PICKS: NonNullable<SheetFeature["picks"]> = {
  feature: EXPERTISE,
  offers: [{ fields: ["expertise"], count: 2, from: null }],
};

const base = (): CharacterRecord => {
  const record = characterRecord("1", "Vex");
  return {
    ...record,
    definition: {
      ...record.definition,
      proficiencies: {
        ...record.definition.proficiencies,
        skills: [
          { ref: ARCANA, level: "proficient" },
          { ref: HISTORY, level: "proficient" },
        ],
      },
    },
  };
};

const derivedFor = (record: CharacterRecord) => {
  const modifier = { computed: 0, manual: null, terms: [] };
  const skills = [ARCANA, HISTORY].map((ref) => ({
    ref,
    ability: "int" as const,
    modifier,
    passive: { ...modifier, computed: 10 },
  }));
  return { ...derivedRecord(record.definition), skills };
};

function stubApi(record: CharacterRecord) {
  const writes: CharacterDefinition[] = [];
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
    if (init?.method === "PUT") {
      const definition = JSON.parse(String(init.body)) as CharacterDefinition;
      writes.push(definition);
      return json({ ...record, definition });
    }
    if (url.startsWith("/api/search?")) return json({ items: [], total: 0, limit: 200, offset: 0 });
    return new Response(JSON.stringify({ error: `nothing at ${url}` }), { status: 404 });
  });
  return writes;
}

function Seeded() {
  const { data } = useQuery<CharacterRecord>({ queryKey: characterKey("1"), queryFn: skipToken });
  return data ? <FeaturePicks character={data} name="Expertise" picks={PICKS} /> : null;
}

function renderSeeded(record: CharacterRecord) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(characterKey("1"), record);
  client.setQueryData([...characterKey("1"), "derived"], derivedFor(record));
  render(
    <QueryClientProvider client={client}>
      <Seeded />
    </QueryClientProvider>,
  );
}

const pick = async (name: string, option: string) => {
  fireEvent.click(await screen.findByRole("combobox", { name }));
  fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: option }));
};

afterEach(() => vi.unstubAllGlobals());

describe("FeaturePicks", () => {
  it("saves each skill picked under the feature's key", async () => {
    const record = base();
    const writes = stubApi(record);
    renderSeeded(record);

    await pick("Expertise expertise, 1 of 2", "Arcana");
    await waitFor(() =>
      expect(writes.at(-1)?.featureChoices).toEqual([
        { feature: EXPERTISE, options: [], picks: { expertise: ["arcana"] } },
      ]),
    );
  });

  it("does not offer a skill the other slot holds", async () => {
    const record = base();
    record.definition.featureChoices = [
      { feature: EXPERTISE, options: [], picks: { expertise: ["arcana"] } },
    ];
    stubApi(record);
    renderSeeded(record);

    const control = await screen.findByRole("combobox", { name: "Expertise expertise, 2 of 2" });
    fireEvent.click(control);
    expect(
      within(screen.getByRole("listbox"))
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["History"]);
  });
});
