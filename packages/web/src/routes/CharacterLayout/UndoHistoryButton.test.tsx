import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useReplaceCharacterState } from "../../hooks/useReplaceCharacterState.ts";
import { characterRecord, stateRecord } from "../../test/records.ts";
import { renderWithClient } from "../../test/renderWithClient.tsx";
import { UndoHistoryButton } from "./UndoHistoryButton.tsx";

const ENTRY = {
  id: 1,
  describedAs: "Charisma 17 to 18",
  changes: ["Charisma 17 to 18"],
  changedAt: "2026-01-01T00:00:00.000Z",
};

const button = (onToggle = () => {}) => (
  <UndoHistoryButton characterId="1" panelId="dock" open={false} onToggle={onToggle} />
);

function stubUndo(entries: unknown[]) {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) =>
    init?.method === "POST"
      ? new Response(JSON.stringify(characterRecord("1", "Vex")), { status: 200 })
      : new Response(JSON.stringify(entries), { status: 200 }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const posts = (fetchMock: ReturnType<typeof stubUndo>) =>
  fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("UndoHistoryButton", () => {
  it("toggles the undo history panel", async () => {
    stubUndo([ENTRY]);
    const onToggle = vi.fn();
    renderWithClient(button(onToggle));

    const toggle = screen.getByRole("button", { name: "Undo Changes" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("restores the newest entry on Control+Z and announces what it undid", async () => {
    const fetchMock = stubUndo([ENTRY]);
    renderWithClient(button());
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Undo Changes" })).toHaveAccessibleDescription(
        "Control+Z or Command+Z undoes Charisma 17 to 18",
      ),
    );

    fireEvent.keyDown(document.body, { key: "z", ctrlKey: true });

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Undid Charisma 17 to 18"),
    );
    expect(posts(fetchMock)).toHaveLength(1);
  });

  it("restores on Control+Z outside a text control, and leaves one to its own undo", async () => {
    const fetchMock = stubUndo([ENTRY]);
    renderWithClient(
      <>
        <input aria-label="Notes" />
        <input type="checkbox" aria-label="Prepared" />
        {button()}
      </>,
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Undo Changes" })).toHaveAccessibleDescription(
        /Charisma 17 to 18/,
      ),
    );

    fireEvent.keyDown(screen.getByLabelText("Notes"), { key: "z", ctrlKey: true });
    expect(posts(fetchMock)).toHaveLength(0);

    fireEvent.keyDown(screen.getByLabelText("Prepared"), { key: "z", metaKey: true });
    await waitFor(() => expect(posts(fetchMock)).toHaveLength(1));
  });

  it("leaves the sheet alone while a dialog is open over it", async () => {
    const fetchMock = stubUndo([ENTRY]);
    renderWithClient(
      <>
        <dialog open>
          <button type="button">Close</button>
        </dialog>
        {button()}
      </>,
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Undo Changes" })).toHaveAccessibleDescription(
        /Charisma 17 to 18/,
      ),
    );

    fireEvent.keyDown(screen.getByRole("button", { name: "Close" }), { key: "z", ctrlKey: true });
    expect(posts(fetchMock)).toHaveLength(0);
  });

  it("undoes nothing on Control+Z while a play-state write is saving, and refetches the log once it lands", async () => {
    let release = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "PUT") {
        await held;
        return new Response(JSON.stringify(stateRecord()), { status: 200 });
      }
      return init?.method === "POST"
        ? new Response(JSON.stringify(characterRecord("1", "Vex")), { status: 200 })
        : new Response(JSON.stringify([ENTRY]), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    function Damage() {
      const replace = useReplaceCharacterState("1");
      return (
        <>
          <button type="button" onClick={() => replace.mutate(stateRecord().state)}>
            Damage
          </button>
          {replace.writing && <span>Saving</span>}
        </>
      );
    }
    renderWithClient(
      <>
        <Damage />
        {button()}
      </>,
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Undo Changes" })).toHaveAccessibleDescription(
        /Charisma 17 to 18/,
      ),
    );
    const reads = () => fetchMock.mock.calls.filter(([, init]) => init?.method === undefined);
    expect(reads()).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Damage" }));
    // The shortcut reads the same in-flight count, which lands in the same render as this.
    await screen.findByText("Saving");
    fireEvent.keyDown(document.body, { key: "z", ctrlKey: true });
    release();

    await waitFor(() => expect(reads()).toHaveLength(2));
    expect(posts(fetchMock)).toHaveLength(0);
  });

  it("does nothing with an empty log", async () => {
    const fetchMock = stubUndo([]);
    renderWithClient(button());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const toggle = screen.getByRole("button", { name: "Undo Changes" });
    await waitFor(() => expect(toggle).toHaveAccessibleDescription("Nothing to undo"));
    fireEvent.keyDown(document.body, { key: "z", ctrlKey: true });
    expect(posts(fetchMock)).toHaveLength(0);
  });
});
