import type { FeatRecord, HomebrewFeatRecord } from "@dnd/catalog";
import type { Improvement } from "@dnd/character";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SheetExclusions } from "../hooks/useDisabledSources.ts";
import type { Candidate } from "../lib/improvementFeats.ts";
import { ImprovementField } from "./ImprovementField.tsx";

const feat = (name: string): FeatRecord => ({
  name,
  source: "XPHB",
  edition: "one",
  json: { name, source: "XPHB", category: "O" },
});
const homebrew = (id: string, name: string): HomebrewFeatRecord => ({
  id,
  name,
  edition: "one",
  json: { name, source: "HB", category: "O" },
  createdAt: "2026-10-28T00:00:00.000Z",
});
const CATALOG = [feat("Alert"), feat("Skilled")];
const HOMEBREW = [homebrew("hf-1", "Alert"), homebrew("hf-2", "Quick Study")];

const SCORES = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
const CANDIDATE: Candidate = {
  edition: "one",
  takesFeats: true,
  level: 4,
  classNames: ["Wizard"],
  scores: SCORES,
  totals: SCORES,
  held: [],
  earlier: [],
  race: undefined,
  armor: undefined,
  weapons: undefined,
  features: [],
  knowsSpells: false,
};

/** Answers `/feats` with the catalog and `/homebrew/feats` once `release` resolves. */
function stubFeats() {
  let release = () => {};
  const homebrewRead = new Promise<void>((resolve) => {
    release = resolve;
  });
  vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith("/api/feats?"))
      return new Response(JSON.stringify({ items: CATALOG, total: CATALOG.length }));
    if (url === "/api/homebrew/feats") {
      await homebrewRead;
      return new Response(JSON.stringify(HOMEBREW));
    }
    return new Response("[]");
  });
  return release;
}

function renderField(
  improvement: Improvement | undefined,
  excluded?: string[],
  feats: readonly (FeatRecord | HomebrewFeatRecord)[] = CATALOG,
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <SheetExclusions.Provider value={excluded}>
        <ImprovementField
          name="Level 4"
          improvement={improvement}
          feats={feats}
          candidate={CANDIDATE}
          onChange={() => {}}
        />
      </SheetExclusions.Provider>
    </QueryClientProvider>,
  );
}

const combobox = () => screen.getByRole("combobox", { name: "Level 4 choice" });

/** Opens the select and reads each option's label. */
const optionLabels = () => {
  fireEvent.click(combobox());
  return within(screen.getByRole("listbox"))
    .getAllByRole("option")
    .map((option) => option.textContent);
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ImprovementField with homebrew feats", () => {
  it("offers scores and the taken feat while homebrew feats load, then joins them, labeling a shared name", async () => {
    const release = stubFeats();
    renderField({ feat: { homebrewId: "hf-2" }, increases: [] });

    expect(optionLabels()).toEqual(["Raise ability scores", "Homebrew"]);
    fireEvent.click(combobox());

    release();
    await waitFor(() => expect(combobox()).toHaveTextContent("Quick Study"));
    expect(optionLabels()).toEqual([
      "Raise ability scores",
      "Alert (XPHB)",
      "Skilled",
      "Alert (homebrew)",
      "Quick Study",
    ]);
  });

  it("keeps a held homebrew feat offered, by name, while the Homebrew source is off", async () => {
    stubFeats()();
    renderField({ feat: { homebrewId: "hf-2" }, increases: [] }, ["HB"]);

    await waitFor(() => expect(combobox()).toHaveTextContent("Quick Study"));
    expect(optionLabels()).toEqual(["Raise ability scores", "Alert", "Skilled", "Quick Study"]);
  });
});

describe("ImprovementField with a homebrew feat that raises a score", () => {
  const steady: HomebrewFeatRecord = {
    ...homebrew("hf-3", "Steady"),
    json: { name: "Steady", source: "HB", ability: [{ choose: { from: ["str", "dex"] } }] },
  };

  it("shows the feat's increase dropdown, and names the feat when it is not offered", async () => {
    stubFeats()();
    renderField({ feat: { homebrewId: "hf-3" }, increases: [] }, undefined, [steady]);

    expect(screen.getByRole("combobox", { name: "Level 4 +1" })).toBeDefined();
    expect(combobox()).toHaveTextContent("Steady");
  });
});
