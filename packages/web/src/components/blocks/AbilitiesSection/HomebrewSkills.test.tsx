import type { CharacterDefinition, CharacterDerived, CharacterRecord } from "@dnd/character";
import { QueryClient, QueryClientProvider, skipToken, useQuery } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterKey } from "../../../hooks/characterKeys.ts";
import { characterRecord, derivedRecord } from "../../../test/records.ts";
import { SaveToasts } from "../../SaveToasts.tsx";
import { AddHomebrewSkill } from "./AddHomebrewSkill.tsx";
import { CatalogSkills } from "./CatalogSkills.tsx";

type SkillProficiency = CharacterDefinition["proficiencies"]["skills"][number];

const SAILING = { name: "Sailing", source: "HB" };

const holding = (skills: SkillProficiency[]): CharacterRecord => {
  const record = characterRecord("1", "Vex");
  const { proficiencies } = record.definition;
  return {
    ...record,
    definition: { ...record.definition, proficiencies: { ...proficiencies, skills } },
  };
};

const homebrewRow = (name: string, edition: "classic" | "one") => ({
  id: name,
  name,
  edition,
  json: { name, source: "HB", ability: "wis" },
  createdAt: "2026-01-01T00:00:00.000Z",
});

/** A derived block that lists Sailing, with an item's advantage on it. */
const derivedFor = (record: CharacterRecord): CharacterDerived => {
  const derived = derivedRecord(record.definition);
  const modifier = { computed: 2, manual: null, terms: [] };
  return {
    ...derived,
    skills: [{ ref: SAILING, ability: "wis", modifier, passive: { ...modifier, computed: 12 } }],
    rollEffects: {
      computed: [{ source: "Compass", mode: "advantage", roll: "skill", target: "Sailing" }],
      manual: null,
      terms: [],
    },
  };
};

function Seeded({ children }: { children: (record: CharacterRecord) => ReactNode }) {
  const { data } = useQuery<CharacterRecord>({ queryKey: characterKey("1"), queryFn: skipToken });
  return data ? children(data) : null;
}

function renderSeeded(
  character: CharacterRecord,
  children: (record: CharacterRecord) => ReactNode,
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(characterKey("1"), character);
  return render(
    <QueryClientProvider client={client}>
      <Seeded>{children}</Seeded>
      <SaveToasts />
    </QueryClientProvider>,
  );
}

function stubServer(saved: CharacterRecord, homebrew: unknown[] = []) {
  const fetchMock = vi.fn(async (url: string, _init?: RequestInit) =>
    url === "/api/homebrew/skills"
      ? new Response(JSON.stringify(homebrew))
      : new Response(JSON.stringify(saved)),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const written = (fetchMock: ReturnType<typeof stubServer>) => {
  const init = fetchMock.mock.calls.find(([url]) => url === "/api/characters/1")?.[1];
  return init && JSON.parse(String(init.body));
};

afterEach(() => vi.unstubAllGlobals());

describe("a homebrew skill on the sheet", () => {
  const catalogSkills = (record: CharacterRecord) => (
    <CatalogSkills character={record} derived={derivedFor(record)} />
  );

  it("lists only on a character that holds it, and marks an item's advantage on its row", () => {
    stubServer(holding([]));
    const { unmount } = renderSeeded(holding([]), catalogSkills);
    expect(screen.queryByText("Sailing")).not.toBeInTheDocument();
    unmount();

    renderSeeded(holding([{ ref: SAILING, level: "none" }]), catalogSkills);
    const row = screen.getByText("Sailing").closest("li") as HTMLElement;
    expect(within(row).getByRole("button", { name: "Sailing check: Advantage" })).toBeVisible();
  });

  it("keeps the skill when its ring steps past expertise to none", async () => {
    const fetchMock = stubServer(holding([]));
    renderSeeded(holding([{ ref: SAILING, level: "expertise" }]), catalogSkills);

    fireEvent.click(screen.getByRole("button", { name: "Sailing proficiency: Expertise" }));

    await waitFor(() =>
      expect(written(fetchMock).proficiencies.skills).toEqual([{ ref: SAILING, level: "none" }]),
    );
  });

  it("removes the skill, and the overrides typed over it, from its detail", async () => {
    const saved = holding([]);
    const fetchMock = stubServer(saved);
    const record = holding([{ ref: SAILING, level: "none" }]);
    renderSeeded(
      {
        ...record,
        definition: {
          ...record.definition,
          overrides: { "skills.Sailing|HB.modifier": 9, armorClass: 20 },
        },
      },
      catalogSkills,
    );

    fireEvent.click(screen.getByRole("button", { name: "Sailing" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Sailing" }));

    await waitFor(() => expect(written(fetchMock)).toBeDefined());
    expect(written(fetchMock).proficiencies.skills).toEqual([]);
    expect(written(fetchMock).overrides).toEqual({ armorClass: 20 });
  });
});

describe("AddHomebrewSkill", () => {
  const add = (record: CharacterRecord) => <AddHomebrewSkill character={record} />;

  it("cites a homebrew skill of the character's edition at no proficiency", async () => {
    const fetchMock = stubServer(holding([]), [
      homebrewRow("Sailing", "one"),
      homebrewRow("Survival (Underdark)", "classic"),
    ]);
    renderSeeded(holding([]), add);

    fireEvent.click(await screen.findByRole("combobox", { name: "Homebrew skill" }));
    expect(screen.queryByRole("option", { name: "Survival (Underdark)" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: "Sailing" }));
    fireEvent.click(screen.getByRole("button", { name: "Add homebrew skill" }));

    await waitFor(() =>
      expect(written(fetchMock).proficiencies.skills).toEqual([{ ref: SAILING, level: "none" }]),
    );
  });

  it("offers nothing once the character holds every homebrew skill", async () => {
    const fetchMock = stubServer(holding([]), [homebrewRow("Sailing", "one")]);
    renderSeeded(holding([{ ref: SAILING, level: "none" }]), add);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/homebrew/skills", undefined));
    expect(screen.queryByRole("combobox", { name: "Homebrew skill" })).not.toBeInTheDocument();
  });
});
