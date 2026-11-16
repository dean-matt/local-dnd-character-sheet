import { characterDefinitionSchema } from "@dnd/character";
import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterRecord, stateRecord } from "../test/records.ts";
import { renderWithClient } from "../test/renderWithClient.tsx";
import { ModeRoll } from "./ModeRoll.tsx";
import { RollingFor } from "./rollerContext.ts";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

type Posted = Record<string, unknown>;

/** A held-inspiration character of `edition` under `houseRules`, with every request recorded. */
function render(edition: "classic" | "one", houseRules = {}, inspiration = true) {
  const base = characterRecord("1", "Vex");
  const character = {
    ...base,
    edition,
    definition: characterDefinitionSchema.parse({ ...base.definition, edition, houseRules }),
  };
  const state = { ...stateRecord(), state: { ...stateRecord().state, inspiration } };
  const rolls: Posted[] = [];
  const writes: Posted[] = [];
  const reads = { state: 0 };
  vi.stubGlobal("fetch", async (url: RequestInfo | URL, init?: RequestInit) => {
    const path = String(url);
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    if (path === "/api/characters/1/rolls") {
      rolls.push(body);
      return Response.json(
        {
          ...body,
          id: 1,
          characterId: "1",
          characterName: "Vex",
          rolledAt: "2026-01-01T00:00:00.000Z",
        },
        { status: 201 },
      );
    }
    if (path === "/api/characters/1/state" && init?.method === "PUT") {
      writes.push(body);
      return Response.json({ ...state, state: body });
    }
    if (path === "/api/characters/1/state") {
      reads.state += 1;
      return Response.json(state);
    }
    return Response.json(character);
  });
  renderWithClient(
    <RollingFor value="1">
      <ModeRoll label="Stealth check" type="check" bonus={3} inspiration />
    </RollingFor>,
  );
  return { rolls, writes, reads };
}

describe("ModeRoll inspiration", () => {
  it("rolls a classic character's spent inspiration with advantage and clears it in one write", async () => {
    const { rolls, writes } = render("classic");
    fireEvent.click(await screen.findByRole("button", { name: "Inspiration" }));
    fireEvent.click(screen.getByRole("button", { name: "Roll Stealth check" }));
    await waitFor(() => expect(rolls).toHaveLength(1));
    expect(rolls[0]).toMatchObject({ mode: "advantage" });
    expect(rolls[0]?.dice).toHaveLength(2);
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ inspiration: false });
    await waitFor(() => expect(screen.queryByRole("button", { name: "Inspiration" })).toBeNull());
  });

  it("rerolls a 2024 character's spent inspiration, keeping the second die", async () => {
    vi.spyOn(Math, "random").mockReturnValueOnce(0.95).mockReturnValueOnce(0);
    const { rolls, writes } = render("one");
    fireEvent.click(await screen.findByRole("button", { name: "Inspiration" }));
    fireEvent.click(screen.getByRole("button", { name: "Roll Stealth check" }));
    await waitFor(() => expect(rolls).toHaveLength(1));
    expect(rolls[0]).toMatchObject({ reason: "lucky", total: 4 });
    expect(rolls[0]?.dice).toEqual([
      expect.objectContaining({ value: 20, kept: false }),
      expect.objectContaining({ value: 1, kept: true }),
    ]);
    expect(writes).toHaveLength(1);
  });

  it("swaps the rules where the house rule says so", async () => {
    const { rolls } = render("one", { otherEditionInspiration: true });
    fireEvent.click(await screen.findByRole("button", { name: "Inspiration" }));
    fireEvent.click(screen.getByRole("button", { name: "Roll Stealth check" }));
    await waitFor(() => expect(rolls).toHaveLength(1));
    expect(rolls[0]).toMatchObject({ mode: "advantage" });
  });

  it("rolls without spending when the toggle is left off, and offers none without inspiration", async () => {
    const { rolls, writes } = render("classic");
    await screen.findByRole("button", { name: "Inspiration" });
    fireEvent.click(screen.getByRole("button", { name: "Roll Stealth check" }));
    await waitFor(() => expect(rolls).toHaveLength(1));
    expect(rolls[0]).toMatchObject({ mode: "normal" });
    expect(writes).toHaveLength(0);
    cleanup();
    const { reads } = render("classic", {}, false);
    await waitFor(() => expect(reads.state).toBe(1));
    await act(async () => {});
    expect(screen.queryByRole("button", { name: "Inspiration" })).toBeNull();
  });

  it("does not offer a reroll with a mode or a named die", async () => {
    render("one");
    const toggle = await screen.findByRole("button", { name: "Inspiration" });
    fireEvent.change(screen.getByRole("combobox", { name: "Stealth check mode" }), {
      target: { value: "advantage" },
    });
    expect(toggle).toHaveAttribute("aria-disabled", "true");
  });
});
