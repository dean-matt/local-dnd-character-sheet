import type { CharacterDerived } from "@dnd/character";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ValueBlockView } from "./ValueBlock.tsx";

const block = { kind: "value" as const, field: "armorClass" as const };

describe("ValueBlockView", () => {
  it("degrades when nothing has derived the character yet", () => {
    render(<ValueBlockView block={block} character={undefined} derived={undefined} />);
    expect(screen.getByText("Armor Class isn't available yet.")).toBeInTheDocument();
  });

  it("shows the derived block's own number, not arithmetic of its own", () => {
    const derived = {
      armorClass: { computed: 14, manual: null, terms: [] },
    } as unknown as CharacterDerived;
    render(<ValueBlockView block={block} character={undefined} derived={derived} />);
    expect(screen.getByText("14")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("prefers a manual override the same way the sheet does", () => {
    const derived = {
      armorClass: { computed: 14, manual: 18, terms: [] },
    } as unknown as CharacterDerived;
    render(<ValueBlockView block={block} character={undefined} derived={derived} />);
    expect(screen.getByText("18")).toBeInTheDocument();
  });

  it("opens the same breakdown the sheet shows, behind a popover", async () => {
    const derived = {
      armorClass: {
        computed: 14,
        manual: null,
        terms: [
          { label: "Base", value: 10 },
          { label: "Dexterity", value: 4 },
        ],
      },
    } as unknown as CharacterDerived;
    render(<ValueBlockView block={block} character={undefined} derived={derived} />);

    const trigger = screen.getByRole("button", { name: "14" });
    trigger.focus();
    expect(await screen.findByText("Dexterity")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });
});
