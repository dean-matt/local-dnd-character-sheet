import type { CharacterDerived, CharacterRecord } from "@dnd/character";
import { QueryClient, QueryClientProvider, skipToken, useQuery } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterKey } from "../../../hooks/characterKeys.ts";
import { characterRecord, derivedRecord } from "../../../test/records.ts";
import { saveToasts } from "../../../test/saveToasts.ts";
import { SaveToasts } from "../../SaveToasts.tsx";
import { NewSkillForm } from "./NewSkillForm.tsx";

const record = (name: string, ability: string) => ({
  id: `id-${name}`,
  name,
  edition: "one",
  json: { name, source: "HB", ability },
  createdAt: "2026-01-01T00:00:00.000Z",
});

/** The derived block for `record`, with Stealth standing in for the catalog's skills. */
const derivedFor = (character: CharacterRecord): CharacterDerived => {
  const derived = derivedRecord(character.definition);
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

const nameField = createRef<HTMLInputElement>();
const added = vi.fn();

function Seeded() {
  const { data } = useQuery<CharacterRecord>({ queryKey: characterKey("1"), queryFn: skipToken });
  return data ? (
    <NewSkillForm
      character={data}
      derived={derivedFor(data)}
      nameField={nameField}
      onAdded={added}
    />
  ) : null;
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

type Reply = Response | (() => Response);

/** Answers each route in turn; a character write after the list gets `saved`, or `characterFails`. */
function stubServer(
  saved: CharacterRecord,
  { create, characterFails = 0 }: { create?: Reply; characterFails?: number } = {},
) {
  let characterWrites = 0;
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "/api/homebrew/skills" && init?.method === "POST") {
      return typeof create === "function" ? create() : (create ?? new Response("{}"));
    }
    if (url === "/api/homebrew/skills") return new Response("[]");
    characterWrites += 1;
    if (characterWrites <= characterFails) {
      return new Response(JSON.stringify({ error: "disk full" }), { status: 500 });
    }
    return new Response(JSON.stringify(saved));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const callsTo = (fetchMock: ReturnType<typeof stubServer>, url: string, method: string) =>
  fetchMock.mock.calls.filter(([each, init]) => each === url && init?.method === method);

const body = (call: unknown[] | undefined) => {
  const init = call?.[1] as RequestInit | undefined;
  return JSON.parse(String(init?.body));
};

function addSkill(name: string, base?: string) {
  fireEvent.change(screen.getByRole("textbox", { name: "New skill" }), {
    target: { value: name },
  });
  if (base) {
    fireEvent.click(screen.getByRole("combobox", { name: "New skill base" }));
    fireEvent.click(screen.getByRole("option", { name: base }));
  }
  fireEvent.click(screen.getByRole("button", { name: "Add" }));
}

afterEach(() => {
  added.mockReset();
  vi.unstubAllGlobals();
});

describe("NewSkillForm", () => {
  it("creates a homebrew skill of the character's edition, then holds it unproficient", async () => {
    const fetchMock = stubServer(characterRecord("1", "Vex"), {
      create: new Response(JSON.stringify(record("Juggling", "dex")), { status: 201 }),
    });
    renderSeeded(characterRecord("1", "Vex"));

    addSkill("  Juggling ", "DEX");

    await waitFor(() => expect(callsTo(fetchMock, "/api/characters/1", "PUT")).toHaveLength(1));
    expect(body(callsTo(fetchMock, "/api/homebrew/skills", "POST")[0])).toEqual({
      name: "Juggling",
      edition: "one",
      ability: "dex",
    });
    expect(body(callsTo(fetchMock, "/api/characters/1", "PUT")[0]).proficiencies.skills).toEqual([
      { ref: { name: "Juggling", source: "HB" }, level: "none" },
    ]);
    expect(added).toHaveBeenCalledWith("Juggling");
    expect(screen.getByRole("textbox", { name: "New skill" })).toHaveValue("");
  });

  it("holds a flat skill with a number of zero", async () => {
    const fetchMock = stubServer(characterRecord("1", "Vex"), {
      create: new Response(JSON.stringify(record("Cartography", "flat")), { status: 201 }),
    });
    renderSeeded(characterRecord("1", "Vex"));

    addSkill("Cartography", "Flat bonus");

    await waitFor(() => expect(callsTo(fetchMock, "/api/characters/1", "PUT")).toHaveLength(1));
    expect(body(callsTo(fetchMock, "/api/characters/1", "PUT")[0]).proficiencies.skills).toEqual([
      { ref: { name: "Cartography", source: "HB" }, level: "none", flat: 0 },
    ]);
  });

  it("refuses a name a skill already holds, in its spelling, without a request", () => {
    const fetchMock = stubServer(characterRecord("1", "Vex"));
    renderSeeded(characterRecord("1", "Vex"));

    addSkill("stealth");

    const field = screen.getByRole("textbox", { name: "New skill" });
    expect(screen.getByText("Stealth is already a skill.")).toBeVisible();
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveValue("stealth");
    expect(callsTo(fetchMock, "/api/homebrew/skills", "POST")).toEqual([]);

    fireEvent.change(field, { target: { value: "stealt" } });
    expect(screen.queryByText("Stealth is already a skill.")).toBeNull();
  });

  it("puts the name back with the server's message when it refuses a name the sheet had not seen", async () => {
    stubServer(characterRecord("1", "Vex"), {
      create: new Response(
        JSON.stringify({ error: "taken", conflict: { id: "x", name: "Juggling", edition: "one" } }),
        { status: 409 },
      ),
    });
    renderSeeded(characterRecord("1", "Vex"));

    addSkill("juggling");

    expect(await screen.findByText("Juggling is already a skill.")).toBeVisible();
    expect(screen.getByRole("textbox", { name: "New skill" })).toHaveValue("juggling");
  });

  it("does nothing for a blank name, which leaves Add aria-disabled", () => {
    const fetchMock = stubServer(characterRecord("1", "Vex"));
    renderSeeded(characterRecord("1", "Vex"));

    expect(screen.getByRole("button", { name: "Add" })).toHaveAttribute("aria-disabled", "true");
    addSkill("   ");

    expect(fetchMock).not.toHaveBeenCalledWith("/api/homebrew/skills", expect.anything());
  });

  it("keeps the base select on its last choice", async () => {
    stubServer(characterRecord("1", "Vex"), {
      create: new Response(JSON.stringify(record("Juggling", "dex")), { status: 201 }),
    });
    renderSeeded(characterRecord("1", "Vex"));

    addSkill("Juggling", "DEX");
    await waitFor(() => expect(added).toHaveBeenCalled());

    expect(screen.getByRole("combobox", { name: "New skill base" })).toHaveTextContent("DEX");
  });

  it("retries the create with the typed name when it fails", async () => {
    let creates = 0;
    const fetchMock = stubServer(characterRecord("1", "Vex"), {
      create: () => {
        creates += 1;
        return creates === 1
          ? new Response(JSON.stringify({ error: "disk full" }), { status: 500 })
          : new Response(JSON.stringify(record("Juggling", "dex")), { status: 201 });
      },
    });
    renderSeeded(characterRecord("1", "Vex"));

    addSkill("Juggling", "DEX");

    fireEvent.click(await saveToasts().findByRole("button", { name: "Retry Skills" }));
    await waitFor(() => expect(added).toHaveBeenCalledWith("Juggling"));
    expect(callsTo(fetchMock, "/api/homebrew/skills", "POST")).toHaveLength(2);
    expect(body(callsTo(fetchMock, "/api/homebrew/skills", "POST")[1]).name).toBe("Juggling");
  });

  it("retries only the definition write when it fails after the skill was created", async () => {
    const fetchMock = stubServer(characterRecord("1", "Vex"), {
      create: new Response(JSON.stringify(record("Juggling", "dex")), { status: 201 }),
      characterFails: 1,
    });
    renderSeeded(characterRecord("1", "Vex"));

    addSkill("Juggling", "DEX");

    fireEvent.click(await saveToasts().findByRole("button", { name: "Retry Skills" }));
    await waitFor(() => expect(added).toHaveBeenCalledWith("Juggling"));
    expect(callsTo(fetchMock, "/api/homebrew/skills", "POST")).toHaveLength(1);
    expect(callsTo(fetchMock, "/api/characters/1", "PUT")).toHaveLength(2);
  });
});
