import type { Entries } from "@dnd/catalog";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithClient } from "../../test/renderWithClient.tsx";
import { stubFetch, stubFetchByUrl } from "../../test/stubFetch.ts";
import { RollingFor } from "../rollerContext.ts";
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

describe("a rollable table", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const surge: Entries = [
    {
      type: "table",
      caption: "Wild Magic Surge",
      colLabels: ["{@dice d6}", "Effect"],
      rows: [
        ["1-3", "You turn blue."],
        ["4–6", "You cast {@spell fireball}."],
      ],
    },
  ];

  function onSheet(entries: Entries) {
    const logged = {
      id: 1,
      characterId: "c1",
      characterName: "Vex",
      rolledAt: "2026-01-01T00:00:00.000Z",
      label: "Wild Magic Surge",
      notation: "d6",
      total: 5,
      dice: [],
      modifier: 0,
      critical: false,
    };
    const fetchMock = stubFetch(new Response(JSON.stringify(logged), { status: 201 }));
    renderWithClient(
      <RollingFor value="c1">
        <RulesEntries entries={entries} />
      </RollingFor>,
    );
    return fetchMock;
  }

  const rolls = (fetchMock: ReturnType<typeof vi.fn>) =>
    fetchMock.mock.calls
      .filter(([url]) => String(url) === "/api/characters/c1/rolls")
      .map(([, init]) => JSON.parse(String(init?.body)));

  it("rolls its die from the first column's header and logs the roll", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.7);
    const fetchMock = onSheet(surge);
    fireEvent.click(screen.getByRole("button", { name: "Roll d6 on Wild Magic Surge" }));

    await waitFor(() => expect(rolls(fetchMock)).toHaveLength(1));
    expect(rolls(fetchMock)[0]).toMatchObject({
      type: "dice",
      label: "Wild Magic Surge",
      notation: "1d6",
      total: 5,
    });
  });

  it("highlights the row the total lands in and announces its text", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.7);
    onSheet(surge);
    fireEvent.click(screen.getByRole("button", { name: "Roll d6 on Wild Magic Surge" }));

    const status = () => document.querySelector('[role="status"]');
    await waitFor(() => expect(status()).toHaveTextContent("Rolled 5"));
    expect(screen.getByRole("status")).toHaveTextContent("Rolled 5: You cast fireball.");
    const [, , landed] = screen.getAllByRole("row");
    expect(landed).toHaveAttribute("aria-current", "true");
    expect(within(landed as HTMLElement).getByText("4–6")).toBeInTheDocument();
    expect(
      screen.getAllByRole("row").filter((row) => row.hasAttribute("aria-current")),
    ).toHaveLength(1);
  });

  it("says so when the total lands in no row", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    onSheet([{ type: "table", colLabels: ["d6", "Effect"], rows: [["1-3", "Blue"]] }]);
    fireEvent.click(screen.getByRole("button", { name: "Roll d6 on the table" }));

    await waitFor(() =>
      expect(document.querySelector('[role="status"]')).toHaveTextContent("Rolled 6"),
    );
    expect(screen.getByRole("status")).toHaveTextContent("Rolled 6: no row");
    expect(screen.getAllByRole("row").some((row) => row.hasAttribute("aria-current"))).toBe(false);
  });

  it("announces a repeated total again", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.7);
    const fetchMock = onSheet(surge);
    const button = screen.getByRole("button", { name: "Roll d6 on Wild Magic Surge" });
    const announced = () => document.querySelector('[role="status"] > span');

    fireEvent.click(button);
    await waitFor(() => expect(announced()).not.toBeNull());
    const first = announced();
    fireEvent.click(button);
    await waitFor(() => expect(rolls(fetchMock)).toHaveLength(2));
    await waitFor(() => expect(announced()).not.toBe(first));
    expect(announced()).toHaveTextContent("Rolled 5: You cast fireball.");
  });

  it("highlights the row and says the roll was not logged where the log refuses it", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.7);
    stubFetch(new Response(JSON.stringify({ error: "down" }), { status: 500 }));
    renderWithClient(
      <RollingFor value="c1">
        <RulesEntries entries={surge} />
      </RollingFor>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Roll d6 on Wild Magic Surge" }));

    await waitFor(() => expect(document.querySelector("tr[aria-current]")).not.toBeNull());
    expect(screen.getByRole("status")).toHaveTextContent(
      "Rolled 5: You cast fireball. (not logged)",
    );
    const [, , landed] = screen.getAllByRole("row");
    expect(landed).toHaveAttribute("aria-current", "true");
  });

  it("rolls from a native button, which the keyboard focuses and activates", () => {
    onSheet(surge);
    const button = screen.getByRole("button", { name: "Roll d6 on Wild Magic Surge" });
    expect(button.tagName).toBe("BUTTON");
    button.focus();
    expect(button).toHaveFocus();
  });

  it("keeps the table static where no character is open", () => {
    stubFetchByUrl({});
    renderWithClient(<RulesEntries entries={surge} />);
    expect(screen.queryByRole("button", { name: /Wild Magic Surge/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("keeps a table static whose first column names no die", () => {
    onSheet([{ type: "table", colLabels: ["Level", "Effect"], rows: [["1", "Blue"]] }]);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
