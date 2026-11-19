import type { CharacterState } from "@dnd/character";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterStateKey } from "../../../../hooks/characterKeys.ts";
import { stateRecord } from "../../../../test/records.ts";
import { TurnEconomy } from "./TurnEconomy.tsx";

function renderCard(turn: Partial<CharacterState["turn"]> = {}) {
  let play = stateRecord();
  play = { ...play, state: { ...play.state, turn: { ...play.state.turn, ...turn } } };
  const writes: CharacterState[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method !== "PUT") return Response.json(play);
      const sent = JSON.parse(String(init.body));
      writes.push(sent);
      play = { ...play, state: sent };
      return Response.json(play);
    }),
  );
  const client = new QueryClient();
  client.setQueryData(characterStateKey("1"), play);
  render(
    <QueryClientProvider client={client}>
      <TurnEconomy characterId="1" />
    </QueryClientProvider>,
  );
  return writes;
}

afterEach(() => vi.unstubAllGlobals());

describe("TurnEconomy", () => {
  it("toggles a mark in one write, shows it in words and announces it", async () => {
    const writes = renderCard();
    const reaction = await screen.findByRole("button", { name: /Reaction/ });
    expect(reaction).toHaveAttribute("aria-pressed", "false");
    expect(reaction).toHaveTextContent("available");

    fireEvent.click(reaction);

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Reaction spent"));
    expect(writes).toHaveLength(1);
    expect(writes[0]?.turn).toEqual({
      action: false,
      bonusAction: false,
      reaction: true,
      movement: false,
      addedActions: [],
      features: [],
    });
    expect(screen.getByRole("button", { name: /Reaction/ })).toHaveTextContent("spent");
  });

  it("works with no encounter running", async () => {
    const writes = renderCard();
    fireEvent.click(await screen.findByRole("button", { name: /Movement/ }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]?.encounter).toBeNull();
  });

  it("resets all four marks in one write", async () => {
    const writes = renderCard({ action: true, movement: true });
    fireEvent.click(await screen.findByRole("button", { name: "Reset" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("reset"));
    expect(writes).toHaveLength(1);
    expect(Object.values(writes[0]?.turn ?? {})).toEqual([false, false, false, false, [], []]);
  });

  it("shows each action a feature added beside the action, and spends it in one write", async () => {
    const writes = renderCard({ action: true, addedActions: [false] });
    const added = await screen.findByRole("button", { name: /^Action 2/ });
    expect(added).toHaveTextContent("available");

    fireEvent.click(added);

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Action 2 spent"));
    expect(writes[0]?.turn).toMatchObject({ action: true, addedActions: [true] });
  });

  it("drops the added actions on a reset", async () => {
    const writes = renderCard({ addedActions: [false] });
    fireEvent.click(await screen.findByRole("button", { name: "Reset" }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]?.turn.addedActions).toEqual([]);
  });

  it("resets a once-a-turn feature used with no mark spent", async () => {
    const writes = renderCard({ features: ["Sneak Attack"] });
    fireEvent.click(await screen.findByRole("button", { name: "Reset" }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]?.turn.features).toEqual([]);
  });

  it("does not write a reset where nothing is spent", async () => {
    const writes = renderCard();
    fireEvent.click(await screen.findByRole("button", { name: "Reset" }));
    expect(writes).toHaveLength(0);
  });
});
