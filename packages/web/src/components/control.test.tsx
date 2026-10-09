import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InputField } from "./InputField.tsx";
import { Select } from "./Select.tsx";

describe("the control box", () => {
  it("is the one class a text input and a select's button both draw, so they stand one height", () => {
    render(
      <>
        <InputField label="Name" />
        <label htmlFor="rarity">Rarity</label>
        <Select
          id="rarity"
          options={[{ value: "rare", label: "Rare" }]}
          value="rare"
          onChange={() => {}}
        />
      </>,
    );
    const name = screen.getByRole("textbox", { name: "Name" });
    const rarity = screen.getByRole("combobox", { name: "Rarity" });
    expect(name).toHaveClass("control");
    expect(rarity).toHaveClass("control");
    // A padding or text size of either one's own would let the two drift apart again.
    for (const element of [name, rarity])
      expect(element.className).not.toMatch(/\b(py-|text-(?!ink\b))/);
  });
});
