import type { CharacterDerived } from "@dnd/character";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { saveToastState } from "../../../lib/saveToasts.ts";
import { SaveOverride } from "../../overrideContext.ts";
import { SizeValue } from "./SizeValue.tsx";

type Size = CharacterDerived["size"];

const medium: Size = { computed: "medium", manual: null, terms: [] };

function onPage(size: Size, save = vi.fn().mockResolvedValue(undefined)) {
  render(
    <SaveOverride.Provider value={save}>
      <SizeValue size={size} />
    </SaveOverride.Provider>,
  );
  return save;
}

function pick(trigger: string, option: RegExp) {
  fireEvent.click(screen.getByRole("button", { name: trigger }));
  fireEvent.click(screen.getByRole("combobox", { name: "Size override" }));
  fireEvent.click(screen.getByRole("option", { name: option }));
}

describe("SizeValue", () => {
  it("saves a picked size under the size key", async () => {
    const save = onPage(medium);
    pick("Size Medium", /^Large$/);
    await waitFor(() => expect(save).toHaveBeenCalledWith("size", "large"));
  });

  it("drops the override when the computed size is picked again", async () => {
    const save = onPage({ ...medium, manual: "large" });
    pick("Size Large, overridden from Medium", /Medium \(computed\)/);
    await waitFor(() => expect(save).toHaveBeenCalledWith("size", null));
  });

  it("raises a toast with a retry when the write fails", async () => {
    const save = onPage(medium, vi.fn().mockRejectedValue(new Error("offline")));
    pick("Size Medium", /^Small$/);
    await waitFor(() =>
      expect(saveToastState().toasts).toContainEqual(
        expect.objectContaining({ field: "Size", message: "offline" }),
      ),
    );
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("is the bare size off the character page", () => {
    render(<SizeValue size={medium} />);
    expect(screen.getByText("Medium")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
