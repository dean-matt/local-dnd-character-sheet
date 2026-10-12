import type { CharacterDefinition, CharacterDerived, CharacterRecord } from "@dnd/character";
import { QueryClient, QueryClientProvider, skipToken, useQuery } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

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

  it("shows FLAT and the bonus on a flat skill's row, with no field there", () => {
    renderSeeded(holding([CARTOGRAPHY]));

    const row = screen.getByRole("listitem");
    expect(row).toHaveTextContent("flat");
    expect(row).toHaveTextContent("Flat bonus");
    expect(row).toHaveTextContent("+5");
    expect(within(row).queryByRole("textbox")).toBeNull();
  });

  it("sets a flat skill's base in its modal's footer beside Remove, below the terms", () => {
    renderSeeded(holding([CARTOGRAPHY]));

    fireEvent.click(screen.getByRole("button", { name: "Cartography" }));
    const modal = within(screen.getByRole("dialog", { name: "Cartography" }));
    const terms = within(modal.getByRole("region", { name: "Cartography" }));
    expect(terms.getByText("Proficiency")).toBeVisible();
    expect(terms.queryByRole("textbox")).toBeNull();
    const field = modal.getByRole("textbox", { name: "Cartography flat bonus" });
    expect(field).toHaveValue("3");
    const remove = modal.getByRole("button", { name: "Remove Cartography" });
    expect(terms.queryByRole("button", { name: "Remove Cartography" })).toBeNull();
    expect(field.compareDocumentPosition(remove)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("saves a negative base from the modal as one write, and the row and terms follow", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetchMock = stubServer(holding([JUGGLING, { ...CARTOGRAPHY, flat: -2 }]));
    renderSeeded(holding([JUGGLING, CARTOGRAPHY]));

    fireEvent.click(screen.getByRole("button", { name: "Cartography" }));
    const modal = within(screen.getByRole("dialog", { name: "Cartography" }));
    const input = modal.getByRole("textbox", { name: "Cartography flat bonus" });
    fireEvent.change(input, { target: { value: "-2" } });
    fireEvent.blur(input);

    await waitFor(() => expect(modal.getByText("+0")).toBeVisible());
    expect(screen.getByRole("button", { name: "Cartography check +0" })).toBeInTheDocument();
    await vi.advanceTimersByTimeAsync(1000);
    const writes = fetchMock.mock.calls.filter(([url]) => url === "/api/characters/1");
    expect(writes).toHaveLength(1);
    expect(written(fetchMock)).toEqual([JUGGLING, { ...CARTOGRAPHY, flat: -2 }]);
  });

  it("shows a failed base save in the modal and keeps the old base", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "disk full" }), { status: 500 })),
    );
    renderSeeded(holding([CARTOGRAPHY]));

    fireEvent.click(screen.getByRole("button", { name: "Cartography" }));
    const modal = within(screen.getByRole("dialog", { name: "Cartography" }));
    const input = modal.getByRole("textbox", { name: "Cartography flat bonus" });
    fireEvent.change(input, { target: { value: "7" } });
    fireEvent.blur(input);

    expect(await modal.findByRole("button", { name: "Retry" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Cartography check +5" })).toBeInTheDocument();
  });

  it("saves a base typed just before Escape closes the modal", async () => {
    const fetchMock = stubServer(holding([{ ...CARTOGRAPHY, flat: 7 }]));
    renderSeeded(holding([CARTOGRAPHY]));

    fireEvent.click(screen.getByRole("button", { name: "Cartography" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Cartography flat bonus" }), {
      target: { value: "7" },
    });
    fireEvent(screen.getByRole("dialog"), new Event("cancel"));

    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(written(fetchMock)).toEqual([{ ...CARTOGRAPHY, flat: 7 }]));
  });

  it("sends a base committed on blur once when the modal then closes", async () => {
    const fetchMock = stubServer(holding([{ ...CARTOGRAPHY, flat: 7 }]));
    renderSeeded(holding([CARTOGRAPHY]));

    fireEvent.click(screen.getByRole("button", { name: "Cartography" }));
    const input = screen.getByRole("textbox", { name: "Cartography flat bonus" });
    fireEvent.change(input, { target: { value: "7" } });
    fireEvent.blur(input);
    fireEvent(screen.getByRole("dialog"), new Event("cancel"));

    await waitFor(() => expect(written(fetchMock)).toEqual([{ ...CARTOGRAPHY, flat: 7 }]));
    const writes = fetchMock.mock.calls.filter(([url]) => url === "/api/characters/1");
    expect(writes).toHaveLength(1);
  });

  it("says a base save that failed after the modal closed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "disk full" }), { status: 500 })),
    );
    renderSeeded(holding([CARTOGRAPHY]));

    fireEvent.click(screen.getByRole("button", { name: "Cartography" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Cartography flat bonus" }), {
      target: { value: "7" },
    });
    fireEvent(screen.getByRole("dialog"), new Event("cancel"));

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't save the custom skills");
    expect(screen.getByRole("button", { name: "Cartography check +5" })).toBeInTheDocument();
  });

  it("gives an ability-based skill's modal no flat field", () => {
    renderSeeded(holding([JUGGLING]));

    fireEvent.click(screen.getByRole("button", { name: "Juggling" }));
    const modal = within(screen.getByRole("dialog", { name: "Juggling" }));
    expect(modal.queryByRole("textbox")).toBeNull();
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

  it("keeps removal off the row, in the modal its name opens", () => {
    renderSeeded(holding([JUGGLING]));

    expect(screen.queryByRole("button", { name: "Remove Juggling" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Juggling" }));
    const modal = within(screen.getByRole("dialog", { name: "Juggling" }));
    expect(modal.getByRole("button", { name: "Remove Juggling" })).toBeVisible();
  });

  it("removes a skill and its override in one write, closes the modal and focuses the add field", async () => {
    const remaining = holding([{ ...JUGGLING, name: "Cooking" }]);
    const fetchMock = stubServer(remaining);
    const record = holding([JUGGLING, { ...JUGGLING, name: "Cooking" }]);
    renderSeeded({
      ...record,
      definition: {
        ...record.definition,
        overrides: { "customSkills.Juggling.modifier": 9, "customSkills.Cooking.modifier": 4 },
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "Juggling" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Juggling" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("textbox", { name: "Custom skill" })).toHaveFocus();
    expect(screen.queryByRole("button", { name: "Juggling" })).toBeNull();
    const writes = fetchMock.mock.calls.filter(([url]) => url === "/api/characters/1");
    expect(writes).toHaveLength(1);
    const body = JSON.parse(String(writes[0]?.[1]?.body));
    expect(body.customSkills).toEqual([{ ...JUGGLING, name: "Cooking" }]);
    expect(body.overrides).toEqual({ "customSkills.Cooking.modifier": 4 });
  });

  it("shows a failed removal in the modal and keeps the skill", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "disk full" }), { status: 500 })),
    );
    renderSeeded(holding([JUGGLING]));

    fireEvent.click(screen.getByRole("button", { name: "Juggling" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Juggling" }));

    const modal = within(screen.getByRole("dialog", { name: "Juggling" }));
    expect(await modal.findByText(/Couldn't remove Juggling/)).toBeVisible();
    expect(screen.getByRole("list", { name: "Custom skills" })).toHaveTextContent("Juggling");
  });

  it("says when a change did not save", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "disk full" }), { status: 500 })),
    );
    renderSeeded(holding([JUGGLING]));

    fireEvent.click(screen.getByRole("button", { name: "Juggling proficiency: Not proficient" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't save the custom skills");
  });
});
