import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Select } from "./Select.tsx";

const OPTIONS = ["Copper", "Silver", "Gold", "Platinum"].map((coin) => ({
  value: coin.toLowerCase(),
  label: coin,
}));

function Harness({ onChange }: { onChange?: (next: string) => void }) {
  const [value, setValue] = useState("silver");
  return (
    <>
      <label htmlFor="coin">Coin</label>
      <Select
        id="coin"
        options={OPTIONS}
        value={value}
        onChange={(next) => {
          setValue(next);
          onChange?.(next);
        }}
      />
      <button type="button">Elsewhere</button>
    </>
  );
}

const combobox = () => screen.getByRole("combobox", { name: "Coin" });
const active = () =>
  document.getElementById(String(combobox().getAttribute("aria-activedescendant")));
const key = (name: string) => fireEvent.keyDown(combobox(), { key: name });

describe("Select", () => {
  it("names the chosen option on a closed combobox that pops up a listbox", () => {
    render(<Harness />);
    expect(combobox()).toHaveTextContent("Silver");
    expect(combobox()).toHaveAttribute("aria-haspopup", "listbox");
    expect(combobox()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("opens on ArrowDown at the chosen option, moves without wrapping, and picks on Enter", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    act(() => combobox().focus());

    key("ArrowDown");
    expect(combobox()).toHaveAttribute("aria-expanded", "true");
    expect(active()).toHaveTextContent("Silver");
    key("ArrowDown");
    key("ArrowDown");
    key("ArrowDown");
    expect(active()).toHaveTextContent("Platinum");
    key("Home");
    expect(active()).toHaveTextContent("Copper");
    key("ArrowUp");
    expect(active()).toHaveTextContent("Copper");
    key("End");
    expect(active()).toHaveTextContent("Platinum");

    key("Enter");
    expect(onChange).toHaveBeenCalledWith("platinum");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(combobox()).toHaveTextContent("Platinum");
    expect(combobox()).toHaveFocus();
  });

  it("opens and picks on Space", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    key(" ");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    key("ArrowUp");
    key(" ");
    expect(onChange).toHaveBeenCalledWith("copper");
    // Cancelled, so an engine activating the button on keyup does not reopen the list.
    expect(fireEvent.keyUp(combobox(), { key: " " })).toBe(false);
  });

  it("closes on Escape without picking, focus on the combobox", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    act(() => combobox().focus());
    key("End");
    key("Escape");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    expect(combobox()).toHaveFocus();
    expect(combobox()).not.toHaveAttribute("aria-activedescendant");
  });

  it("checks the chosen option and picks one clicked", () => {
    render(<Harness />);
    fireEvent.click(combobox());
    expect(screen.getByRole("listbox", { name: "Coin" })).toBeInTheDocument();
    expect(screen.getByRole("option", { selected: true })).toHaveTextContent("Silver");
    fireEvent.click(screen.getByRole("option", { name: "Gold" }));
    expect(combobox()).toHaveTextContent("Gold");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("closes when focus leaves it", () => {
    render(<Harness />);
    act(() => combobox().focus());
    fireEvent.click(combobox());
    act(() => screen.getByRole("button", { name: "Elsewhere" }).focus());
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
