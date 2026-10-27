import type { CharacterDefinition, CharacterDerived, CharacterRecord } from "@dnd/character";
import { QueryClient, QueryClientProvider, skipToken, useQuery } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
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
    <CatalogSkills character={record} derived={derivedFor(record)} onRemoved={() => {}} />
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

describe("a flat homebrew skill on the sheet", () => {
  const CARTOGRAPHY = { name: "Cartography", source: "HB" };
  const flatDerived = (record: CharacterRecord): CharacterDerived => {
    const modifier = { computed: 5, manual: null, terms: [] };
    return {
      ...derivedFor(record),
      skills: [
        { ref: CARTOGRAPHY, ability: null, modifier, passive: { ...modifier, computed: 15 } },
      ],
    };
  };
  const catalogSkills = (record: CharacterRecord) => (
    <CatalogSkills character={record} derived={flatDerived(record)} onRemoved={() => {}} />
  );
  const flatHolding = () => holding([{ ref: CARTOGRAPHY, level: "proficient", flat: 3 }]);

  it("shows FLAT on its row and the number in its modal's footer beside Remove", () => {
    stubServer(flatHolding());
    renderSeeded(flatHolding(), catalogSkills);

    const row = screen.getByText("Cartography").closest("li") as HTMLElement;
    expect(row).toHaveTextContent("flat");
    expect(row).toHaveTextContent("+5");
    expect(within(row).queryByRole("textbox")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Cartography" }));
    const modal = within(screen.getByRole("dialog", { name: "Cartography" }));
    const field = modal.getByRole("textbox", { name: "Cartography flat bonus" });
    expect(field).toHaveValue("3");
    const remove = modal.getByRole("button", { name: "Remove Cartography" });
    expect(field.compareDocumentPosition(remove)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("saves an edited number onto the held entry, and refuses a value that is not a whole number", async () => {
    const fetchMock = stubServer(flatHolding());
    renderSeeded(flatHolding(), catalogSkills);
    fireEvent.click(screen.getByRole("button", { name: "Cartography" }));
    const field = within(screen.getByRole("dialog", { name: "Cartography" })).getByRole("textbox", {
      name: "Cartography flat bonus",
    });

    for (const refused of ["1.5", "abc", "1e3", "0x10", "1_000", "9007199254740992"]) {
      fireEvent.change(field, { target: { value: refused } });
      fireEvent.blur(field);
      expect(fetchMock, refused).not.toHaveBeenCalledWith("/api/characters/1", expect.anything());
    }

    fireEvent.change(field, { target: { value: "-4" } });
    fireEvent.blur(field);
    await waitFor(() =>
      expect(written(fetchMock).proficiencies.skills).toEqual([
        { ref: CARTOGRAPHY, level: "proficient", flat: -4 },
      ]),
    );
  });

  it("keeps the number when the ring steps the level", async () => {
    const fetchMock = stubServer(flatHolding());
    renderSeeded(flatHolding(), catalogSkills);

    fireEvent.click(screen.getByRole("button", { name: "Cartography proficiency: Proficient" }));

    await waitFor(() =>
      expect(written(fetchMock).proficiencies.skills).toEqual([
        { ref: CARTOGRAPHY, level: "expertise", flat: 3 },
      ]),
    );
  });
});

describe("AddHomebrewSkill", () => {
  const add = (record: CharacterRecord) => (
    <MemoryRouter>
      <AddHomebrewSkill character={record} buttonRef={{ current: null }} onAdded={() => {}} />
    </MemoryRouter>
  );
  const openModal = async () => {
    fireEvent.click(await screen.findByRole("button", { name: "Add skill" }));
    return screen.findByRole("dialog", { name: "Add a skill" });
  };

  it("cites a homebrew skill of the character's edition at no proficiency, and closes", async () => {
    const fetchMock = stubServer(holding([]), [
      homebrewRow("Sailing", "one"),
      homebrewRow("Survival (Underdark)", "classic"),
    ]);
    renderSeeded(holding([]), add);

    const dialog = await openModal();
    expect(within(dialog).queryByText("Survival (Underdark)")).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: /Sailing/ }));

    await waitFor(() =>
      expect(written(fetchMock).proficiencies.skills).toEqual([{ ref: SAILING, level: "none" }]),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("narrows the list to the skills holding what is typed", async () => {
    stubServer(holding([]), [homebrewRow("Sailing", "one"), homebrewRow("Cartography", "one")]);
    renderSeeded(holding([]), add);

    const dialog = await openModal();
    fireEvent.change(within(dialog).getByRole("searchbox"), { target: { value: "cart" } });

    expect(within(dialog).queryByText("Sailing")).not.toBeInTheDocument();
    expect(within(dialog).getByText("Cartography")).toBeVisible();
    fireEvent.change(within(dialog).getByRole("searchbox"), { target: { value: "zzz" } });
    expect(within(dialog).getByText("No matches")).toBeVisible();
  });

  it("says so, and points to Settings, once the character holds every homebrew skill", async () => {
    stubServer(holding([]), [homebrewRow("Sailing", "one")]);
    renderSeeded(holding([{ ref: SAILING, level: "none" }]), add);

    const dialog = await openModal();
    expect(within(dialog).getByText(/holds every homebrew skill/)).toBeVisible();
    expect(within(dialog).getByRole("link", { name: "Make one in Settings" })).toHaveAttribute(
      "href",
      "/settings/homebrew",
    );
  });

  it("says there are none where no homebrew skill is defined", async () => {
    stubServer(holding([]), []);
    renderSeeded(holding([]), add);

    expect(within(await openModal()).getByText(/No homebrew skills yet/)).toBeVisible();
  });
});
