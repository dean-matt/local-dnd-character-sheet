import { characterDefinitionSchema } from "@dnd/character";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCharacter } from "../hooks/useCharacter.ts";
import { characterRecord } from "../test/records.ts";
import { RollBonusButton } from "./RollBonusButton.tsx";
import { RollingFor } from "./rollerContext.ts";

afterEach(() => vi.unstubAllGlobals());

function stub(logs: boolean) {
  const base = characterRecord("1", "Vex");
  const character = {
    ...base,
    definition: characterDefinitionSchema.parse({
      ...base.definition,
      houseRules: { naturalExtremes: true },
    }),
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method !== "POST") return Response.json(character);
      return logs
        ? Response.json(
            {
              ...JSON.parse(String(init.body)),
              id: 1,
              characterId: "1",
              characterName: "Vex",
              rolledAt: new Date().toISOString(),
            },
            { status: 201 },
          )
        : Response.json({}, { status: 500 });
    }),
  );
}

function Loaded() {
  return useCharacter("1").isSuccess ? <p>loaded</p> : null;
}

async function press(logs: boolean, critAt?: number) {
  stub(logs);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RollingFor.Provider value="1">
        <Loaded />
        <RollBonusButton label="Stealth" type="check" origin="x" bonus={5} critAt={critAt} />
      </RollingFor.Provider>
    </QueryClientProvider>,
  );
  await screen.findByText("loaded");
  fireEvent.click(screen.getByRole("button", { name: "Roll Stealth" }));
}

describe("RollBonusButton announcement", () => {
  it("names a natural 20 under the rule", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    await press(true);
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Stealth: 25, automatic success"),
    );
  });

  it("orders critical hit, outcome and not logged", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    await press(false, 20);
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Stealth: 25, critical hit, automatic success, not logged",
      ),
    );
  });
});
