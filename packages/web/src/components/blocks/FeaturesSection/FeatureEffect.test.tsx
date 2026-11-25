import type { CharacterFeatures } from "@dnd/catalog";
import type { CharacterDerived, CharacterState } from "@dnd/character";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterRecord, derivedRecord, stateRecord } from "../../../test/records.ts";
import { renderWithClient } from "../../../test/renderWithClient.tsx";
import { FeaturesSection } from "./FeaturesSection.tsx";

const BLADESONG_USES = "feature|Wizard|PHB|Bladesinging|TCE|2|TCE|Bladesong";

const FEATURES: CharacterFeatures = {
  groups: [
    {
      origin: "subclass",
      name: "Bladesinging",
      features: [
        {
          resolved: true,
          name: "Bladesong",
          source: "TCE",
          level: 2,
          entries: [],
          uses: { key: BLADESONG_USES, count: 2, reset: "long" },
        },
        { resolved: true, name: "Training in War and Song", source: "TCE", level: 2, entries: [] },
      ],
    },
    {
      origin: "class",
      name: "Monk",
      features: [{ resolved: true, name: "Empty Body", source: "PHB", level: 18, entries: [] }],
    },
  ],
};

/** The section over a stand-in API that keeps each state write and answers later reads with it. */
function renderFeatures(
  state: Partial<CharacterState> = {},
  bladesongBlockedBy: string | null = null,
  featureRestores: CharacterDerived["featureRestores"] = [],
) {
  let stored = { ...stateRecord(), state: { ...stateRecord().state, ...state } };
  const writes: CharacterState[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/characters/1/features") return new Response(JSON.stringify(FEATURES));
      if (url !== "/api/characters/1/state") return new Response("{}", { status: 404 });
      if (init?.method === "PUT") {
        const written = JSON.parse(String(init.body));
        writes.push(written);
        stored = { ...stored, state: written };
      }
      return new Response(JSON.stringify(stored));
    }),
  );
  const derived = {
    ...derivedRecord(),
    featureRestores,
    startableFeatures: [
      {
        name: "Bladesong",
        source: "TCE",
        endsOn: ["incapacitated" as const, "shield" as const],
        blockedBy: bladesongBlockedBy,
      },
      { name: "Empty Body", source: "PHB", endsOn: [], blockedBy: null },
    ],
  };
  renderWithClient(<FeaturesSection character={characterRecord("1", "Vex")} derived={derived} />);
  return { writes };
}

const row = (name: string) => screen.getByText(name).closest("li") as HTMLElement;

afterEach(() => vi.unstubAllGlobals());

describe("FeatureEffect", () => {
  it("starts an effect in one write that spends a use, and ends it in one that restores none", async () => {
    const { writes } = renderFeatures();

    const start = await screen.findByRole("button", { name: "Start Bladesong" });
    fireEvent.click(start);
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]?.activeEffects).toEqual([{ name: "Bladesong" }]);
    expect(writes[0]?.featureUses).toEqual([{ key: BLADESONG_USES, expended: 1 }]);
    expect(await screen.findByText("Bladesong started.")).toBeInTheDocument();

    fireEvent.click(await screen.findByRole("button", { name: "End Bladesong" }));
    await waitFor(() => expect(writes).toHaveLength(2));
    expect(writes[1]?.activeEffects).toEqual([]);
    expect(writes[1]?.featureUses).toEqual([{ key: BLADESONG_USES, expended: 1 }]);
  });

  it("gives the temporary hit points a use gives when it starts, and offers no spend that gives them alone", async () => {
    const { writes } = renderFeatures({}, null, [
      {
        feature: { name: "Bladesong", source: "TCE" },
        kind: "tempHp",
        dice: null,
        bonus: 7,
        others: false,
      },
    ]);

    fireEvent.click(await screen.findByRole("button", { name: "Start Bladesong" }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]?.activeEffects).toEqual([{ name: "Bladesong" }]);
    expect(writes[0]?.featureUses).toEqual([{ key: BLADESONG_USES, expended: 1 }]);
    expect(writes[0]?.hitPoints.temporary).toBe(7);
    expect(
      within(row("Bladesong")).queryByRole("button", { name: "Spend a use of Bladesong" }),
    ).toBeNull();
    expect(
      within(row("Bladesong")).getByRole("button", { name: "Restore a use of Bladesong" }),
    ).toBeInTheDocument();
  });

  it("gives a heal when it starts and offers no spend that gives it again", async () => {
    const heal = {
      feature: { name: "Bladesong", source: "TCE" },
      kind: "heal" as const,
      dice: null,
      bonus: 3,
      others: false,
    };
    const { writes } = renderFeatures(
      { hitPoints: { ...stateRecord().state.hitPoints, current: 1 } },
      null,
      [heal],
    );
    fireEvent.click(await screen.findByRole("button", { name: "Start Bladesong" }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]?.hitPoints.current).toBeGreaterThan(1);
    expect(
      within(row("Bladesong")).queryByRole("button", { name: "Spend a use of Bladesong" }),
    ).toBeNull();
  });

  it("refuses a start with no use left, and starts a feature that spends nothing", async () => {
    const { writes } = renderFeatures({ featureUses: [{ key: BLADESONG_USES, expended: 2 }] });

    const start = await screen.findByRole("button", { name: "Start Bladesong" });
    expect(start).toHaveAttribute("aria-disabled", "true");
    expect(start).toHaveAttribute("title", "No use left.");
    fireEvent.click(start);

    fireEvent.click(within(row("Empty Body")).getByRole("button", { name: "Start Empty Body" }));
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]?.activeEffects).toEqual([{ name: "Empty Body" }]);
  });

  it("refuses a start in armor that ends the effect", async () => {
    renderFeatures({}, "A shield is equipped.");

    const start = await screen.findByRole("button", { name: "Start Bladesong" });
    expect(start).toHaveAttribute("aria-disabled", "true");
    expect(start).toHaveAttribute("title", "A shield is equipped.");
  });

  it("offers no start on a feature with no effect to run", async () => {
    renderFeatures();

    await screen.findByRole("button", { name: "Start Bladesong" });
    expect(
      within(row("Training in War and Song")).queryByRole("button", { name: /^Start/ }),
    ).toBeNull();
  });
});
