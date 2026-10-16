import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { Combobox } from "./Combobox.tsx";

function Holder({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <label htmlFor="dice">Damage</label>
      <Combobox
        id="dice"
        options={["1d4", "1d6", "1d8", "1d10"]}
        value={value}
        onChange={setValue}
      />
    </>
  );
}

const input = () => screen.getByRole("combobox", { name: "Damage" });
const options = () => screen.queryAllByRole("option").map((option) => option.textContent);

describe("Combobox", () => {
  it("opens on Down, moves with the arrows, and fills the input on Enter", () => {
    render(<Holder />);
    expect(input()).toHaveAttribute("aria-expanded", "false");

    fireEvent.keyDown(input(), { key: "ArrowDown" });
    expect(options()).toEqual(["1d4", "1d6", "1d8", "1d10"]);
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    expect(input().getAttribute("aria-activedescendant")).toBe(
      screen.getByRole("option", { name: "1d6" }).id,
    );
    fireEvent.keyDown(input(), { key: "Enter" });

    expect(input()).toHaveValue("1d6");
    expect(options()).toEqual([]);
  });

  it("narrows to the options holding the text, and keeps a value none holds", () => {
    render(<Holder />);

    fireEvent.change(input(), { target: { value: "1d1" } });
    expect(options()).toEqual(["1d10"]);
    fireEvent.change(input(), { target: { value: "3d6" } });
    expect(options()).toEqual([]);
    expect(input()).toHaveValue("3d6");
  });

  it("offers every option while the value is one of them, and closes on Escape", () => {
    render(<Holder initial="1d8" />);

    fireEvent.click(input());
    expect(options()).toEqual(["1d4", "1d6", "1d8", "1d10"]);
    expect(screen.getByRole("option", { name: "1d8" })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("option", { name: "1d4" }));
    expect(input()).toHaveValue("1d4");

    fireEvent.click(input());
    fireEvent.keyDown(input(), { key: "Escape" });
    expect(options()).toEqual([]);
  });
});
