import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterRecord } from "../../test/records.ts";
import { renderWithClient } from "../../test/renderWithClient.tsx";
import { UndoButton } from "./UndoButton.tsx";

const ENTRY = { id: 1, describedAs: "Charisma 17 to 18", changedAt: "2026-01-01T00:00:00.000Z" };

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

describe("UndoButton", () => {
  it("names the change it would undo and says what undo does not reach", async () => {
    stubUndo([ENTRY]);
    renderWithClient(<UndoButton characterId="1" />);

    const button = await screen.findByRole("button", { name: "Undo Charisma 17 to 18" });
    expect(button).toHaveAccessibleDescription(
      /does not reach play state, page layout or a deleted character/,
    );
    expect(button).toHaveAttribute("aria-keyshortcuts", "Control+Z Meta+Z");
  });

  it("restores on click and announces what it undid", async () => {
    const fetchMock = stubUndo([ENTRY]);
    renderWithClient(<UndoButton characterId="1" />);

    fireEvent.click(await screen.findByRole("button", { name: "Undo Charisma 17 to 18" }));

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
        <UndoButton characterId="1" />
      </>,
    );
    await screen.findByRole("button", { name: "Undo Charisma 17 to 18" });

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
        <UndoButton characterId="1" />
      </>,
    );
    await screen.findByRole("button", { name: "Undo Charisma 17 to 18" });

    fireEvent.keyDown(screen.getByRole("button", { name: "Close" }), { key: "z", ctrlKey: true });
    expect(posts(fetchMock)).toHaveLength(0);
  });

  it("does nothing with an empty log", async () => {
    const fetchMock = stubUndo([]);
    renderWithClient(<UndoButton characterId="1" />);

    const button = await screen.findByRole("button", { name: "Nothing to undo" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(button);
    fireEvent.keyDown(document.body, { key: "z", ctrlKey: true });
    expect(posts(fetchMock)).toHaveLength(0);
  });
});
