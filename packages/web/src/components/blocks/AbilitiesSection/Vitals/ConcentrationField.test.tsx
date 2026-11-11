import type { Concentration } from "@dnd/character";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithClient } from "../../../../test/renderWithClient.tsx";
import { ConcentrationField } from "./ConcentrationField.tsx";

const BLESS = { type: "spell", name: "Bless", source: "XPHB", edition: "one" };

/** The field over a held concentration that `Undo` and `Redo` change from outside it, as the undo bar does. */
function Harness() {
  const [held, setHeld] = useState<Concentration | null>(null);
  const [previous, setPrevious] = useState<Concentration | null>(null);
  return (
    <>
      <ConcentrationField
        edition="one"
        held={held}
        busy={false}
        onSet={async (next) => {
          setHeld(next);
          return true;
        }}
        onEnd={async () => {
          setHeld(null);
          return true;
        }}
      />
      <button
        type="button"
        onClick={() => {
          setPrevious(held);
          setHeld(null);
        }}
      >
        Undo
      </button>
      <button type="button" onClick={() => setHeld(previous)}>
        Redo
      </button>
    </>
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("ConcentrationField", () => {
  it("moves focus to End concentration once after a set, and not when held changes later", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/search")) {
          return new Response(JSON.stringify({ items: [BLESS], total: 1, limit: 20, offset: 0 }));
        }
        return new Response(JSON.stringify({ spells: [{ name: "Bless", level: 1 }] }));
      }),
    );
    renderWithClient(<Harness />);

    fireEvent.focus(screen.getByRole("combobox", { name: "Concentrate on a spell" }));
    fireEvent.click(await screen.findByRole("option", { name: /^Bless/ }));
    const level = await screen.findByRole("combobox", { name: "Spell level" });
    await waitFor(() => expect(level).toHaveTextContent("Level 1"));
    fireEvent.click(screen.getByRole("button", { name: "Concentrate" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "End concentration" })).toHaveFocus(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    const redo = screen.getByRole("button", { name: "Redo" });
    redo.focus();
    fireEvent.click(redo);

    await screen.findByRole("button", { name: "End concentration" });
    expect(redo).toHaveFocus();
  });
});
