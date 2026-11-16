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
});
