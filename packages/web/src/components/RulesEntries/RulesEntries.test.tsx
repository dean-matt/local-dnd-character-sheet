import type { Entries } from "@dnd/catalog";
import { screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithClient } from "../../test/renderWithClient.tsx";
import { stubFetchByUrl } from "../../test/stubFetch.ts";
import { RulesEntries } from "./RulesEntries.tsx";

describe("RulesEntries", () => {
  it("renders a plain string as a paragraph of rules text", () => {
    const { container } = renderWithClient(
      <RulesEntries entries={["Deals {@damage 2d6} fire damage."]} />,
    );
    expect(container).toHaveTextContent("Deals 2d6 fire damage.");
  });

  it("renders a named subsection with its heading and nested prose", () => {
    const entries: Entries = [
      { type: "entries", name: "Skill Proficiencies", entries: ["Choose two skills."] },
    ];
    const { container } = renderWithClient(<RulesEntries entries={entries} />);
    expect(screen.getByRole("heading", { name: "Skill Proficiencies" })).toBeInTheDocument();
    expect(container).toHaveTextContent("Choose two skills.");
  });

  it("renders a list, including a named item's label and body", () => {
    const entries: Entries = [
      {
        type: "list",
        items: ["Plain item", { type: "item", name: "Languages:", entry: "One of your choice." }],
      },
    ];
    renderWithClient(<RulesEntries entries={entries} />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Plain item");
    expect(items[1]).toHaveTextContent("Languages:");
    expect(items[1]).toHaveTextContent("One of your choice.");
  });

  it("renders a list item that is itself a nested list, rather than dropping it", () => {
    const entries: Entries = [
      {
        type: "list",
        items: [
          {
            type: "list",
            items: ["Nested one", "Nested two"],
          },
        ],
      },
    ];
    renderWithClient(<RulesEntries entries={entries} />);
    expect(screen.getByText("Nested one")).toBeInTheDocument();
    expect(screen.getByText("Nested two")).toBeInTheDocument();
  });

  it("renders a table as a structured table, not its JSON", () => {
    const entries: Entries = [
      {
        type: "table",
        caption: "Goblins by Type",
        colLabels: ["Goblin", "Trait"],
        rows: [["Goblin Boss", "Nimble Escape"]],
      },
    ];
    renderWithClient(<RulesEntries entries={entries} />);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("Goblins by Type").tagName).toBe("CAPTION");
    const header = screen.getByRole("columnheader", { name: "Goblin" });
    expect(header).toBeInTheDocument();
    expect(header).toHaveAttribute("scope", "col");
    expect(screen.getByRole("cell", { name: "Nimble Escape" })).toBeInTheDocument();
    expect(screen.queryByText(/"type":\s*"table"/)).not.toBeInTheDocument();
  });

  it("renders a rollable table's plain, exact and ranged cells", () => {
    const entries: Entries = [
      {
        type: "table",
        colLabels: ["{@dice d6}", "Result"],
        rows: [
          [1, "Single number"],
          ["2-3", "Shorthand range"],
          [{ type: "cell", roll: { exact: 4, pad: true } }, "Padded number"],
          [{ type: "cell", roll: { min: 5, max: 6 } }, "Long-hand range"],
        ],
      },
    ];
    renderWithClient(<RulesEntries entries={entries} />);
    expect(screen.getByRole("cell", { name: "1" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "2-3" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "04" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "5-6" })).toBeInTheDocument();
  });

  it("prefers a cell's own entry text over its roll when both are present", () => {
    const entries: Entries = [
      {
        type: "table",
        rows: [[{ type: "cell", entry: "4 or lower", roll: { min: 1, max: 4 } }, "Miss"]],
      },
    ];
    renderWithClient(<RulesEntries entries={entries} />);
    expect(screen.getByRole("cell", { name: "4 or lower" })).toBeInTheDocument();
  });

  it("names the row a reference node points at, rather than rendering nothing", () => {
    const entries: Entries = [
      { type: "refSubclassFeature", subclassFeature: "Frenzy|Barbarian||Berserker||3" },
      {
        type: "options",
        entries: [
          { type: "refOptionalfeature", optionalfeature: "Archery" },
          { type: "refClassFeature", classFeature: "Rage|Barbarian||1" },
        ],
      },
    ];
    const { container } = renderWithClient(<RulesEntries entries={entries} />);
    expect([...container.querySelectorAll("p")].map((p) => p.textContent)).toEqual([
      "Frenzy",
      "Archery",
      "Rage",
    ]);
  });

  it("never throws on a node type it does not know", () => {
    const entries: Entries = [{ type: "gallery", images: ["nope"] }];
    expect(() => renderWithClient(<RulesEntries entries={entries} />)).not.toThrow();
  });
});

describe("reference resolution", () => {
  afterEach(() => vi.unstubAllGlobals());

  const FIREBALL = {
    name: "Fireball",
    source: "PHB",
    entries: [{ type: "list", items: ["A bright streak flashes from your {@b finger}."] }],
    path: "/spells/Fireball/PHB",
  };

  const requested = (fetchMock: ReturnType<typeof vi.fn>) =>
    fetchMock.mock.calls.map(([url, init]) => [url, JSON.parse(init.body).refs]);

  it("asks once for every distinct reference in a block, subsections included", async () => {
    const fetchMock = stubFetchByUrl({ "/api/refs/resolve": { refs: [FIREBALL, null] } });
    const entries: Entries = [
      "Cast {@spell fireball} or {@condition blinded|XPHB}.",
      { type: "entries", name: "Again", entries: ["{@i {@spell fireball}} once more."] },
    ];
    renderWithClient(<RulesEntries entries={entries} />);

    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: "fireball" })).toHaveLength(2),
    );
    expect(requested(fetchMock)).toEqual([
      [
        "/api/refs/resolve",
        [
          { tag: "spell", name: "fireball" },
          { tag: "condition", name: "blinded", source: "XPHB" },
        ],
      ],
    ]);
    expect(screen.getByText("blinded")).toHaveAttribute("data-tag", "condition");
  });
});
