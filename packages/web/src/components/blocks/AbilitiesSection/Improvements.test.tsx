import { type CharacterRecord, IMPROVEMENT_FEAT, withImprovement } from "@dnd/character";
import { QueryClient, QueryClientProvider, skipToken, useQuery } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterKey } from "../../../hooks/characterKeys.ts";
import { characterRecord } from "../../../test/records.ts";
import { Improvements } from "./Improvements.tsx";

const WIZARD = { name: "Wizard", source: "XPHB" };
const XPHB = (name: string) => ({ name, source: "XPHB" });
const feature = (name: string, level: number) => ({ ...XPHB(name), level, json: XPHB(name) });
const feat = (name: string, json: object) => ({
  ...XPHB(name),
  edition: "one",
  json: { ...XPHB(name), ...json },
});

const GRANTS = {
  level: 8,
  resources: [],
  spellSlots: [],
  optionalFeatures: [],
  features: [feature("Ability Score Improvement", 4), feature("Ability Score Improvement", 8)],
};
const FEATS = [
  feat("Ability Score Improvement", { category: "G", repeatable: true }),
  feat("Grappler", {
    category: "G",
    prerequisite: [
      { level: 4, ability: [{ str: 13 }] },
      { level: 4, ability: [{ dex: 13 }] },
    ],
    ability: [{ choose: { from: ["str", "dex"] } }],
  }),
  feat("War Caster", { category: "G", prerequisite: [{ level: 4, spellcasting2020: true }] }),
];

/** Vex as a level 8 Wizard who raised Intelligence at 4 and has made no choice at 8. */
function wizard(): CharacterRecord {
  const record = characterRecord("1", "Vex");
  const definition = {
    ...record.definition,
    levels: Array.from({ length: 8 }, () => ({ class: WIZARD })),
  };
  return {
    ...record,
    level: 8,
    definition: {
      ...definition,
      ...withImprovement(definition, 4, WIZARD, {
        feat: IMPROVEMENT_FEAT,
        increases: [{ ability: "int", amount: 2 }],
      }),
    },
  };
}

function Seeded({ id }: { id: string }) {
  const { data } = useQuery<CharacterRecord>({ queryKey: characterKey(id), queryFn: skipToken });
  return data ? <Improvements character={data} /> : null;
}

function renderSeeded(character: CharacterRecord) {
  const writes = vi.fn(async (_url: string, init: RequestInit) => {
    const definition = JSON.parse(String(init.body));
    return new Response(JSON.stringify({ ...character, definition }));
  });
  vi.stubGlobal("fetch", async (url: RequestInfo | URL, init?: RequestInit) => {
    const path = String(url);
    if (path === "/api/classes/Wizard/XPHB/at/8") return new Response(JSON.stringify(GRANTS));
    if (path === "/api/feats?edition=one&limit=200")
      return new Response(JSON.stringify({ items: FEATS, total: FEATS.length }));
    return writes(path, init ?? {});
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(characterKey(character.id), character);
  render(
    <QueryClientProvider client={client}>
      <Seeded id={character.id} />
    </QueryClientProvider>,
  );
  return writes;
}

/** The line naming what one improvement took, read whole. */
const summary = (text: string) =>
  screen.getByText((_, element) => element?.tagName === "P" && element.textContent === text);

afterEach(() => vi.unstubAllGlobals());

describe("Improvements", () => {
  it("names what each improvement took, and says which are missing", async () => {
    renderSeeded(wizard());
    expect(await screen.findByText("1 improvement is not chosen yet.")).toBeVisible();
    expect(summary("Level 4 · Wizard 4: +2 Intelligence")).toBeVisible();
    expect(summary("Level 8 · Wizard 8: not chosen")).toBeVisible();
    expect(screen.getByRole("combobox", { name: "Level 4 choice" })).toHaveTextContent(
      "Raise ability scores",
    );
  });

  it("saves a feat taken at an improvement under its level and class", async () => {
    const writes = renderSeeded(wizard());
    await screen.findByText("1 improvement is not chosen yet.");

    fireEvent.click(screen.getByRole("combobox", { name: "Level 8 choice" }));
    fireEvent.click(screen.getByRole("option", { name: "Grappler" }));

    await waitFor(() => expect(writes).toHaveBeenCalledTimes(1));
    const [url, init] = writes.mock.calls[0] ?? [];
    expect(url).toBe("/api/characters/1");
    expect(JSON.parse(String(init?.body)).feats).toContainEqual({
      ref: XPHB("Grappler"),
      grantedBy: { kind: "class", ref: WIZARD },
      level: 8,
    });
    await waitFor(() => expect(summary("Level 8 · Wizard 8: Grappler")).toBeVisible());
  });

  it("keeps offering a feat taken where the character no longer qualifies for it", async () => {
    const character = wizard();
    const definition = {
      ...character.definition,
      ...withImprovement(character.definition, 8, WIZARD, {
        feat: XPHB("War Caster"),
        increases: [],
      }),
    };
    renderSeeded({ ...character, definition });
    await waitFor(() => expect(summary("Level 8 · Wizard 8: War Caster")).toBeVisible());

    fireEvent.click(screen.getByRole("combobox", { name: "Level 4 choice" }));
    expect(await screen.findByRole("option", { name: "Grappler" })).toBeVisible();
    expect(screen.queryByRole("option", { name: "War Caster" })).toBeNull();
    fireEvent.click(screen.getByRole("combobox", { name: "Level 8 choice" }));
    expect(screen.getByRole("option", { name: "War Caster" })).toBeVisible();
  });
});
