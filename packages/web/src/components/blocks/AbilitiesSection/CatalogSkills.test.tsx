import type { CharacterDefinition, CharacterDerived, CharacterRecord } from "@dnd/character";
import { QueryClient, QueryClientProvider, skipToken, useQuery } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterKey } from "../../../hooks/characterKeys.ts";
import { characterRecord, derivedRecord } from "../../../test/records.ts";
import { saveToasts } from "../../../test/saveToasts.ts";
import { SaveToasts } from "../../SaveToasts.tsx";
import { CatalogSkills } from "./CatalogSkills.tsx";

type SkillProficiency = CharacterDefinition["proficiencies"]["skills"][number];

const STEALTH = { name: "Stealth", source: "XPHB" };
const ARCANA = { name: "Arcana", source: "XPHB" };
const PERCEPTION = { name: "Perception", source: "XPHB" };

const holding = (skills: SkillProficiency[]): CharacterRecord => {
  const record = characterRecord("1", "Vex");
  const { proficiencies } = record.definition;
  return {
    ...record,
    definition: { ...record.definition, proficiencies: { ...proficiencies, skills } },
  };
};

const derivedFor = (record: CharacterRecord): CharacterDerived => {
  const derived = derivedRecord(record.definition);
  const modifier = { computed: 2, manual: null, terms: [] };
  const passive = { ...modifier, computed: 12 };
  return {
    ...derived,
    skills: [STEALTH, ARCANA, PERCEPTION].map((ref) => ({
      ref,
      ability: "dex",
      modifier,
      passive,
    })),
  };
};

function Seeded() {
  const { data } = useQuery<CharacterRecord>({ queryKey: characterKey("1"), queryFn: skipToken });
  return data ? <CatalogSkills character={data} derived={derivedFor(data)} /> : null;
}

function renderSeeded(character: CharacterRecord) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(characterKey("1"), character);
  return render(
    <QueryClientProvider client={client}>
      <Seeded />
      <SaveToasts />
    </QueryClientProvider>,
  );
}

function stubServer(response: Response) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const written = (fetchMock: ReturnType<typeof stubServer>) => {
  const init = fetchMock.mock.calls.find(([url]) => url === "/api/characters/1")?.[1];
  return init && JSON.parse(String(init.body)).proficiencies.skills;
};

afterEach(() => vi.unstubAllGlobals());

describe("CatalogSkills", () => {
  it("names each ring by its skill and current level", () => {
    renderSeeded(holding([{ ref: STEALTH, level: "expertise" }]));

    expect(screen.getByRole("button", { name: "Stealth proficiency: Expertise" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Arcana proficiency: Not proficient" }),
    ).toBeVisible();
  });

  it("adds an unheld skill as proficient and leaves the others as they were", async () => {
    const held: SkillProficiency = { ref: STEALTH, level: "expertise" };
    const fetchMock = stubServer(new Response(JSON.stringify(holding([]))));
    renderSeeded(holding([held]));

    fireEvent.click(screen.getByRole("button", { name: "Perception proficiency: Not proficient" }));

    await waitFor(() =>
      expect(written(fetchMock)).toEqual([held, { ref: PERCEPTION, level: "proficient" }]),
    );
  });

  it("steps proficient to expertise", async () => {
    const fetchMock = stubServer(new Response(JSON.stringify(holding([]))));
    renderSeeded(holding([{ ref: ARCANA, level: "proficient" }]));

    fireEvent.click(screen.getByRole("button", { name: "Arcana proficiency: Proficient" }));

    await waitFor(() => expect(written(fetchMock)).toEqual([{ ref: ARCANA, level: "expertise" }]));
  });

  it("drops a skill held at expertise once its ring steps to none", async () => {
    const fetchMock = stubServer(new Response(JSON.stringify(holding([]))));
    renderSeeded(holding([{ ref: ARCANA, level: "expertise" }]));

    fireEvent.click(screen.getByRole("button", { name: "Arcana proficiency: Expertise" }));

    await waitFor(() => expect(written(fetchMock)).toEqual([]));
  });

  it("replaces a feature's half proficiency with proficient", async () => {
    const fetchMock = stubServer(new Response(JSON.stringify(holding([]))));
    renderSeeded(holding([{ ref: ARCANA, level: "half" }]));

    fireEvent.click(screen.getByRole("button", { name: "Arcana proficiency: Half proficiency" }));

    await waitFor(() => expect(written(fetchMock)).toEqual([{ ref: ARCANA, level: "proficient" }]));
  });

  it("says when the change fails to save", async () => {
    stubServer(new Response(JSON.stringify({ error: "disk full" }), { status: 500 }));
    renderSeeded(holding([]));

    fireEvent.click(screen.getByRole("button", { name: "Arcana proficiency: Not proficient" }));

    expect(await saveToasts().findByText(/^Skill proficiency: Couldn't save/)).toBeInTheDocument();
    expect(saveToasts().getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
