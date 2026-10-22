import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterRecord } from "../../../test/records.ts";
import { renderWithClient } from "../../../test/renderWithClient.tsx";
import { UndoHistory } from "./UndoHistory.tsx";

const entry = (id: number, describedAs: string, changes = [describedAs]) => ({
  id,
  describedAs,
  changes,
  changedAt: `2026-01-01T00:0${id}:00.000Z`,
});

const LOG = [
  entry(3, "Name Vex to Nyx"),
  entry(2, "Strength 8 to 9, Dexterity 16 to 17 and 2 more changes", [
    "Strength 8 to 9",
    "Dexterity 16 to 17",
    "Constitution 14 to 15",
    "Wisdom 12 to 13",
  ]),
  entry(1, "Charisma 17 to 18"),
];

const RECORD = characterRecord("1", "Vex");

function stub(post: () => Response = () => new Response(JSON.stringify(RECORD))) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === "POST") return post();
    const url = String(input);
    return new Response(JSON.stringify(url.endsWith("/undo") ? LOG : RECORD));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const posts = (fetchMock: ReturnType<typeof stub>) =>
  fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");

const undoTo = (name: RegExp) => {
  const row = [...document.querySelectorAll<HTMLElement>("ol > li")].find((li) =>
    name.test(li.querySelector("p")?.textContent ?? ""),
  );
  if (!row) throw new Error(`no entry ${name}`);
  return within(row).getByRole("button", { name: /^Undo to here/ });
};

async function rendered() {
  renderWithClient(<UndoHistory characterId="1" />);
  await waitFor(() => expect(document.querySelectorAll("ol > li")).toHaveLength(3));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("UndoHistory", () => {
  it("lists every entry newest first, with when and every change it holds", async () => {
    stub();
    await rendered();

    const rows = screen
      .getAllByRole("listitem")
      .filter((item) => item.parentElement?.tagName === "OL");
    expect(rows.map((row) => row.querySelector("p")?.textContent)).toEqual(
      LOG.map((each) => each.describedAs),
    );
    expect(rows[0]?.querySelector("time")).toHaveAttribute("datetime", LOG[0]?.changedAt);
    expect(within(rows[1] as HTMLElement).getByText("4 changes")).toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).getByText("Wisdom 12 to 13")).toBeInTheDocument();
    expect(within(rows[0] as HTMLElement).queryByText(/changes$/)).toBeNull();
  });

  it("marks the entry and every newer one while its Undo to here is hovered or focused", async () => {
    stub();
    await rendered();
    const marked = () =>
      [...document.querySelectorAll("ol > li[data-marked=true] > p")].map((p) => p.textContent);

    fireEvent.mouseEnter(undoTo(/^Strength/));
    expect(marked()).toEqual([LOG[0]?.describedAs, LOG[1]?.describedAs]);
    fireEvent.mouseLeave(undoTo(/^Strength/));
    expect(marked()).toEqual([]);

    fireEvent.focus(undoTo(/^Charisma/));
    expect(marked()).toHaveLength(3);
    expect(undoTo(/^Charisma/)).toHaveAccessibleName("Undo to here, undoing 3 changes");
  });

  it("asks first, then undoes back to the entry in one write and announces it", async () => {
    const fetchMock = stub();
    await rendered();

    fireEvent.click(undoTo(/^Strength/));
    const dialog = screen.getByRole("dialog", { name: "Undo 2 changes?" });
    expect(dialog).toHaveTextContent("and the 1 change after it");
    expect(dialog).toHaveTextContent("There is no redo.");
    expect(posts(fetchMock)).toHaveLength(0);

    fireEvent.click(within(dialog).getByRole("button", { name: "Undo 2 changes" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Undid 2 changes"));

    const [[url, init]] = posts(fetchMock) as [[string, RequestInit]];
    expect(url).toBe("/api/characters/1/undo");
    expect(JSON.parse(String(init.body))).toEqual({ to: 2, newest: 3 });
    expect(new Headers(init.headers).get("If-Unmodified-Since")).toBe(
      new Date(RECORD.updatedAt).toUTCString(),
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps the dialog open naming the refusal where the character moved on", async () => {
    stub(
      () =>
        new Response(
          JSON.stringify({ error: "The character changed since its undo history was read" }),
          { status: 412 },
        ),
    );
    await rendered();

    fireEvent.click(undoTo(/^Name/));
    const dialog = screen.getByRole("dialog", { name: "Undo 1 change?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Undo 1 change" }));

    await waitFor(() =>
      expect(within(dialog).getByRole("alert")).toHaveTextContent(
        "Undo failed: The character changed since its undo history was read",
      ),
    );
  });
});
