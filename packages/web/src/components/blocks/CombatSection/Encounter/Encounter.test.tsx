import type { CharacterDerived, CharacterState } from "@dnd/character";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterKey, characterStateKey } from "../../../../hooks/characterKeys.ts";
import { characterRecord, derivedRecord, stateRecord } from "../../../../test/records.ts";
import { Encounter } from "./Encounter.tsx";

type Body = {
  state: CharacterState;
  roll?: { label: string; notation: string; total: number; mode?: string };
};

function renderEncounter(
  state: Partial<CharacterState> = {},
  edition: "classic" | "one" = "one",
  limitedUses: CharacterDerived["limitedUses"] = [],
  extra: Partial<CharacterDerived> = {},
) {
  const base = characterRecord("1", "Vex");
  const character = { ...base, edition, definition: { ...base.definition, edition } };
  let play = { ...stateRecord(), state: { ...stateRecord().state, ...state } };
  const writes: { url: string; body: Body }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method !== "PUT") return Response.json(play);
      const sent = JSON.parse(String(init.body));
      const body: Body = url.endsWith("/state") ? { state: sent } : sent;
      writes.push({ url, body });
      play = { ...play, state: body.state };
      return Response.json(url.endsWith("/state") ? play : { character, state: play });
    }),
  );
  const client = new QueryClient();
  client.setQueryData(characterKey("1"), character);
  client.setQueryData(characterStateKey("1"), play);
  render(
    <QueryClientProvider client={client}>
      <Encounter character={character} derived={{ ...derivedRecord(), limitedUses, ...extra }} />
    </QueryClientProvider>,
  );
  return Object.assign(writes, { client, play: () => play });
}

afterEach(() => vi.unstubAllGlobals());

describe("Encounter", () => {
  it("starts an encounter at round 1 with one state write, announced", async () => {
    const writes = renderEncounter();
    expect(await screen.findByText("No encounter running.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Start encounter" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Encounter started"));
    expect(writes).toHaveLength(1);
    expect(writes[0]?.body.state.encounter).toEqual({ round: 1, initiative: null });
    expect(screen.getByText("Round 1")).toBeInTheDocument();
  });

  it("rolls initiative from the derived bonus, logging the roll in the same write", async () => {
    const writes = renderEncounter();

    fireEvent.click(await screen.findByRole("button", { name: "Roll initiative" }));

    await waitFor(() => expect(writes).toHaveLength(1));
    const [write] = writes;
    expect(write?.url).toMatch(/definition-and-state$/);
    expect(write?.body.roll?.label).toBe("Initiative");
    expect(write?.body.roll?.notation).toMatch(/^1d20/);
    expect(write?.body.state.encounter).toEqual({ round: 1, initiative: write?.body.roll?.total });
    expect(await screen.findByRole("button", { name: "Reroll initiative" })).toBeInTheDocument();
  });

  it("restores a spent use initiative restores, in the same write as the roll", async () => {
    const key = "feat|XGE|Second Chance";
    const use = {
      feature: { name: "Second Chance", source: "XGE" },
      origin: "feat" as const,
      level: null,
      key,
      count: 1,
      reset: "short" as const,
      restoredBy: "initiative" as const,
    };
    const writes = renderEncounter({ featureUses: [{ key, expended: 1 }] }, "one", [use]);

    fireEvent.click(await screen.findByRole("button", { name: "Roll initiative" }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]?.body.state.featureUses).toEqual([{ key, expended: 0 }]);
  });

  it("regains ki points when initiative finds none left, in the same write as the roll", async () => {
    const monk = { name: "Monk", source: "PHB" };
    const writes = renderEncounter(
      { classResources: [{ class: monk, key: "ki_points", maximum: 20, expended: 20 }] },
      "classic",
      [],
      {
        classResources: [
          { class: monk, key: "ki_points", maximum: { computed: 20, manual: null, terms: [] } },
        ] as CharacterDerived["classResources"],
        regains: [
          {
            feature: { name: "Perfect Self", source: "PHB" },
            class: monk,
            target: "pool",
            pool: "ki_points",
            count: 4,
            on: "initiative",
          },
        ],
      },
    );

    fireEvent.click(await screen.findByRole("button", { name: "Roll initiative" }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]?.body.state.classResources[0]?.expended).toBe(16);
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        /Initiative \d+\. Perfect Self regained/,
      ),
    );
  });

  it("announces only what the write's latest state regained, not the stale render's", async () => {
    const monk = { name: "Monk", source: "PHB" };
    const spent = { class: monk, key: "ki_points", maximum: 20, expended: 20 };
    const writes = renderEncounter({ classResources: [spent] }, "classic", [], {
      classResources: [
        { class: monk, key: "ki_points", maximum: { computed: 20, manual: null, terms: [] } },
      ] as CharacterDerived["classResources"],
      regains: [
        {
          feature: { name: "Perfect Self", source: "PHB" },
          class: monk,
          target: "pool",
          pool: "ki_points",
          count: 4,
          on: "initiative",
        },
      ],
    });
    const button = await screen.findByRole("button", { name: "Roll initiative" });
    const play = writes.play();
    writes.client.setQueryData(characterStateKey("1"), {
      ...play,
      state: { ...play.state, classResources: [{ ...spent, expended: 5 }] },
    });

    fireEvent.click(button);

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]?.body.state.classResources[0]?.expended).toBe(5);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/^Initiative \d+$/));
  });

  it("rolls initiative with disadvantage at classic exhaustion 1, and normally in 2024", async () => {
    const writes = renderEncounter({ exhaustion: 1 }, "classic");
    fireEvent.click(await screen.findByRole("button", { name: "Roll initiative" }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]?.body.roll).toMatchObject({ mode: "disadvantage" });
    expect(screen.getByRole("button", { name: "Initiative: Disadvantage" })).toBeInTheDocument();
    cleanup();

    const normal = renderEncounter({ exhaustion: 1 }, "one");
    fireEvent.click(await screen.findByRole("button", { name: "Roll initiative" }));
    await waitFor(() => expect(normal).toHaveLength(1));
    expect(normal[0]?.body.roll?.mode).toBeUndefined();
  });

  it("rolls initiative with advantage while Invisible in 2024, and with none in the classic ruleset", async () => {
    const conditions = [{ name: "Invisible", source: "XPHB" }];
    const writes = renderEncounter({ conditions }, "one");
    fireEvent.click(await screen.findByRole("button", { name: "Roll initiative" }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]?.body.roll).toMatchObject({ mode: "advantage" });
    cleanup();

    const classic = renderEncounter({ conditions }, "classic");
    fireEvent.click(await screen.findByRole("button", { name: "Roll initiative" }));
    await waitFor(() => expect(classic).toHaveLength(1));
    expect(classic[0]?.body.roll?.mode).toBeUndefined();
  });

  it.each([
    [["Poisoned"], "disadvantage"],
    [["Poisoned", "Invisible"], undefined],
    [["Frightened"], undefined],
  ])("rolls initiative while %j with mode %s", async (names, mode) => {
    const conditions = names.map((name) => ({ name, source: "XPHB" }));
    const writes = renderEncounter({ conditions }, "one");
    fireEvent.click(await screen.findByRole("button", { name: "Roll initiative" }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]?.body.roll?.mode).toBe(mode);
  });

  it("advances the round and ends the encounter, each one write", async () => {
    const writes = renderEncounter({ encounter: { round: 2, initiative: 15 } });

    fireEvent.click(await screen.findByRole("button", { name: "Next round" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Round 3"));

    fireEvent.click(screen.getByRole("button", { name: "End encounter" }));
    await waitFor(() => expect(screen.getByText("No encounter running.")).toBeInTheDocument());
    expect(writes.map((write) => write.body.state.encounter)).toEqual([
      { round: 3, initiative: 15 },
      null,
    ]);
  });

  it("makes the spent turn marks available in the same write that advances the round", async () => {
    const writes = renderEncounter({
      encounter: { round: 2, initiative: null },
      turn: {
        action: true,
        bonusAction: true,
        reaction: false,
        movement: true,
        addedActions: [false],
        features: [],
      },
    });

    fireEvent.click(await screen.findByRole("button", { name: "Next round" }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]?.body.state.turn).toEqual({
      action: false,
      bonusAction: false,
      reaction: false,
      movement: false,
      addedActions: [],
      features: [],
    });
  });

  it("writes nothing past the last round", async () => {
    const writes = renderEncounter({ encounter: { round: 999, initiative: null } });

    fireEvent.click(await screen.findByRole("button", { name: "Next round" }));

    expect(screen.getByRole("button", { name: "Next round" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(writes).toHaveLength(0);
  });

  it("moves focus to the control that replaces the one pressed", async () => {
    renderEncounter();

    fireEvent.click(await screen.findByRole("button", { name: "Start encounter" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Next round" })).toHaveFocus());

    fireEvent.click(screen.getByRole("button", { name: "End encounter" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Start encounter" })).toHaveFocus(),
    );
  });

  it("announces a failed initiative roll and starts no encounter", async () => {
    renderEncounter();
    const ok = fetch;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
        init?.method === "PUT"
          ? Response.json({ error: "nope" }, { status: 500 })
          : ok(input, init),
      ),
    );

    fireEvent.click(await screen.findByRole("button", { name: "Roll initiative" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Initiative was not rolled"),
    );
    expect(screen.getByText("No encounter running.")).toBeInTheDocument();
  });
});
