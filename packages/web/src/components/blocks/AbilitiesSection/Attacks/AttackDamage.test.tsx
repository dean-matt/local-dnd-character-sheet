import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { SaveOverride } from "../../../overrideContext.ts";
import type { Attack } from "../../attack.ts";
import { AttackDamage } from "./AttackDamage.tsx";

const plain = { manual: null, terms: [] };
const attack = (overrides: { modifier?: number; crit?: number } = {}): Attack => ({
  entry: 0,
  ability: "str",
  attackBonus: { computed: 5, ...plain },
  critThreshold: { computed: 20, ...plain, manual: overrides.crit ?? null },
  damage: {
    dice: "1d8",
    type: "slashing",
    modifier: { computed: 3, ...plain, manual: overrides.modifier ?? null },
  },
  grip: null,
  mastery: [],
  range: null,
  ammunition: null,
  reload: null,
});

function onPage(ui: ReactElement) {
  const save = vi.fn().mockResolvedValue(undefined);
  render(<SaveOverride.Provider value={save}>{ui}</SaveOverride.Provider>);
  return save;
}

describe("AttackDamage", () => {
  it("saves the damage modifier and the critical threshold under the weapon's key", async () => {
    const save = onPage(
      <AttackDamage name="Longsword" attack={attack()} overrideKey="attacks.k#0">
        1d8+3 slashing
      </AttackDamage>,
    );
    fireEvent.click(screen.getByRole("button", { name: "1d8+3 slashing" }));
    for (const [name, value] of [
      ["Longsword damage modifier override", "5"],
      ["Longsword critical hit threshold override", "19"],
    ] as const) {
      fireEvent.change(screen.getByRole("textbox", { name }), { target: { value } });
    }
    fireEvent.keyDown(screen.getByRole("group", { name: "Longsword damage breakdown" }), {
      key: "Escape",
    });
    await waitFor(() => {
      expect(save).toHaveBeenCalledWith("attacks.k#0.damage.modifier", 5);
      expect(save).toHaveBeenCalledWith("attacks.k#0.critThreshold", 19);
    });
  });

  it("marks each overridden number on the cell", () => {
    render(
      <AttackDamage name="Longsword" attack={attack({ modifier: 5, crit: 19 })} overrideKey="k">
        1d8+5 slashing
      </AttackDamage>,
    );
    expect(screen.getByTitle("Overridden; computed damage modifier +3")).toBeInTheDocument();
    expect(screen.getByTitle("Overridden; computed critical hit on 20")).toBeInTheDocument();
  });

  it("is the bare cell off the character page, with nothing to explain", () => {
    render(
      <AttackDamage name="Longsword" attack={attack()} overrideKey="k">
        1d8+3 slashing
      </AttackDamage>,
    );
    expect(screen.getByText("1d8+3 slashing")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
