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

type Granted = CharacterDerived["featGrants"]["computed"]["skills"];

const derivedFor = (record: CharacterRecord, granted: Granted): CharacterDerived => {
  const derived = derivedRecord(record.definition);
  const modifier = { computed: 2, manual: null, terms: [] };
  const passive = { ...modifier, computed: 12 };
  return {
    ...derived,
    featGrants: {
      ...derived.featGrants,
      computed: { ...derived.featGrants.computed, skills: granted },
    },
    skills: [STEALTH, ARCANA, PERCEPTION].map((ref) => ({
      ref,
      ability: "dex",
      modifier,
      passive,
    })),
  };
};

function Seeded({ granted }: { granted: Granted }) {
  const { data } = useQuery<CharacterRecord>({ queryKey: characterKey("1"), queryFn: skipToken });
  return data ? <CatalogSkills character={data} derived={derivedFor(data, granted)} /> : null;
}

function renderSeeded(character: CharacterRecord, granted: Granted = []) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(characterKey("1"), character);
  return render(
    <QueryClientProvider client={client}>
      <Seeded granted={granted} />
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

  it("shows a feat's skill at the level it grants, and steps on from there, marking expertise over the grant", async () => {
    const fetchMock = stubServer(new Response(JSON.stringify(holding([]))));
    renderSeeded(holding([{ ref: STEALTH, level: "expertise" }]), [
      { ref: PERCEPTION, level: "proficient", from: ["Observant"] },
      { ref: STEALTH, level: "proficient", from: ["Skulker"] },
    ]);

    expect(screen.getByRole("button", { name: "Stealth proficiency: Expertise" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Perception proficiency: Proficient" }));

    await waitFor(() =>
      expect(written(fetchMock)).toEqual([
        { ref: STEALTH, level: "expertise" },
        { ref: PERCEPTION, level: "expertise", onGrant: true },
      ]),
    );
  });

  it("says when the change fails to save", async () => {
    stubServer(new Response(JSON.stringify({ error: "disk full" }), { status: 500 }));
    renderSeeded(holding([]));

    fireEvent.click(screen.getByRole("button", { name: "Arcana proficiency: Not proficient" }));

    expect(await saveToasts().findByText(/^Skill proficiency: Couldn't save/)).toBeInTheDocument();
    expect(saveToasts().getByRole("button", { name: /^Retry / })).toBeInTheDocument();
  });

  it("keeps a failed skill's toast through another skill's save, and Retry writes the failed one", async () => {
    const stealth: SkillProficiency = { ref: STEALTH, level: "proficient" };
    const arcana: SkillProficiency = { ref: ARCANA, level: "proficient" };
    const replies = [
      new Response(JSON.stringify({ error: "disk full" }), { status: 500 }),
      new Response(JSON.stringify(holding([stealth]))),
      new Response(JSON.stringify(holding([stealth, arcana]))),
    ];
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => replies.shift());
    vi.stubGlobal("fetch", fetchMock);
    renderSeeded(holding([]));

    fireEvent.click(screen.getByRole("button", { name: "Arcana proficiency: Not proficient" }));
    await saveToasts().findByText(/^Skill proficiency: Couldn't save/);
    fireEvent.click(screen.getByRole("button", { name: "Stealth proficiency: Not proficient" }));
    await screen.findByRole("button", { name: "Stealth proficiency: Proficient" });

    expect(saveToasts().getByText(/^Skill proficiency: Couldn't save/)).toBeInTheDocument();
    fireEvent.click(saveToasts().getByRole("button", { name: "Retry Skill proficiency" }));

    await waitFor(() =>
      expect(saveToasts().queryByText(/^Skill proficiency: Couldn't save/)).toBeNull(),
    );
    const retried = fetchMock.mock.calls[2]?.[1];
    expect(JSON.parse(String(retried?.body)).proficiencies.skills).toEqual([stealth, arcana]);
  });

  it("raises a dismissed toast again when the next change fails the same way", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "disk full" }), { status: 500 })),
    );
    renderSeeded(holding([]));
    fireEvent.click(screen.getByRole("button", { name: "Arcana proficiency: Not proficient" }));
    fireEvent.click(await saveToasts().findByRole("button", { name: "Dismiss Skill proficiency" }));

    fireEvent.click(screen.getByRole("button", { name: "Stealth proficiency: Not proficient" }));

    expect(await saveToasts().findByText(/^Skill proficiency: Couldn't save/)).toBeInTheDocument();
  });
});
