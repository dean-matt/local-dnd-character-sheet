import type { CharacterDefinition, CharacterDerived, CharacterRecord } from "@dnd/character";
import { QueryClient, QueryClientProvider, skipToken, useQuery } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterKey } from "../../../hooks/characterKeys.ts";
import { characterRecord, derivedRecord } from "../../../test/records.ts";
import { CustomSkills } from "./CustomSkills.tsx";

type CustomSkill = CharacterDefinition["customSkills"][number];

const JUGGLING: CustomSkill = { name: "Juggling", ability: "dex", level: "none" };
const CARTOGRAPHY: CustomSkill = { name: "Cartography", flat: 3, level: "proficient" };

const holding = (customSkills: CustomSkill[]): CharacterRecord => {
  const record = characterRecord("1", "Vex");
  return { ...record, definition: { ...record.definition, customSkills } };
};

/** The derived block for `record`, with Stealth standing in for the catalog's skills. */
const derivedFor = (record: CharacterRecord): CharacterDerived => {
  const derived = derivedRecord(record.definition);
  const modifier = { computed: 2, manual: null, terms: [] };
  return {
    ...derived,
    skills: [
      {
        ref: { name: "Stealth", source: "XPHB" },
        ability: "dex",
        modifier,
        passive: { ...modifier, computed: 12 },
      },
    ],
  };
};

function Seeded() {
  const { data } = useQuery<CharacterRecord>({ queryKey: characterKey("1"), queryFn: skipToken });
  return data ? <CustomSkills character={data} derived={derivedFor(data)} /> : null;
}

function renderSeeded(character: CharacterRecord) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(characterKey("1"), character);
  return render(
    <QueryClientProvider client={client}>
      <Seeded />
    </QueryClientProvider>,
  );
}

function stubServer(saved: CharacterRecord) {
  const fetchMock = vi.fn(
    async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(saved)),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const written = (fetchMock: ReturnType<typeof stubServer>) => {
  const init = fetchMock.mock.calls.find(([url]) => url === "/api/characters/1")?.[1];
  return init && JSON.parse(String(init.body)).customSkills;
};

function addSkill(name: string, ability?: string) {
  fireEvent.change(screen.getByRole("textbox", { name: "Custom skill" }), {
    target: { value: name },
  });
  if (ability) {
    fireEvent.click(screen.getByRole("combobox", { name: "New skill base" }));
    fireEvent.click(screen.getByRole("option", { name: ability }));
  }
  fireEvent.click(screen.getByRole("button", { name: "Add" }));
}

afterEach(() => vi.unstubAllGlobals());

describe("CustomSkills", () => {
  it("adds a skill with its ability, unproficient", async () => {
    const fetchMock = stubServer(holding([]));
    renderSeeded(holding([]));

    addSkill("  Juggling ", "DEX");

    await waitFor(() => expect(written(fetchMock)).toEqual([JUGGLING]));
    expect(screen.getByRole("textbox", { name: "Custom skill" })).toHaveValue("");
  });

  it("shows a skill's ability and derived bonus as a catalog skill's row does", () => {
    renderSeeded(holding([JUGGLING]));

    const row = screen.getByRole("list", { name: "Custom skills" });
    expect(row).toHaveTextContent("Juggling");
    expect(row).toHaveTextContent("Dexterity");
    expect(row).toHaveTextContent("+3");
  });

  it("adds a flat skill starting at zero", async () => {
    const fetchMock = stubServer(holding([]));
    renderSeeded(holding([]));

    addSkill("Cartography", "Flat bonus");

    await waitFor(() =>
      expect(written(fetchMock)).toEqual([{ name: "Cartography", flat: 0, level: "none" }]),
    );
  });

  it("shows FLAT where an ability skill shows its ability, and its value plus proficiency", () => {
    renderSeeded(holding([CARTOGRAPHY]));

    const row = screen.getByRole("list", { name: "Custom skills" });
    expect(row).toHaveTextContent("flat");
    expect(row).toHaveTextContent("Flat bonus");
    expect(row).toHaveTextContent("+5");
  });

  it("saves an edit to a flat skill's value", async () => {
    const fetchMock = stubServer(holding([]));
    renderSeeded(holding([JUGGLING, CARTOGRAPHY]));

    const input = screen.getByRole("textbox", { name: "Cartography flat bonus" });
    expect(input).toHaveValue("3");
    fireEvent.change(input, { target: { value: "-2" } });
    fireEvent.blur(input);

    await waitFor(() =>
      expect(written(fetchMock)).toEqual([JUGGLING, { ...CARTOGRAPHY, flat: -2 }]),
    );
  });

  it("refuses a name a catalog skill or another custom skill holds, saying why", () => {
    const fetchMock = stubServer(holding([]));
    renderSeeded(holding([JUGGLING]));

    addSkill("stealth");
    expect(screen.getByRole("alert")).toHaveTextContent("Stealth is already a skill.");

    addSkill("JUGGLING");
    expect(screen.getByRole("alert")).toHaveTextContent("Juggling is already a custom skill.");
    expect(written(fetchMock)).toBeUndefined();
  });

  it("moves the proficiency on through proficient and expertise back to none", async () => {
    const fetchMock = stubServer(holding([]));
    renderSeeded(holding([{ ...JUGGLING, level: "expertise" }]));

    fireEvent.click(screen.getByRole("button", { name: "Juggling proficiency: Expertise" }));

    await waitFor(() => expect(written(fetchMock)).toEqual([JUGGLING]));
  });

  it("removes a skill and its override, so a skill added under its name starts computed", async () => {
    const fetchMock = stubServer(holding([]));
    const record = holding([JUGGLING, { ...JUGGLING, name: "Cooking" }]);
    renderSeeded({
      ...record,
      definition: {
        ...record.definition,
        overrides: { "customSkills.Juggling.modifier": 9, "customSkills.Cooking.modifier": 4 },
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "Remove Juggling" }));

    await waitFor(() => expect(written(fetchMock)).toEqual([{ ...JUGGLING, name: "Cooking" }]));
    const init = fetchMock.mock.calls.find(([url]) => url === "/api/characters/1")?.[1];
    expect(JSON.parse(String(init?.body)).overrides).toEqual({
      "customSkills.Cooking.modifier": 4,
    });
  });

  it("says when a change did not save", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "disk full" }), { status: 500 })),
    );
    renderSeeded(holding([JUGGLING]));

    fireEvent.click(screen.getByRole("button", { name: "Remove Juggling" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't save the custom skills");
  });
});
