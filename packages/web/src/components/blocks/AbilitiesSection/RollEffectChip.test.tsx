import type { RollEffectEntry } from "@dnd/character";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RollEffectChip } from "./RollEffectChip.tsx";

const KEY = { item: "Infiltrator's Key", mode: "advantage", roll: "check" } as const;
const CLOAK = { item: "Cloak of the Mind", mode: "disadvantage", roll: "check" } as const;
const MANTLE = {
  item: "Mantle of Spell Resistance",
  mode: "advantage",
  roll: "save",
  condition: "against spells",
} as const;

function chip(effects: readonly RollEffectEntry[]) {
  render(<RollEffectChip roll="Stealth check" effects={effects} />);
  return screen.queryByRole("button");
}

describe("RollEffectChip", () => {
  it("draws nothing for a roll no effect marks", () => {
    expect(chip([])).toBeNull();
  });

  it("reads ADV or DIS where unconditional effects of one mode apply", () => {
    expect(chip([KEY])).toHaveTextContent(/^ADV$/);
    expect(screen.getByRole("button")).toHaveAccessibleName("Stealth check: Advantage");
  });

  it("strikes ADV/DIS through where advantage and disadvantage cancel", () => {
    const button = chip([KEY, CLOAK]);
    expect(button).toHaveAccessibleName("Stealth check: Advantage and disadvantage cancel");
    expect(button?.firstElementChild).toHaveClass("line-through");
  });

  it("outlines the chip with an asterisk where an effect carries a condition", () => {
    const button = chip([MANTLE]);
    expect(button).toHaveTextContent(/^ADV\*$/);
    expect(button).toHaveAccessibleName("Stealth check: Advantage if every condition holds");
    expect(button?.firstElementChild).toHaveClass("bg-surface");
  });

  it("lists every effect once with its item and condition, then the net result", () => {
    fireEvent.focus(chip([KEY, { ...KEY, roll: "skill", target: "Stealth" }, MANTLE]) as Element);
    const popover = screen.getByRole("group", { name: "Stealth check advantage and disadvantage" });
    expect(popover).toHaveTextContent(
      "Advantage (Infiltrator's Key)Advantage against spells (Mantle of Spell Resistance)Advantage if every condition holds",
    );
  });
});
