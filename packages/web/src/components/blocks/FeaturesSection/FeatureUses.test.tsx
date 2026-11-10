import type { CharacterFeatures } from "@dnd/catalog";
import type { CharacterState } from "@dnd/character";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterRecord, stateRecord } from "../../../test/records.ts";
import { renderWithClient } from "../../../test/renderWithClient.tsx";
import { FeaturesSection } from "./FeaturesSection.tsx";

const RELENTLESS = "trait|catalog|Half-Orc|PHB|Relentless Endurance";

const FEATURES: CharacterFeatures = {
  groups: [
    {
      origin: "class",
      name: "Fighter",
      features: [
        {
          resolved: true,
          name: "Second Wind",
          source: "PHB",
          level: 1,
          entries: [],
          uses: { key: "feature|Fighter|PHB|||1|PHB|Second Wind", count: 1, reset: "short" },
        },
        { resolved: true, name: "Fighting Style", source: "PHB", level: 1, entries: [] },
      ],
    },
    {
      origin: "race",
      name: "Half-Orc",
      features: [
        {
          resolved: true,
          name: "Relentless Endurance",
          source: "PHB",
          entries: [],
          uses: { key: RELENTLESS, count: 2, reset: "long" },
        },
      ],
    },
    {
      origin: "feat",
      features: [
        {
          resolved: true,
          name: "Lucky",
          source: "PHB",
          level: 4,
          entries: [],
          uses: { key: "feat|PHB|Lucky", count: 3, reset: "long" },
        },
      ],
    },
  ],
};

/** The section over a stand-in API that keeps each state write and answers later reads with it. */
function renderFeatures(state: Partial<CharacterState> = {}) {
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
  const render = () =>
    renderWithClient(
      <FeaturesSection character={characterRecord("1", "Vex")} derived={undefined} />,
    );
  const view = render();
  return {
    writes,
    reload() {
      view.unmount();
      render();
    },
  };
}

const row = (name: string) => screen.getByText(name).closest("li") as HTMLElement;

afterEach(() => vi.unstubAllGlobals());

describe("FeatureUses", () => {
  it("shows a class, race and chosen feature's uses left, out of its count, and its rest", async () => {
    renderFeatures({ featureUses: [{ key: RELENTLESS, expended: 1 }] });

    await waitFor(() => expect(row("Second Wind")).toHaveTextContent("1 / 1 Short rest"));
    expect(row("Relentless Endurance")).toHaveTextContent("1 / 2 Long rest");
    expect(row("Lucky")).toHaveTextContent("3 / 3 Long rest");
  });

  it("offers nothing on a feature with no limited uses", async () => {
    renderFeatures();

    await waitFor(() => expect(row("Second Wind")).toHaveTextContent("1 / 1"));
    expect(row("Fighting Style")).not.toHaveTextContent(/\d \/ \d/);
    expect(within(row("Fighting Style")).queryByRole("button", { name: /use of/ })).toBeNull();
  });

  it("spends a use, and the count left survives a reload", async () => {
    const { writes, reload } = renderFeatures({ featureUses: [{ key: RELENTLESS, expended: 1 }] });
    await waitFor(() => expect(row("Lucky")).toHaveTextContent("3 / 3"));

    fireEvent.click(within(row("Lucky")).getByRole("button", { name: "Spend a use of Lucky" }));

    await waitFor(() => expect(row("Lucky")).toHaveTextContent("2 / 3"));
    expect(writes[0]?.featureUses).toEqual([
      { key: RELENTLESS, expended: 1 },
      { key: "feat|PHB|Lucky", expended: 1 },
    ]);
    reload();
    await waitFor(() => expect(row("Lucky")).toHaveTextContent("2 / 3 Long rest"));
  });

  it("spends a use in a card filtered to its limited uses as it does unfiltered", async () => {
    const { writes } = renderFeatures();
    await waitFor(() => expect(row("Second Wind")).toHaveTextContent("1 / 1"));
    const classes = within(
      screen
        .getByRole("heading", { level: 3, name: "Class Features" })
        .closest("section") as HTMLElement,
    );
    fireEvent.click(classes.getByRole("button", { name: /^Filter / }));
    fireEvent.click(classes.getByLabelText("Has limited uses"));
    expect(classes.queryByText("Fighting Style")).toBeNull();

    fireEvent.click(classes.getByRole("button", { name: "Spend a use of Second Wind" }));

    await waitFor(() => expect(row("Second Wind")).toHaveTextContent("0 / 1"));
    expect(writes[0]?.featureUses).toEqual([
      { key: "feature|Fighter|PHB|||1|PHB|Second Wind", expended: 1 },
    ]);
    expect(classes.getByLabelText("Has limited uses")).toBeChecked();
  });

  it("offers no spend once every use is gone, and restores one", async () => {
    const { writes } = renderFeatures({ featureUses: [{ key: RELENTLESS, expended: 2 }] });
    await waitFor(() => expect(row("Relentless Endurance")).toHaveTextContent("0 / 2"));
    const relentless = within(row("Relentless Endurance"));
    const spend = relentless.getByRole("button", { name: "Spend a use of Relentless Endurance" });
    expect(spend).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(spend);
    fireEvent.click(
      relentless.getByRole("button", { name: "Restore a use of Relentless Endurance" }),
    );

    await waitFor(() => expect(row("Relentless Endurance")).toHaveTextContent("1 / 2"));
    expect(writes).toHaveLength(1);
  });
});
