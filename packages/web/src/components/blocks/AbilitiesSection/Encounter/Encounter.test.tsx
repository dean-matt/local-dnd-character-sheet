import type { CharacterState } from "@dnd/character";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterKey, characterStateKey } from "../../../../hooks/characterKeys.ts";
import { characterRecord, derivedRecord, stateRecord } from "../../../../test/records.ts";
import { Encounter } from "./Encounter.tsx";

type Body = { state: CharacterState; roll?: { label: string; notation: string; total: number } };

function renderEncounter(state: Partial<CharacterState> = {}) {
  const character = characterRecord("1", "Vex");
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
      <Encounter character={character} derived={derivedRecord()} />
    </QueryClientProvider>,
  );
  return writes;
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

  it("writes nothing past the last round", async () => {
    const writes = renderEncounter({ encounter: { round: 999, initiative: null } });

    fireEvent.click(await screen.findByRole("button", { name: "Next round" }));

    expect(screen.getByRole("button", { name: "Next round" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(writes).toHaveLength(0);
  });
});
