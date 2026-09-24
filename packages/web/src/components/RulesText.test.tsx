import type { Entries } from "@dnd/catalog";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RulesEntries, RulesText } from "./RulesText.tsx";

describe("RulesText", () => {
  it("renders plain text with no markup", () => {
    render(<RulesText text="plain prose" />);
    expect(screen.getByText("plain prose")).toBeInTheDocument();
  });

  it("renders every token kind tier 1 produces", () => {
    const { container } = render(
      <RulesText text="{@b Bold} and {@dc 15} save against {@spell fireball} for {@damage 8d6}." />,
    );

    // style: bold renders as its element
    expect(screen.getByText("Bold").tagName).toBe("STRONG");
    // a computed text token
    expect(container).toHaveTextContent("DC 15");
    // ref and roll: unlinked display text, each its own element
    expect(screen.getByText("fireball").tagName).toBe("SPAN");
    expect(screen.getByText("8d6").tagName).toBe("SPAN");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("degrades an unknown tag to plain text instead of throwing", () => {
    expect(() => render(<RulesText text="{@notarealtag surprise}" />)).not.toThrow();
    expect(screen.getByText("surprise")).toBeInTheDocument();
  });

  it("maps every formatting tag to the element it means", () => {
    render(
      <RulesText
        text="{@i italic} {@u underline} {@u2 dblunder} {@s strike} {@s2 dblstrike}
          {@sup sup} {@sub sub} {@kbd key} {@highlight hi} {@code mono}"
      />,
    );
    expect(screen.getByText("italic").tagName).toBe("EM");
    expect(screen.getByText("underline").tagName).toBe("U");
    expect(screen.getByText("dblunder").tagName).toBe("U");
    expect(screen.getByText("dblunder")).toHaveClass("decoration-double");
    expect(screen.getByText("strike").tagName).toBe("S");
    expect(screen.getByText("dblstrike").tagName).toBe("S");
    expect(screen.getByText("dblstrike")).toHaveClass("decoration-double");
    expect(screen.getByText("sup").tagName).toBe("SUP");
    expect(screen.getByText("sub").tagName).toBe("SUB");
    expect(screen.getByText("key").tagName).toBe("KBD");
    expect(screen.getByText("hi").tagName).toBe("MARK");
    expect(screen.getByText("mono").tagName).toBe("CODE");
  });
});

describe("RulesEntries", () => {
  it("renders a plain string as a paragraph of rules text", () => {
    const { container } = render(<RulesEntries entries={["Deals {@damage 2d6} fire damage."]} />);
    expect(container).toHaveTextContent("Deals 2d6 fire damage.");
  });

  it("renders a named subsection with its heading and nested prose", () => {
    const entries: Entries = [
      { type: "entries", name: "Skill Proficiencies", entries: ["Choose two skills."] },
    ];
    const { container } = render(<RulesEntries entries={entries} />);
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
    render(<RulesEntries entries={entries} />);
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
    render(<RulesEntries entries={entries} />);
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
    render(<RulesEntries entries={entries} />);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("Goblins by Type").tagName).toBe("CAPTION");
    expect(screen.getByRole("columnheader", { name: "Goblin" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Nimble Escape" })).toBeInTheDocument();
    expect(screen.queryByText(/"type":\s*"table"/)).not.toBeInTheDocument();
  });

  it("never throws on a node type it does not know", () => {
    const entries: Entries = [{ type: "gallery", images: ["nope"] }];
    expect(() => render(<RulesEntries entries={entries} />)).not.toThrow();
  });
});
