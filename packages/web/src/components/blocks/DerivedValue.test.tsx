import { characterDerivedSchema, type Derived } from "@dnd/character";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { SaveOverride } from "../overrideContext.ts";
import { DerivedValue } from "./DerivedValue.tsx";

const computed: Derived<number> = {
  computed: 15,
  manual: null,
  terms: [
    { label: "Base", value: 10 },
    { label: "Dexterity", value: 5 },
  ],
};
const overridden: Derived<number> = { ...computed, manual: 18 };

function onPage(ui: ReactElement) {
  const save = vi.fn().mockResolvedValue(undefined);
  render(<SaveOverride.Provider value={save}>{ui}</SaveOverride.Provider>);
  return save;
}

const open = (name: string) => fireEvent.click(screen.getByRole("button", { name }));

describe("DerivedValue", () => {
  it("saves a typed override under its key", async () => {
    const save = onPage(
      <DerivedValue name="Armor Class" value={computed} format={String} overrideKey="armorClass" />,
    );
    open("Armor Class 15");
    const field = screen.getByRole("textbox", { name: "Armor Class override" });
    expect(field).toHaveValue("15");
    fireEvent.change(field, { target: { value: "18" } });
    fireEvent.blur(field);
    await waitFor(() => expect(save).toHaveBeenCalledWith("armorClass", 18));
  });

  it("drops the override when the field is cleared", async () => {
    const save = onPage(
      <DerivedValue
        name="Armor Class"
        value={overridden}
        format={String}
        overrideKey="armorClass"
      />,
    );
    open("Armor Class 18, overridden from 15");
    const field = screen.getByRole("textbox", { name: "Armor Class override" });
    fireEvent.change(field, { target: { value: "" } });
    fireEvent.blur(field);
    await waitFor(() => expect(save).toHaveBeenCalledWith("armorClass", null));
  });

  it("refuses a value the field's own schema refuses, rather than saving one that never shows", async () => {
    const save = onPage(
      <DerivedValue
        name="Hit point maximum"
        value={computed}
        format={String}
        overrideKey="hitPointMaximum"
        schema={characterDerivedSchema.shape.hitPointMaximum.shape.computed}
      />,
    );
    open("Hit point maximum 15");
    const field = screen.getByRole("textbox", { name: "Hit point maximum override" });
    fireEvent.change(field, { target: { value: "0" } });
    await waitFor(() => expect(field).toHaveAttribute("aria-invalid", "true"));
    expect(save).not.toHaveBeenCalled();
  });

  it("names the computed value in place of terms that no longer add up", () => {
    onPage(
      <DerivedValue
        name="Armor Class"
        value={overridden}
        format={String}
        overrideKey="armorClass"
      />,
    );
    open("Armor Class 18, overridden from 15");
    const breakdown = screen.getByRole("group", { name: "Armor Class breakdown" });
    expect(breakdown).toHaveTextContent("Overridden from 15.");
    expect(breakdown).not.toHaveTextContent("Dexterity");
  });

  it("shows the terms and no override field off the character page", () => {
    render(
      <DerivedValue name="Armor Class" value={computed} format={String} overrideKey="armorClass" />,
    );
    open("Armor Class 15");
    expect(screen.getByRole("group", { name: "Armor Class breakdown" })).toHaveTextContent(
      "Dexterity5",
    );
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
