import { type CharacterDefinition, characterDefinitionSchema } from "@dnd/character";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stubFetch } from "../test/stubFetch.ts";
import {
  characterKey,
  charactersKey,
  useCharacter,
  useCharacters,
  useUpdateCharacterDefinition,
} from "./useCharacters.ts";

const WARLOCK = { name: "Warlock", source: "XPHB" };

const baseDefinition = (overrides: Partial<CharacterDefinition> = {}): CharacterDefinition =>
  characterDefinitionSchema.parse({
    name: "Vex",
    edition: "one",
    levels: [{ class: WARLOCK }],
    race: { name: "Half-Elf", source: "XPHB" },
    background: { name: "Charlatan", source: "XPHB" },
    abilityScores: { str: 8, dex: 16, con: 14, int: 10, wis: 12, cha: 17 },
    proficiencies: {
      savingThrows: [],
      skills: [],
      armor: [],
      weapons: [],
      tools: [],
      languages: [],
    },
    inventory: [],
    spells: [],
    ...overrides,
  });

const baseRecord = (id: string) => ({
  id,
  name: "Vex",
  edition: "one" as const,
  level: 1,
  definition: baseDefinition(),
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
});

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useCharacters", () => {
  it("resolves the list the API returns", async () => {
    stubFetch(new Response(JSON.stringify([baseRecord("1")]), { status: 200 }));
    const queryClient = new QueryClient();

    const { result } = renderHook(() => useCharacters(), { wrapper: wrapper(queryClient) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([baseRecord("1")]);
  });
});

describe("useCharacter", () => {
  it("resolves one character by id", async () => {
    stubFetch(new Response(JSON.stringify(baseRecord("1")), { status: 200 }));
    const queryClient = new QueryClient();

    const { result } = renderHook(() => useCharacter("1"), { wrapper: wrapper(queryClient) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(baseRecord("1"));
  });
});

describe("useUpdateCharacterDefinition", () => {
  it("writes the response into the detail cache and invalidates the list on success", async () => {
    const updated = baseRecord("1");
    stubFetch(new Response(JSON.stringify(updated), { status: 200 }));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(charactersKey, [baseRecord("1")]);

    const { result } = renderHook(() => useUpdateCharacterDefinition("1"), {
      wrapper: wrapper(queryClient),
    });

    result.current.mutate(updated.definition);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(queryClient.getQueryData(characterKey("1"))).toEqual(updated);
    expect(queryClient.getQueryState(charactersKey)?.isInvalidated).toBe(true);
  });

  it("leaves the caches untouched and reports the error on a failed write", async () => {
    stubFetch(new Response(JSON.stringify({ error: "invalid definition" }), { status: 422 }));
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const original = baseRecord("1");
    queryClient.setQueryData(characterKey("1"), original);

    const { result } = renderHook(() => useUpdateCharacterDefinition("1"), {
      wrapper: wrapper(queryClient),
    });

    result.current.mutate(baseDefinition({ name: "Nyx" }));
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe("invalid definition");
    expect(queryClient.getQueryData(characterKey("1"))).toEqual(original);
  });
});
