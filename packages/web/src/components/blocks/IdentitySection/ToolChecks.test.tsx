import type { CharacterRecord } from "@dnd/character";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterRecord, derivedRecord } from "../../../test/records.ts";
import { RollingFor } from "../../rollerContext.ts";
import { ToolChecks } from "./ToolChecks.tsx";

type Level = "half" | "proficient" | "expertise";

function holding(level: Level, edition: "one" | "classic" = "one"): CharacterRecord {
  const base = characterRecord("1", "Vex");
  const definition = {
    ...base.definition,
    edition,
    proficiencies: {
      ...base.definition.proficiencies,
      tools: [{ name: "Thieves' Tools", level }],
    },
  };
  return { ...base, edition, definition };
}

const thievesTools = {
  name: "Thieves' Tools",
  source: "XPHB",
  edition: "one",
  kind: "item",
  type: "T|XPHB",
  rarity: "none",
  requiresAttunement: false,
  json: {
    name: "Thieves' Tools",
    source: "XPHB",
    entries: [
      { type: "list", items: [{ name: "Ability:", type: "item", entries: ["Dexterity"] }] },
    ],
  },
};

/** Serves the derived block, the printed tool row and the roll log, and records each roll posted. */
function renderChecks(record: CharacterRecord) {
  const posts: Record<string, unknown>[] = [];
  const itemReads: string[] = [];
  vi.stubGlobal("fetch", async (url: RequestInfo | URL, init?: RequestInit) => {
    const path = String(url);
    if (path.endsWith("/derived")) return Response.json(derivedRecord(record.definition));
    if (path.startsWith("/api/items/")) {
      itemReads.push(path);
      return Response.json(thievesTools);
    }
    if (init?.method === "POST") {
      posts.push(JSON.parse(String(init.body)));
      return Response.json({
        id: 1,
        characterId: "1",
        characterName: "Vex",
        rolledAt: "2026-01-01T00:00:00.000Z",
        label: "x",
        notation: "x",
        total: 14,
        dice: [],
        modifier: 0,
        critical: false,
      });
    }
    return Response.json([]);
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RollingFor value="1">
        <ToolChecks character={record} />
      </RollingFor>
    </QueryClientProvider>,
  );
  return { posts, itemReads };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ToolChecks", () => {
  it("rolls a tool on the printed ability plus proficiency, logs it and announces it", async () => {
    const { posts } = renderChecks(holding("proficient"));

    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Thieves' Tools ability" })).toHaveValue("dex"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Roll Thieves' Tools check" }));

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toMatchObject({
      label: "Thieves' Tools check",
      type: "check",
      origin: "Thieves' Tools",
      notation: "1d20+5",
    });
    expect((await screen.findAllByRole("status"))[0]).toHaveTextContent(
      /Thieves' Tools check: \d+/,
    );
  });

  it("doubles the proficiency bonus at expertise", async () => {
    const { posts } = renderChecks(holding("expertise"));

    await screen.findByRole("button", { name: "Roll Thieves' Tools check" });
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Thieves' Tools ability" })).toHaveValue("dex"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Roll Thieves' Tools check" }));

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]?.notation).toBe("1d20+7");
  });

  it("rolls on the ability the player picks", async () => {
    const { posts } = renderChecks(holding("proficient"));

    fireEvent.change(await screen.findByRole("combobox", { name: "Thieves' Tools ability" }), {
      target: { value: "str" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Roll Thieves' Tools check" }));

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]?.notation).toBe("1d20+1");
  });

  it("starts on Intelligence where the edition prints no ability, without asking the catalog", async () => {
    const { posts, itemReads } = renderChecks(holding("proficient", "classic"));

    fireEvent.click(await screen.findByRole("button", { name: "Roll Thieves' Tools check" }));

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]?.notation).toBe("1d20+2");
    expect(itemReads).toEqual([]);
  });

  it("lists no check for a tool held at none", async () => {
    const record = holding("proficient");
    record.definition.proficiencies.tools = [{ name: "Dice Set", level: "none" }];
    renderChecks(record);

    await waitFor(() => expect(screen.queryByRole("list", { name: "Tool checks" })).toBeNull());
  });
});
