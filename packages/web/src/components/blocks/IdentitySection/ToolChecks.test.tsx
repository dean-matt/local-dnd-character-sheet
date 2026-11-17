import type { CharacterDerived, CharacterRecord } from "@dnd/character";
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
type ItemReply = (path: string) => Response;

function renderChecks(
  record: CharacterRecord,
  itemReply: ItemReply = () => Response.json(thievesTools),
  adjust: (derived: CharacterDerived) => CharacterDerived = (derived) => derived,
) {
  const posts: Record<string, unknown>[] = [];
  const itemReads: string[] = [];
  vi.stubGlobal("fetch", async (url: RequestInfo | URL, init?: RequestInit) => {
    const path = String(url);
    if (path.endsWith("/derived")) return Response.json(adjust(derivedRecord(record.definition)));
    if (path.startsWith("/api/items/")) {
      itemReads.push(path);
      return itemReply(path);
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
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
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

  it("rolls the penalised ability check and lists the exhaustion term and proficiency", async () => {
    const { posts } = renderChecks(
      holding("proficient"),
      () => Response.json(thievesTools),
      (derived) => ({
        ...derived,
        abilityChecks: {
          ...derived.abilityChecks,
          dex: {
            computed: 1,
            manual: null,
            terms: [
              { label: "Ability modifier", value: 3 },
              { label: "Exhaustion 1: -2", value: -2 },
            ],
          },
        },
      }),
    );

    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Thieves' Tools ability" })).toHaveValue("dex"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Roll Thieves' Tools check" }));

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toMatchObject({
      notation: "1d20+3",
      terms: [
        { source: "Ability modifier", value: 3 },
        { source: "Exhaustion 1: -2", value: -2 },
        { source: "Proficiency", value: 2 },
      ],
    });
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

  it("lists no check for a tool held at none, and one for a tool held beside it", async () => {
    const record = holding("proficient");
    record.definition.proficiencies.tools = [
      { name: "Dice Set", level: "none" },
      { name: "Thieves' Tools", level: "proficient" },
    ];
    renderChecks(record);

    await screen.findByRole("button", { name: "Roll Thieves' Tools check" });
    expect(screen.getByRole("list", { name: "Tool checks" }).querySelectorAll("li")).toHaveLength(
      1,
    );
    expect(screen.queryByRole("combobox", { name: "Dice Set ability" })).toBeNull();
  });

  it("reads the printed ability from the next source where the first holds no row", async () => {
    const { itemReads } = renderChecks(holding("proficient"), (path) =>
      path.endsWith("/XPHB")
        ? Response.json({ error: "No item with that name and source" }, { status: 404 })
        : Response.json({ ...thievesTools, source: "XDMG" }),
    );

    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Thieves' Tools ability" })).toHaveValue("dex"),
    );
    expect(itemReads.map((path) => path.split("/").pop())).toEqual(["XPHB", "XDMG"]);
  });

  it("falls back to Intelligence where no source holds the tool", async () => {
    const { posts } = renderChecks(holding("proficient"), () =>
      Response.json({ error: "No item with that name and source" }, { status: 404 }),
    );

    fireEvent.click(await screen.findByRole("button", { name: "Roll Thieves' Tools check" }));

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]?.notation).toBe("1d20+2");
  });

  it("keeps Intelligence, and stops at the first source, where a read fails other than as a missing row", async () => {
    const { itemReads } = renderChecks(holding("proficient"), () =>
      Response.json({ error: "Bad request" }, { status: 400 }),
    );

    await screen.findByRole("button", { name: "Roll Thieves' Tools check" });
    expect(itemReads).toEqual(["/api/items/Thieves'%20Tools/XPHB"]);
    expect(screen.getByRole("combobox", { name: "Thieves' Tools ability" })).toHaveValue("int");
  });
});
