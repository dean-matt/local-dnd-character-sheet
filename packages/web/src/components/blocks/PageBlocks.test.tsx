import type { PageBlock } from "@dnd/character";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageBlocks } from "./PageBlocks.tsx";

describe("PageBlocks", () => {
  it("renders every block kind, in order", () => {
    const blocks: PageBlock[] = [
      { kind: "text", text: "First." },
      { kind: "value", field: "armorClass" },
      { kind: "section", section: "spells" },
      { kind: "list", source: "inventory", filter: {} },
      { kind: "unknown", raw: { kind: "x" } },
    ];
    render(<PageBlocks blocks={blocks} derived={undefined} />);

    const order = screen.getAllByText(
      /First\.|isn't built yet\.|isn't available yet\.|isn't recognized/,
    );
    expect(order.map((el) => el.textContent)).toEqual([
      "First.",
      "Armor Class isn't available yet.",
      "Spells isn't built yet.",
      "Inventory isn't available yet.",
      "This block isn't recognized by this build.",
    ]);
  });

  it("keeps rendering the blocks around one it does not recognize", () => {
    const blocks: PageBlock[] = [
      { kind: "text", text: "Before." },
      { kind: "unknown", raw: { kind: "x" } },
      { kind: "text", text: "After." },
    ];
    render(<PageBlocks blocks={blocks} derived={undefined} />);

    expect(screen.getByText("Before.")).toBeInTheDocument();
    expect(screen.getByText("After.")).toBeInTheDocument();
  });
});
