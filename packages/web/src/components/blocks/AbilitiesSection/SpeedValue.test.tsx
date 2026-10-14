import type { CharacterDerived } from "@dnd/character";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SaveOverride } from "../../overrideContext.ts";
import { SpeedValue } from "./SpeedValue.tsx";

type Speed = CharacterDerived["speed"];

const computed: Speed = {
  computed: { walk: 30, swim: 30 },
  manual: null,
  terms: [{ label: "Elf", value: 30 }],
};

function onPage(speed: Speed) {
  const save = vi.fn().mockResolvedValue(undefined);
  render(
    <SaveOverride.Provider value={save}>
      <SpeedValue speed={speed} />
    </SaveOverride.Provider>,
  );
  return save;
}

const open = (name: string) => fireEvent.click(screen.getByRole("button", { name }));

describe("SpeedValue", () => {
  it("saves a mode no race grants under its own key", async () => {
    const save = onPage(computed);
    open("Speed 30");
    const burrow = screen.getByRole("textbox", { name: "Burrow speed override" });
    expect(burrow).toHaveValue("");
    fireEvent.change(burrow, { target: { value: "15" } });
    fireEvent.blur(burrow);
    await waitFor(() => expect(save).toHaveBeenCalledWith("speed.burrow", 15));
  });

  it("drops a mode's override when its field is cleared", async () => {
    const save = onPage({ ...computed, manual: { walk: 30, swim: 60 } });
    open("Speed 30");
    const swim = screen.getByRole("textbox", { name: "Swim speed override" });
    expect(swim).toHaveValue("60");
    fireEvent.change(swim, { target: { value: "" } });
    fireEvent.blur(swim);
    await waitFor(() => expect(save).toHaveBeenCalledWith("speed.swim", null));
  });

  it("marks the walking speed and each other mode only where that mode is overridden", () => {
    onPage({ ...computed, manual: { walk: 25, swim: 30 } });
    expect(
      screen.getByRole("button", { name: "Speed 25, overridden from 30" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/swim 30 ft\./)).not.toHaveTextContent("overridden");
    open("Speed 25, overridden from 30");
    expect(screen.getByRole("group", { name: "Speed breakdown" })).toHaveTextContent(
      "Overridden from 30 ft., swim 30 ft.",
    );
  });

  it("marks another mode's override beside it", () => {
    onPage({ ...computed, manual: { walk: 30, swim: 30, fly: 10 } });
    expect(screen.getByText(/fly 10 ft\./)).toHaveTextContent("overridden from none");
  });

  it("refuses a negative speed rather than saving one the block drops", async () => {
    const save = onPage(computed);
    open("Speed 30");
    const walk = screen.getByRole("textbox", { name: "Walk speed override" });
    fireEvent.change(walk, { target: { value: "-5" } });
    await waitFor(() => expect(walk).toHaveAttribute("aria-invalid", "true"));
    expect(save).not.toHaveBeenCalled();
  });

  it("shows the terms and no override field off the character page", () => {
    render(<SpeedValue speed={computed} />);
    open("Speed 30");
    expect(screen.getByRole("group", { name: "Speed breakdown" })).toHaveTextContent("Elf30");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
