import { characterDefinitionSchema } from "@dnd/character";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterRecord } from "../test/records.ts";
import { useCharacter } from "./useCharacter.ts";
import { useRollAndRecord } from "./useRollAndRecord.ts";

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

async function rollUnderRule(
  notation: string,
  named: Parameters<ReturnType<typeof useRollAndRecord>["roll"]>[1],
) {
  const base = characterRecord("1", "Vex");
  const character = {
    ...base,
    definition: characterDefinitionSchema.parse({
      ...base.definition,
      houseRules: { naturalExtremes: true },
    }),
  };
  const posts: Record<string, unknown>[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") {
        posts.push(JSON.parse(String(init.body)));
        return Response.json({ ...posts[0], id: 1 }, { status: 201 });
      }
      return Response.json(character);
    }),
  );
  const { result } = renderHook(
    () => ({ roll: useRollAndRecord("1").roll, loaded: useCharacter("1").isSuccess }),
    { wrapper },
  );
  await waitFor(() => expect(result.current.loaded).toBe(true));
  result.current.roll(notation, named);
  await waitFor(() => expect(posts).toHaveLength(1));
  return posts;
}

afterEach(() => vi.unstubAllGlobals());

describe("useRollAndRecord", () => {
  it("reads the critical-hit house rule from a character that was not yet cached", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const base = characterRecord("1", "Vex");
    const character = {
      ...base,
      definition: characterDefinitionSchema.parse({
        ...base.definition,
        houseRules: { criticalHit: "maximum" },
      }),
    };
    const posts: Record<string, unknown>[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === "POST") {
          posts.push(JSON.parse(String(init.body)));
          return Response.json({ ...posts[0], id: 1 }, { status: 201 });
        }
        return Response.json(character);
      }),
    );
    const { result } = renderHook(
      () => ({ roll: useRollAndRecord("1").roll, loaded: useCharacter("1").isSuccess }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.loaded).toBe(true));
    result.current.roll("1d8", { label: "Hit", type: "damage", origin: "x", critical: true });

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toMatchObject({ dice: [{ value: 8 }, { value: 1 }] });
  });

  it.each([
    [0.99, "Stealth check (automatic success)"],
    [0, "Stealth check (automatic failure)"],
  ])(
    "names a natural 20 or 1 on a check under the natural-extremes rule (%s)",
    async (random, label) => {
      vi.spyOn(Math, "random").mockReturnValue(random);
      const base = characterRecord("1", "Vex");
      const character = {
        ...base,
        definition: characterDefinitionSchema.parse({
          ...base.definition,
          houseRules: { naturalExtremes: true },
        }),
      };
      const posts: Record<string, unknown>[] = [];
      vi.stubGlobal(
        "fetch",
        vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
          if (init?.method === "POST") {
            posts.push(JSON.parse(String(init.body)));
            return Response.json({ ...posts[0], id: 1 }, { status: 201 });
          }
          return Response.json(character);
        }),
      );
      const { result } = renderHook(
        () => ({ roll: useRollAndRecord("1").roll, loaded: useCharacter("1").isSuccess }),
        { wrapper },
      );
      await waitFor(() => expect(result.current.loaded).toBe(true));
      result.current.roll("1d20+5", { label: "Stealth check", type: "check" });
      result.current.roll("1d20+5", { label: "Hit", type: "attack" });

      await waitFor(() => expect(posts).toHaveLength(2));
      expect(posts[0]).toMatchObject({ label });
      expect(posts[1]).toMatchObject({ label: "Hit" });
    },
  );

  it("leaves the label alone without the rule", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const character = characterRecord("1", "Vex");
    const posts: Record<string, unknown>[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === "POST") {
          posts.push(JSON.parse(String(init.body)));
          return Response.json({ ...posts[0], id: 1 }, { status: 201 });
        }
        return Response.json(character);
      }),
    );
    const { result } = renderHook(
      () => ({ roll: useRollAndRecord("1").roll, loaded: useCharacter("1").isSuccess }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.loaded).toBe(true));
    result.current.roll("1d20+5", { label: "Stealth check", type: "check" });

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toMatchObject({ label: "Stealth check" });
  });

  it.each([
    ["advantage keeps the 20 over a 1", "advantage", [0, 0.99], "(automatic success)"],
    ["disadvantage keeps the 1 under a 20", "disadvantage", [0.99, 0], "(automatic failure)"],
    ["advantage ignores a discarded 1", "advantage", [0, 0.5], ""],
    ["disadvantage ignores a discarded 20", "disadvantage", [0.99, 0.5], ""],
  ] as const)("%s", async (_name, mode, randoms, suffix) => {
    const spy = vi.spyOn(Math, "random");
    for (const value of randoms) spy.mockReturnValueOnce(value);
    const posts = await rollUnderRule("1d20+5", { label: "Save", type: "save", mode });
    expect(posts[0]?.label).toBe(suffix ? `Save ${suffix}` : "Save");
  });

  it("names a natural 20 on a save", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const posts = await rollUnderRule("1d20+5", { label: "Save", type: "save" });
    expect(posts[0]?.label).toBe("Save (automatic success)");
  });

  it("does not name a subtracted d20", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const posts = await rollUnderRule("1d4-1d20", { label: "Check", type: "check" });
    expect(posts[0]?.label).toBe("Check");
  });
});
