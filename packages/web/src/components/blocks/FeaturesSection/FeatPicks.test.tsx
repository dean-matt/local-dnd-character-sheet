import type { CharacterDefinition, CharacterRecord } from "@dnd/character";
import { QueryClient, QueryClientProvider, skipToken, useQuery } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterKey } from "../../../hooks/characterKeys.ts";
import { characterRecord, derivedRecord } from "../../../test/records.ts";
import { FeatPicks } from "./FeatPicks.tsx";

const RESILIENT = { name: "Resilient", source: "XPHB" };
const SKILLED = { name: "Skilled", source: "XPHB" };
const EXPERT = { name: "Skill Expert", source: "XPHB" };
const LISTED_EXPERT = { name: "Lore Expert", source: "HB" };
const ARCANA = { name: "Arcana", source: "XPHB" };
const HISTORY = { name: "History", source: "XPHB" };

const FEATS = [
  {
    ...RESILIENT,
    edition: "one",
    json: {
      ...RESILIENT,
      ability: [{ choose: { from: ["str", "con"], amount: 1 } }],
      savingThrowProficiencies: [{ choose: { from: ["str", "con"] } }],
    },
  },
  {
    ...SKILLED,
    edition: "one",
    json: {
      ...SKILLED,
      skillToolLanguageProficiencies: [{ choose: [{ from: ["anySkill", "anyTool"], count: 2 }] }],
    },
  },
  { ...EXPERT, edition: "one", json: { ...EXPERT, expertise: [{ anyProficientSkill: 1 }] } },
  {
    ...LISTED_EXPERT,
    edition: "one",
    json: { ...LISTED_EXPERT, expertise: [{ choose: { from: ["arcana", "history"] } }] },
  },
];

type Feat = CharacterDefinition["feats"][number];

const holding = (feats: Feat[]): CharacterRecord => {
  const record = characterRecord("1", "Vex");
  return { ...record, definition: { ...record.definition, feats } };
};

const derivedFor = (record: CharacterRecord) => {
  const derived = derivedRecord(record.definition);
  const modifier = { computed: 0, manual: null, terms: [] };
  const skills = [ARCANA, HISTORY].map((ref) => ({
    ref,
    ability: "int" as const,
    modifier,
    passive: { ...modifier, computed: 10 },
  }));
  return { ...derived, skills };
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
    if (url.startsWith("/api/feats?")) return json({ items: FEATS, total: FEATS.length });
    if (url === "/api/characters/1/derived") return json(derivedFor(record));
    if (url.startsWith("/api/search?")) return json({ items: [], total: 0, limit: 200, offset: 0 });
    return new Response(JSON.stringify({ error: `nothing at ${url}` }), { status: 404 });
  });
  return writes;
}

function Seeded() {
  const { data } = useQuery<CharacterRecord>({ queryKey: characterKey("1"), queryFn: skipToken });
  return data ? <FeatPicks character={data} index={0} /> : null;
}

function renderSeeded(record: CharacterRecord, derived = derivedFor(record)) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(characterKey("1"), record);
  client.setQueryData([...characterKey("1"), "derived"], derived);
  render(
    <QueryClientProvider client={client}>
      <Seeded />
    </QueryClientProvider>,
  );
}

const pick = async (name: string | RegExp, option: string) => {
  fireEvent.click(await screen.findByRole("combobox", { name }));
  fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: option }));
};

const options = (name: string) => {
  const control = screen.getByRole("combobox", { name });
  fireEvent.click(control);
  const listed = within(screen.getByRole("listbox"))
    .queryAllByRole("option")
    .map((option) => option.textContent);
  fireEvent.keyDown(control, { key: "Escape" });
  return listed;
};

afterEach(() => vi.unstubAllGlobals());

describe("FeatPicks", () => {
  it("saves the saving throw picked, and the increase of a feat taken outside an improvement", async () => {
    const record = holding([{ ref: RESILIENT }]);
    const writes = stubApi(record);
    renderSeeded(record);

    await pick("Resilient saving throw", "Constitution");
    await waitFor(() =>
      expect(writes.at(-1)?.feats).toEqual([{ ref: RESILIENT, picks: { savingThrows: ["con"] } }]),
    );

    await pick("Resilient +1", "+1 Constitution");
    await waitFor(() =>
      expect(writes.at(-1)?.feats).toEqual([
        {
          ref: RESILIENT,
          picks: { savingThrows: ["con"], ability: [{ ability: "con", amount: 1 }] },
        },
      ]),
    );
  });

  it("leaves a feat taken at an improvement's increases to the improvement", async () => {
    const record = holding([{ ref: RESILIENT, level: 4 }]);
    stubApi(record);
    renderSeeded(record);

    expect(await screen.findByRole("combobox", { name: "Resilient saving throw" })).toBeVisible();
    expect(screen.queryByRole("combobox", { name: "Resilient +1" })).not.toBeInTheDocument();
  });

  it("offers any skill to each slot, but not one another slot holds", async () => {
    const record = holding([{ ref: SKILLED, picks: { skills: ["arcana"] } }]);
    stubApi(record);
    renderSeeded(record);

    expect(
      await screen.findByRole("combobox", { name: "Skilled skill or tool, 1 of 2" }),
    ).toHaveTextContent("Arcana");
    expect(options("Skilled skill or tool, 2 of 2")).toEqual(["History"]);
  });

  it.each([
    ["of any", EXPERT],
    ["from a list", LISTED_EXPERT],
  ])("offers expertise %s only in a skill held at proficient or better", async (_, feat) => {
    const base = holding([{ ref: feat }]);
    const record = {
      ...base,
      definition: {
        ...base.definition,
        proficiencies: {
          ...base.definition.proficiencies,
          skills: [
            { ref: ARCANA, level: "half" as const },
            { ref: HISTORY, level: "proficient" as const },
          ],
        },
      },
    };
    stubApi(record);
    renderSeeded(record);

    await screen.findByRole("combobox", { name: `${feat.name} expertise` });
    expect(options(`${feat.name} expertise`)).toEqual(["History"]);
  });

  it("caps an increase by the scores alone, leaving out what an equipped item sets", async () => {
    const record = holding([{ ref: RESILIENT }]);
    stubApi(record);
    const derived = derivedFor(record);
    const belted = {
      ...derived,
      abilityScores: {
        ...derived.abilityScores,
        str: { ...derived.abilityScores.str, computed: 21 },
      },
    };
    renderSeeded(record, belted);

    await screen.findByRole("combobox", { name: "Resilient +1" });
    expect(options("Resilient +1")).toContain("+1 Strength");
  });
});
