import type { CharacterState } from "@dnd/character";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterStateKey } from "../../../../hooks/characterKeys.ts";
import { stateRecord } from "../../../../test/records.ts";
import { BardicInspiration } from "./BardicInspiration.tsx";

function renderCard(bardicInspiration: CharacterState["bardicInspiration"] = null) {
  let play = stateRecord();
  play = { ...play, state: { ...play.state, bardicInspiration } };
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
      <BardicInspiration characterId="1" />
    </QueryClientProvider>,
  );
  return writes;
}

afterEach(() => vi.unstubAllGlobals());

describe("BardicInspiration", () => {
  it("records a die by size in one write and announces it", async () => {
    const writes = renderCard();
    expect(await screen.findByText("No die held")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "d8" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Bardic Inspiration d8 held"),
    );
    expect(writes).toHaveLength(1);
    expect(writes[0]?.bardicInspiration).toBe(8);
    expect(screen.getByRole("button", { name: "d8" })).toHaveAttribute("aria-pressed", "true");
  });

  it("clears the held die in one write", async () => {
    const writes = renderCard(10);
    expect(await screen.findByText("Holding a")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]?.bardicInspiration).toBeNull();
    expect(await screen.findByText("No die held")).toBeInTheDocument();
  });

  it("writes nothing to clear where none is held", async () => {
    const writes = renderCard();
    fireEvent.click(await screen.findByRole("button", { name: "Clear" }));
    expect(writes).toHaveLength(0);
  });
});
